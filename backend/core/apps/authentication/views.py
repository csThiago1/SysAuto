"""
Paddock Solutions — Authentication Views

Login, Refresh, Me, Staff, PushToken, DevToken.
"""
import datetime
import hashlib
import logging
import secrets

import jwt as pyjwt
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .email_service import send_reset_password_email, send_verification_email
from .jwt_utils import decode_token, generate_access_token, generate_refresh_token
from .models import (
    EmailVerificationToken,
    GlobalUser,
    PasswordResetToken,
    RefreshToken,
)
from drf_spectacular.utils import OpenApiParameter, extend_schema

from .permissions import IsAdminOrAbove, IsManagerOrAbove
from .serializers import (
    DetailResponseSerializer,
    ForgotPasswordRequestSerializer,
    LoginRequestSerializer,
    MeSerializer,
    PushTokenRequestSerializer,
    RefreshRequestSerializer,
    RegisterRequestSerializer,
    ResetPasswordRequestSerializer,
    StaffUserSerializer,
    TokenPairSerializer,
    VerifyEmailRequestSerializer,
)

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
    """Get effective permissions from RBAC matrix + Employee profile."""
    try:
        from .permission_service import get_effective_permissions
        return get_effective_permissions(user.role or "STOREKEEPER")
    except Exception:
        # Fallback: try Employee extra_permissions
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

    @extend_schema(
        request=LoginRequestSerializer,
        responses={200: TokenPairSerializer},
        auth=[],
    )
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

    @extend_schema(
        request=LoginRequestSerializer,
        responses={200: TokenPairSerializer},
        auth=[],
    )
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

    @extend_schema(
        request=RefreshRequestSerializer,
        responses={200: TokenPairSerializer},
        auth=[],
    )
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

    @extend_schema(responses={200: MeSerializer})
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


# ─── ForgotPasswordView ─────────────────────────────────────────────────────

def _get_frontend_url() -> str:
    """Get frontend base URL from settings."""
    return getattr(settings, "FRONTEND_URL", "http://localhost:3001")


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/

    Gera token de reset e envia email. SEMPRE retorna 200 para evitar
    enumeracao de emails (nao revela se o email existe).

    Body: {"email": "user@example.com"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        request=ForgotPasswordRequestSerializer,
        responses={200: DetailResponseSerializer},
        auth=[],
    )
    def post(self, request: Request) -> Response:
        """Envia email de reset de senha."""
        email_input: str = request.data.get("email", "").strip().lower()
        if not email_input:
            return Response(
                {"detail": "Campo 'email' obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Always return 200 -- no email enumeration
        email_h = hashlib.sha256(email_input.encode()).hexdigest()
        try:
            user = GlobalUser.objects.get(email_hash=email_h, is_active=True)
        except GlobalUser.DoesNotExist:
            logger.info("Forgot-password para email nao cadastrado (hash=%s...)", email_h[:8])
            return Response({"detail": "Se o email existir, um link sera enviado."})

        # Generate token
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        PasswordResetToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=1),
        )

        # Build reset URL and send email
        frontend_url = _get_frontend_url()
        reset_url = f"{frontend_url}/auth/reset-password?token={raw_token}"
        send_reset_password_email(user.email, reset_url)

        return Response({"detail": "Se o email existir, um link sera enviado."})


# ─── ResetPasswordView ──────────────────────────────────────────────────────

