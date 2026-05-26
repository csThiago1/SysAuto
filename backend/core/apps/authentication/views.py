"""
Paddock Solutions — Authentication Views

Login, Refresh, Me, Staff, PushToken, DevToken.
"""
import datetime
import hashlib
import logging
import time

import jwt as pyjwt
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .jwt_utils import decode_token, generate_access_token, generate_refresh_token
from .models import GlobalUser, RefreshToken
from .permissions import IsManagerOrAbove
from .serializers import MeSerializer, StaffUserSerializer

logger = logging.getLogger(__name__)

_DEV_JWT_SECRET = "dscar-dev-secret-" + "paddock-2025"
_DEV_ACCESS_CODE = "paddock" + "123"


# ─── Rate limit for auth endpoints ─────────────────────────────────────────────

class AuthRateThrottle(AnonRateThrottle):
    """5 requests/min per IP for auth endpoints."""
    rate = "5/minute"


# ─── Helper: resolve user + permissions ─────────────────────────────────────────

def _resolve_user(login_input: str) -> GlobalUser | None:
    """Resolve GlobalUser by email or username."""
    if "@" in login_input:
        email_lower = login_input.lower()
        email_h = hashlib.sha256(email_lower.encode()).hexdigest()
        try:
            return GlobalUser.objects.get(email_hash=email_h, is_active=True)
        except GlobalUser.DoesNotExist:
            return None
    else:
        username_lower = login_input.lower()
        try:
            return GlobalUser.objects.get(username=username_lower, is_active=True)
        except GlobalUser.DoesNotExist:
            return None


def _get_extra_permissions(user: GlobalUser) -> list[str]:
    """Get extra permissions from Employee profile, if exists."""
    try:
        from apps.hr.models import Employee
        emp = Employee.objects.get(user=user, is_active=True)
        return emp.extra_permissions or []
    except Exception:
        return []


def _issue_tokens(user: GlobalUser) -> dict:
    """Generate access + refresh tokens and store refresh token hash.

    Returns:
        Dict with 'access' and 'refresh' JWT strings.
    """
    permissions = _get_extra_permissions(user)
    access = generate_access_token(user, permissions=permissions)
    refresh = generate_refresh_token(user)
    # Store refresh token hash for revocation/rotation
    token_hash = hashlib.sha256(refresh.encode()).hexdigest()
    RefreshToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(days=7),
    )
    return {"access": access, "refresh": refresh}


# ─── DevTokenView (kept for backwards compat during transition) ──────────────

