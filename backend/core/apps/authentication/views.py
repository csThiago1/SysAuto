"""
Paddock Solutions — Authentication Views
"""
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GlobalUser
from .permissions import IsManagerOrAbove
from .serializers import MeSerializer, StaffUserSerializer


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