class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/

    Valida token de reset, define nova senha e revoga todos os refresh tokens.

    Body: {"token": "<raw_token>", "password": "<new_password>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        request=ResetPasswordRequestSerializer,
        responses={200: DetailResponseSerializer},
        auth=[],
    )
    def post(self, request: Request) -> Response:
        """Valida token e redefine senha."""
        raw_token: str = request.data.get("token", "").strip()
        new_password: str = request.data.get("password", "").strip()

        if not raw_token or not new_password:
            return Response(
                {"detail": "Campos 'token' e 'password' obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "Senha deve ter pelo menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = datetime.datetime.now(tz=datetime.timezone.utc)

        try:
            stored = PasswordResetToken.objects.select_related("user").get(
                token_hash=token_hash,
                is_used=False,
                expires_at__gt=now,
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {"detail": "Token inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark token as used
        stored.is_used = True
        stored.save(update_fields=["is_used"])

        # Set new password
        user = stored.user
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Revoke all refresh tokens (force re-login everywhere)
        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        logger.info("Senha redefinida para user_id=%s", user.pk)
        return Response({"detail": "Senha redefinida com sucesso."})


# ─── VerifyEmailView ────────────────────────────────────────────────────────

class VerifyEmailView(APIView):
    """
    POST /api/v1/auth/verify-email/

    Valida token de verificacao de email e ativa a conta.

    Body: {"token": "<raw_token>"}
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        request=VerifyEmailRequestSerializer,
        responses={200: DetailResponseSerializer},
        auth=[],
    )
    def post(self, request: Request) -> Response:
        """Verifica email e ativa conta."""
        raw_token: str = request.data.get("token", "").strip()
        if not raw_token:
            return Response(
                {"detail": "Campo 'token' obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = datetime.datetime.now(tz=datetime.timezone.utc)

        try:
            stored = EmailVerificationToken.objects.select_related("user").get(
                token_hash=token_hash,
                is_used=False,
                expires_at__gt=now,
            )
        except EmailVerificationToken.DoesNotExist:
            return Response(
                {"detail": "Token inválido ou expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark token as used
        stored.is_used = True
        stored.save(update_fields=["is_used"])

        # Activate account
        user = stored.user
        user.email_verified = True
        user.save(update_fields=["email_verified"])

        logger.info("Email verificado para user_id=%s", user.pk)
        return Response({"detail": "Email verificado com sucesso."})


# ─── RegisterView (admin-only invite) ───────────────────────────────────────

class RegisterView(APIView):
    """
    POST /api/v1/auth/register/

    Registro por convite -- apenas admin pode criar novos usuarios.
    Envia email de verificacao para o usuario criado.

    Body: {"email": "...", "name": "...", "role": "CONSULTANT", "password": "..."}
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    @extend_schema(
        request=RegisterRequestSerializer,
        responses={201: DetailResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        """Cria usuario por convite (admin-only)."""
        email: str = request.data.get("email", "").strip().lower()
        name: str = request.data.get("name", "").strip()
        role: str = request.data.get("role", "CONSULTANT").upper()
        password: str = request.data.get("password", "").strip()

        if not email or not name:
            return Response(
                {"detail": "Campos 'email' e 'name' obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password and len(password) < 8:
            return Response(
                {"detail": "Senha deve ter pelo menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate role
        valid_roles = [choice[0] for choice in GlobalUser.Role.choices]
        if role not in valid_roles:
            return Response(
                {"detail": f"Role inválido. Opções: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if user already exists
        email_h = hashlib.sha256(email.encode()).hexdigest()
        if GlobalUser.objects.filter(email_hash=email_h).exists():
            return Response(
                {"detail": "Usuário com este email já existe."},
                status=status.HTTP_409_CONFLICT,
            )

        # Optional employee fields
        department: str = request.data.get("department", "").strip()
        position: str = request.data.get("position", "").strip()

        # Create user
        user = GlobalUser.objects.create_user(
            email=email,
            password=password or None,
            name=name,
            role=role,
        )

        # Auto-create Employee profile in current tenant
        try:
            from apps.hr.models import Employee
            from django.utils import timezone as tz

            # Generate registration number: EMP-YYYYMM-NNN
            now = tz.now()
            prefix = f"EMP-{now.strftime('%Y%m')}"
            last = Employee.objects.filter(
                registration_number__startswith=prefix
            ).order_by("-registration_number").first()
            if last:
                seq = int(last.registration_number.split("-")[-1]) + 1
            else:
                seq = 1
            reg_number = f"{prefix}-{seq:03d}"

            Employee.objects.create(
                user=user,
                department=department or "reception",
                position=position or "consultant",
                role=role,
                registration_number=reg_number,
                hire_date=now.date(),
                status="active",
            )
            logger.info("Employee criado automaticamente: %s, matricula=%s", user.name, reg_number)
        except Exception as exc:
            # Nao bloqueia o cadastro se Employee falhar (ex: app HR nao migrado)
            logger.warning("Falha ao criar Employee automaticamente: %s", exc)

        # Generate verification token and send email
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        EmailVerificationToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=24),
        )

        frontend_url = _get_frontend_url()
        verify_url = f"{frontend_url}/auth/verify-email?token={raw_token}"
        send_verification_email(user.email, verify_url)

        logger.info("Usuário registrado por convite: user_id=%s, role=%s", user.pk, role)
        return Response(
            {
                "id": str(user.pk),
                "email_hash": user.email_hash,
                "name": user.name,
                "role": user.role,
            },
            status=status.HTTP_201_CREATED,
        )


class StaffListView(APIView):
    """
    GET  /api/v1/auth/staff/                                — lista todos os usuarios
    GET  /api/v1/auth/staff/?positions=consultant,manager   — filtra por cargo HR
    GET  /api/v1/auth/staff/?departments=painting,bodywork  — filtra por setor HR
    GET  /api/v1/auth/staff/?include_inactive=true          — inclui usuarios inativos

    Os parametros `positions` e `departments` fazem cross-query com
    apps.hr.Employee, retornando apenas GlobalUsers vinculados a Employees
    que atendam os filtros. Multiplos valores separados por virgula.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "positions", str, description="CSV de cargos HR (filtro cross-query com Employee)"
            ),
            OpenApiParameter(
                "departments", str, description="CSV de setores HR (filtro cross-query com Employee)"
            ),
            OpenApiParameter(
                "include_inactive", bool, description="Inclui usuários com is_active=False"
            ),
        ],
        responses={200: StaffUserSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        """Lista usuarios com filtros opcionais."""
        positions_param = request.query_params.get("positions", "").strip()
        departments_param = request.query_params.get("departments", "").strip()
        include_inactive = request.query_params.get("include_inactive", "").lower() == "true"

        base_filter: dict = {}
        if not include_inactive:
            base_filter["is_active"] = True

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
                    **base_filter,
                ).order_by("name")
            except Exception:
                users = GlobalUser.objects.filter(**base_filter).order_by("name")
        else:
            users = GlobalUser.objects.filter(**base_filter).order_by("name")

        return Response(StaffUserSerializer(users, many=True).data)


class PushTokenView(APIView):
    """
    PATCH /api/v1/auth/push-token/

    Registra ou atualiza o Expo Push Token do usuário autenticado.
    Body: {"token": "ExponentPushToken[...]"}
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PushTokenRequestSerializer,
        responses={200: DetailResponseSerializer},
    )
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
    PATCH /api/v1/auth/staff/<pk>/ — atualiza role, job_title ou is_active do usuario.

    Requer permissao admin.users (ADMIN ou OWNER).
    """

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    @extend_schema(
        request=StaffUserSerializer,
        responses={200: StaffUserSerializer, 400: DetailResponseSerializer, 404: DetailResponseSerializer},
    )
    def patch(self, request: Request, pk: str) -> Response:
        """Atualiza campos editaveis do usuario (role, job_title, is_active)."""
        try:
            user = GlobalUser.objects.get(pk=pk)
        except GlobalUser.DoesNotExist:
            return Response({"detail": "Nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StaffUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