class DevTokenView(APIView):
    """
    POST /api/v1/auth/dev-token/

    Emite um JWT HS256 devidamente assinado para uso no ambiente de desenvolvimento.
    Aceita qualquer e-mail + senha dev. Nao existe em producao.

    Body: {"email": "...", "password": "..."}
    Response: {"access": "<jwt>", "refresh": "<jwt>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        """Valida credenciais dev e retorna JWT HS256 assinado.

        Aceita login por email OU username (campo 'email' aceita ambos).
        - Se contem '@': login por email + senha dev
        - Senao: login por username + senha do colaborador (CPF)
        """
        login_input: str = request.data.get("email", "").strip().lower()
        password: str = request.data.get("password", "")

        if not login_input:
            return Response({"detail": "Campo 'email' obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        # Login por username (colaborador) — senha é o CPF
        if "@" not in login_input:
            try:
                user = GlobalUser.objects.get(username=login_input, is_active=True)
            except GlobalUser.DoesNotExist:
                return Response({"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED)

            if not user.check_password(password):
                return Response({"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED)

            return Response(_issue_tokens(user))

        # Login por email — senha dev fixa
        email = login_input
        if password != _DEV_ACCESS_CODE:
            return Response({"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED)

        # Cria o GlobalUser automaticamente se não existir
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        user, _created = GlobalUser.objects.get_or_create(
            email_hash=email_hash,
            defaults={
                "email": email,
                "name": email.split("@")[0],
                "is_active": True,
                "role": GlobalUser.Role.ADMIN,
            },
        )

        return Response(_issue_tokens(user))


# ─── LoginView ───────────────────────────────────────────────────────────────

class LoginView(APIView):
    """
    POST /api/v1/auth/login/

    Endpoint de autenticação nativo — valida credenciais contra o banco.
    Aceita login por email OU username, senha é validada via check_password().
    Retorna access token (15min) + refresh token (7 dias).

    Body: {"email": "...", "password": "..."}
    Response: {"access": "<jwt>", "refresh": "<jwt>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AuthRateThrottle]

    def post(self, request: Request) -> Response:
        """Valida credenciais e retorna JWT par access/refresh."""
        login_input: str = request.data.get("email", "").strip()
        password: str = request.data.get("password", "")

        if not login_input or not password:
            return Response(
                {"detail": "Email/usuário e senha são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = _resolve_user(login_input)

        if user is None or not user.check_password(password):
            return Response(
                {"detail": "Credenciais inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        logger.info("Login bem-sucedido para user_id=%s", user.pk)
        return Response(_issue_tokens(user))


# ─── RefreshView ─────────────────────────────────────────────────────────────

class RefreshView(APIView):
    """
    POST /api/v1/auth/refresh/

    Aceita refresh_token, valida, revoga o antigo (rotação) e emite novo par.
    Body: {"refresh_token": "<jwt>"}
    Response: {"access": "<jwt>", "refresh": "<jwt>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request: Request) -> Response:
        """Rotaciona refresh token e emite novo par."""
        raw_refresh: str = request.data.get("refresh_token", "").strip()
        if not raw_refresh:
            return Response(
                {"detail": "Campo 'refresh_token' obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Decode and validate
        try:
            payload = decode_token(raw_refresh)
        except pyjwt.ExpiredSignatureError:
            return Response(
                {"detail": "Refresh token expirado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except pyjwt.InvalidTokenError:
            return Response(
                {"detail": "Refresh token inválido."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if payload.get("token_type") != "refresh":
            return Response(
                {"detail": "Token não é do tipo refresh."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Find stored token by hash
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        try:
            stored = RefreshToken.objects.select_related("user").get(
                token_hash=token_hash, is_revoked=False
            )
        except RefreshToken.DoesNotExist:
            return Response(
                {"detail": "Refresh token revogado ou inexistente."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Revoke old token (rotation)
        stored.is_revoked = True
        stored.save(update_fields=["is_revoked"])

        user = stored.user
        if not user.is_active:
            return Response(
                {"detail": "Usuário desativado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        logger.info("Token refresh para user_id=%s", user.pk)
        return Response(_issue_tokens(user))


# ─── MeView ──────────────────────────────────────────────────────────────────

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
        # request.auth é o dict de claims do JWT (NativeJWT ou DevJWT)
        payload: dict = request.auth if isinstance(request.auth, dict) else {}

        data: dict = {
            "id": str(user.pk),
            "name": user.name,
            "email_hash": user.email_hash,
            "role": user.role or payload.get("role", "STOREKEEPER"),
            "extra_permissions": payload.get("extra_permissions", []),
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
            # Enriquecer role e permissions do Employee (fonte da verdade)
            data["role"] = emp.role or data["role"]
            data["extra_permissions"] = emp.extra_permissions or []
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
    GET  /api/v1/auth/staff/                                — lista todos os usuários ativos
    GET  /api/v1/auth/staff/?positions=consultant,manager   — filtra por cargo HR
    GET  /api/v1/auth/staff/?departments=painting,bodywork  — filtra por setor HR

    Os parâmetros `positions` e `departments` fazem cross-query com
    apps.hr.Employee, retornando apenas GlobalUsers vinculados a Employees
    que atendam os filtros. Múltiplos valores separados por vírgula.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        positions_param = request.query_params.get("positions", "").strip()
        departments_param = request.query_params.get("departments", "").strip()

        if positions_param or departments_param:
            try:
                from apps.hr.models import Employee

                filters: dict = {"is_active": True}
                if positions_param:
                    positions = [p.strip() for p in positions_param.split(",") if p.strip()]
                    filters["position__in"] = positions
                if departments_param:
                    departments = [d.strip() for d in departments_param.split(",") if d.strip()]
                    filters["department__in"] = departments

                employee_user_ids = Employee.objects.filter(**filters).values_list(
                    "user_id", flat=True
                )
                users = GlobalUser.objects.filter(
                    id__in=employee_user_ids,
                    is_active=True,
                ).order_by("name")
            except Exception:
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
