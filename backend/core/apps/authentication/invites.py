"""
Convite de colaborador por link de uso único.

Admin gera o convite (com o papel); a pessoa abre /convite/<token>, preenche os dados e vira
GlobalUser + Employee no tenant de quem convidou. CNH opcional vai para o storage (R2 em produção).
"""
import hashlib
import logging
import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import validate_email
from django.db import connection, transaction
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import GlobalUser, Invite
from .permissions import IsAdminOrAbove

logger = logging.getLogger(__name__)

CNH_MAX_BYTES = 10 * 1024 * 1024
CNH_TYPES = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}
GONE = {"detail": "Convite inválido ou vencido."}
STORAGE_FAILED = {"detail": "Não foi possível enviar a CNH. Tente de novo ou envie sem ela."}


class InviteThrottle(AnonRateThrottle):
    """Páginas públicas do convite: limita tentativa de adivinhar token."""

    rate = "20/minute"


class _Gone(Exception):
    pass


class _Invalid(Exception):
    def __init__(self, errors: dict) -> None:
        self.errors = errors


class _StorageFailed(Exception):
    pass


def _pending_invites() -> "list[dict]":
    qs = Invite.objects.filter(
        tenant_schema=connection.schema_name,
        used_at__isnull=True,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    )
    return [
        {
            "id": str(i.pk),
            "role": i.role,
            "role_display": i.get_role_display(),
            "expires_at": i.expires_at,
            "created_at": i.created_at,
        }
        for i in qs
    ]


class InviteListCreateView(APIView):
    """GET pendentes · POST {role} → {id, token, role, expires_at}. O token só aparece aqui."""

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def get(self, request: Request) -> Response:
        return Response(_pending_invites())

    def post(self, request: Request) -> Response:
        role = str(request.data.get("role", "")).upper()
        if role not in GlobalUser.Role.values:
            return Response({"role": ["Papel inválido."]}, status=status.HTTP_400_BAD_REQUEST)
        invite, token = Invite.issue(role, connection.schema_name, request.user)
        logger.info("Convite %s criado por user_id=%s", invite.pk, request.user.pk)
        return Response(
            {"id": str(invite.pk), "token": token, "role": role, "expires_at": invite.expires_at},
            status=status.HTTP_201_CREATED,
        )


