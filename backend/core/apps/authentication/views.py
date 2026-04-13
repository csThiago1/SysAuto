"""
Paddock Solutions — Authentication Views
"""
import hashlib
import time

import jwt as pyjwt
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GlobalUser
from .permissions import IsManagerOrAbove
from .serializers import MeSerializer, StaffUserSerializer

_DEV_JWT_SECRET = "dscar-dev-secret-paddock-2025"
_DEV_ACCESS_CODE = "paddock123"


class DevTokenView(APIView):
    """
    POST /api/v1/auth/dev-token/

    Emite um JWT HS256 devidamente assinado para uso no ambiente de desenvolvimento.
    Aceita qualquer e-mail + senha 'paddock123'. Não existe em produção.

    Body: {"email": "...", "password": "paddock123"}
    Response: {"access": "<jwt>", "refresh": "<jwt>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        """Valida credenciais dev e retorna JWT HS256 assinado."""
        email: str = request.data.get("email", "").strip().lower()
        password: str = request.data.get("password", "")

        if not email:
            return Response({"detail": "Campo 'email' obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        if password != _DEV_ACCESS_CODE:
            return Response({"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED)

        now = int(time.time())
        payload: dict = {
            "sub": f"dev-{email}",
            "email": email,
            "name": email.split("@")[0],
            "role": "ADMIN",
            "active_company": "dscar",
            "tenant_schema": "tenant_dscar",
            "client_slug": "grupo-dscar",
            "iat": now,
            "exp": now + 86400,  # 24 horas
        }

        token: str = pyjwt.encode(payload, _DEV_JWT_SECRET, algorithm="HS256")

        # Cria o GlobalUser automaticamente se não existir
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        GlobalUser.objects.get_or_create(
            email_hash=email_hash,
            defaults={"email": email, "name": payload["name"], "is_active": True},
        )

        return Response({"access": token, "refresh": token})


class MeView(APIView):
    """
    GET /api/v1/auth/me/ — identidade completa do usuário autenticado.

    Retorna GlobalUser + snapshot do Employee no tenant atual (se existir)
    + snapshot do UnifiedCustomer vinculado (se existir).
    Usado pelo frontend para construir o contexto de sessão rico.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Retorna identidade completa do usuário autenticado."""
        user: GlobalUser = request.user  # type: ignore[assignment]
        # request.auth é o dict de claims do JWT (DevJWT ou KeycloakJWT)
        payload: dict = request.auth if isinstance(request.auth, dict) else {}

        data: dict = {
            "id": str(user.pk),
            "name": user.name,
            "email_hash": user.email_hash,
            "role": payload.get("role", "STOREKEEPER"),
            "active_company": payload.get("active_company", ""),
            "tenant_schema": payload.get("tenant_schema", ""),
            "is_employee": False,
            "is_customer": False,
            "employee": None,
            "customer": None,
        }

        # Perfil de colaborador — pode existir no schema do tenant ativo
        try:
            emp = user.employee_profile  # OneToOne reverso
            data["is_employee"] = True
            data["employee"] = {
                "id": str(emp.pk),
                "department": emp.department,
                "position": emp.position,
                "status": emp.status,
                "registration_number": emp.registration_number,
            }
        except Exception:
            pass

        # Perfil de cliente — schema public
        try:
            customer = getattr(user, "customer_profile", None)
            if customer and customer.is_active:
                data["is_customer"] = True
                data["customer"] = {
                    "id": str(customer.pk),
                    "name": customer.name,
                    "phone_masked": self._mask_phone(str(customer.phone or "")),
                    "cpf_masked": self._mask_cpf(str(customer.cpf or "")),
                }
        except Exception:
            pass

        serializer = MeSerializer(data=data)
        serializer.is_valid()  # sempre válido — dados vêm do DB
        return Response(serializer.validated_data)

    @staticmethod
    def _mask_phone(phone: str) -> str:
        """Mascara telefone: (**) *****-XXXX."""
        if len(phone) >= 4:
            return "(**) *****-" + phone[-4:]
        return ""

    @staticmethod
    def _mask_cpf(cpf: str) -> str:
        """Mascara CPF: ***.***.***-XX."""
        if len(cpf) >= 2:
            return "***.***.***-" + cpf[-2:]
        return ""


class StaffListView(APIView):
    """
    GET  /api/v1/auth/staff/             — lista todos os usuários ativos
    GET  /api/v1/auth/staff/?positions=consultant,manager  — filtra por cargo HR

    O parâmetro `positions` faz cross-query com apps.hr.Employee.position,
    retornando apenas GlobalUsers vinculados a Employees com esses cargos.
    Múltiplos valores separados por vírgula.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        positions_param = request.query_params.get("positions", "").strip()

        if positions_param:
            positions = [p.strip() for p in positions_param.split(",") if p.strip()]
            # Cross-query com HR employees no schema do tenant atual
            try:
                from apps.hr.models import Employee
                employee_user_ids = Employee.objects.filter(
                    position__in=positions,
                    is_active=True,
                ).values_list("user_id", flat=True)
                users = GlobalUser.objects.filter(
                    id__in=employee_user_ids,
                    is_active=True,
                ).order_by("name")
            except Exception:
                # Fallback se HR não estiver disponível no schema
                users = GlobalUser.objects.filter(is_active=True).order_by("name")
        else:
            users = GlobalUser.objects.filter(is_active=True).order_by("name")

        return Response(StaffUserSerializer(users, many=True).data)


class PushTokenView(APIView):
    """
    PATCH /api/v1/auth/push-token/

    Registra ou atualiza o Expo Push Token do usuário autenticado.
    Body: {"token": "ExponentPushToken[...]"}
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request) -> Response:
        """Salva push token no GlobalUser autenticado."""
        token: str = request.data.get("token", "").strip()
        if not token:
            return Response({"detail": "Campo 'token' obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        user: GlobalUser = request.user  # type: ignore[assignment]
        user.push_token = token
        user.save(update_fields=["push_token", "updated_at"])
        return Response({"detail": "Push token registrado."})


class StaffDetailView(APIView):
    """
    PATCH /api/v1/auth/staff/<pk>/ — atualiza job_title do usuário
    """

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def patch(self, request: Request, pk: str) -> Response:
        try:
            user = GlobalUser.objects.get(pk=pk, is_active=True)
        except GlobalUser.DoesNotExist:
            return Response({"detail": "Não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StaffUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