class InviteRevokeView(APIView):
    """DELETE → revoga (soft: marca revoked_at)."""

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        updated = Invite.objects.filter(pk=pk, used_at__isnull=True, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )
        if not updated:
            return Response({"detail": "Convite não encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InviteTokenView(APIView):
    """GET público: diz se o convite vale e para qual papel."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [InviteThrottle]

    def get(self, request: Request, token: str) -> Response:
        invite = Invite.find(token)
        if invite is None or not invite.is_usable:
            return Response(GONE, status=status.HTTP_410_GONE)
        return Response({"role_display": invite.get_role_display(), "expires_at": invite.expires_at})


def _clean_input(data: dict, cnh: UploadedFile | None) -> dict:
    """Valida o formulário antes de tocar no banco. Levanta _Invalid com erros por campo."""
    errors: dict[str, list[str]] = {}
    full_name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    cpf = "".join(c for c in str(data.get("cpf", "")) if c.isdigit())
    phone = str(data.get("phone", "")).strip()
    password = str(data.get("password", ""))

    if len(full_name.split()) < 2:
        errors["full_name"] = ["Informe o nome completo."]
    try:
        validate_email(email)
    except DjangoValidationError:
        errors["email"] = ["E-mail inválido."]
    if not cpf:
        errors["cpf"] = ["Informe o CPF."]
    if len("".join(c for c in phone if c.isdigit())) < 10:
        errors["phone"] = ["Informe o telefone com DDD."]
    try:
        if len(password) < 8:  # o projeto não configura AUTH_PASSWORD_VALIDATORS
            raise DjangoValidationError("A senha precisa ter pelo menos 8 caracteres.")
        validate_password(password)
    except DjangoValidationError as exc:
        errors["password"] = list(exc.messages)
    if cnh is not None:
        if cnh.content_type not in CNH_TYPES:
            errors["cnh"] = ["Envie a CNH em PDF, JPG ou PNG."]
        elif cnh.size > CNH_MAX_BYTES:
            errors["cnh"] = ["A CNH pode ter no máximo 10 MB."]
    if "email" not in errors:
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        if GlobalUser.objects.filter(email_hash=email_hash).exists():
            errors["email"] = ["Já existe uma conta com este e-mail."]
    if errors:
        raise _Invalid(errors)
    return {"full_name": full_name, "email": email, "cpf": cpf, "phone": phone, "password": password}


def _save_cnh(employee_id: uuid.UUID, cnh: UploadedFile) -> str:
    path = f"hr/employees/{employee_id}/cnh/{uuid.uuid4()}{CNH_TYPES[cnh.content_type]}"
    try:
        return default_storage.save(path, cnh)
    except Exception as exc:  # boto/R2 não levanta só OSError
        logger.error("Falha ao salvar CNH do employee %s: %s", employee_id, type(exc).__name__)
        raise _StorageFailed from exc


def accept_invite(invite: Invite, data: dict, cnh: UploadedFile | None) -> GlobalUser:
    """Cria GlobalUser + Employee (+ Person, CPF, contatos) e consome o convite, tudo ou nada."""
    from apps.hr.models import EmployeeDocument
    from apps.hr.serializers import EmployeeCreateSerializer
    from apps.hr.services import next_registration_number

    with transaction.atomic():
        invite = Invite.objects.select_for_update().get(pk=invite.pk)
        if not invite.is_usable:
            raise _Gone
        with schema_context(invite.tenant_schema):
            serializer = EmployeeCreateSerializer(
                data={
                    "name": data["full_name"],
                    "email": data["email"],
                    "phone": data["phone"],
                    "cpf": data["cpf"],
                    "department": "administrative",
                    "position": "administrative",
                    "contract_type": "clt",
                    "hire_date": timezone.localdate().isoformat(),
                    "registration_number": next_registration_number(),
                }
            )
            if not serializer.is_valid():
                errors = dict(serializer.errors)
                if "name" in errors:
                    errors["full_name"] = errors.pop("name")
                raise _Invalid(errors)
            employee = serializer.save()
            user = employee.user
            # O serializer de admissão põe senha = CPF; no convite vale a senha escolhida.
            user.set_password(data["password"])
            user.role = invite.role
            user.save(update_fields=["password", "role", "updated_at"])
            employee.role = invite.role
            employee.save(update_fields=["role", "updated_at"])
            if cnh is not None:
                key = _save_cnh(employee.pk, cnh)
                EmployeeDocument.objects.create(
                    employee=employee,
                    document_type=EmployeeDocument.DocumentType.CNH,
                    file_key=key,
                    file_name=cnh.name[:255],
                    file_size=cnh.size,
                    mime_type=cnh.content_type,
                    notes="Enviada no cadastro por convite (termo do RH).",
                )
        invite.used_at = timezone.now()
        invite.used_by = user
        invite.save(update_fields=["used_at", "used_by", "updated_at"])
    logger.info("Convite %s aceito: user_id=%s employee_id=%s", invite.pk, user.pk, employee.pk)
    return user


class InviteAcceptView(APIView):
    """POST público multipart: full_name, email, cpf, phone, password, cnh (opcional)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [InviteThrottle]

    def post(self, request: Request, token: str) -> Response:
        invite = Invite.find(token)
        if invite is None or not invite.is_usable:
            return Response(GONE, status=status.HTTP_410_GONE)
        cnh = request.FILES.get("cnh")
        try:
            data = _clean_input(request.data, cnh)
            accept_invite(invite, data, cnh)
        except _Invalid as exc:
            return Response(exc.errors, status=status.HTTP_400_BAD_REQUEST)
        except _Gone:
            return Response(GONE, status=status.HTTP_410_GONE)
        except _StorageFailed:
            return Response(STORAGE_FAILED, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"detail": "Cadastro concluído."}, status=status.HTTP_201_CREATED)
