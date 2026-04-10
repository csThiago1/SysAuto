"""
Paddock Solutions — HR Views
Sprint 5 + Sprint 6.

Regras de negócio ficam em services.py — nunca aqui.
"""
import logging
from datetime import date
from typing import Any


def _generate_presigned_url(key: str, expiration: int = 900) -> str:
    """Gera URL presignada S3 para download seguro. Expira em `expiration` segundos."""
    import boto3  # type: ignore[import-untyped]

    from django.conf import settings

    s3 = boto3.client("s3")
    return s3.generate_presigned_url(  # type: ignore[return-value]
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
        ExpiresIn=expiration,
    )

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .models import (
    Allowance,
    Bonus,
    Deduction,
    Employee,
    EmployeeDocument,
    GoalTarget,
    Payslip,
    SalaryHistory,
    TimeClockEntry,
    WorkSchedule,
)
from .serializers import (
    AllowanceCreateSerializer,
    AllowanceSerializer,
    BonusCreateSerializer,
    BonusSerializer,
    DeductionCreateSerializer,
    DeductionSerializer,
    EmployeeCreateSerializer,
    EmployeeDetailSerializer,
    EmployeeDocumentSerializer,
    EmployeeListSerializer,
    EmployeeUpdateSerializer,
    GoalTargetCreateSerializer,
    GoalTargetSerializer,
    GoalTargetUpdateSerializer,
    PayslipGenerateSerializer,
    PayslipSerializer,
    SalaryHistoryCreateSerializer,
    SalaryHistorySerializer,
    TimeClockRegisterSerializer,
    TimeClockEntrySerializer,
    WorkScheduleSerializer,
)
from .services import AllowanceService, GoalService, PayslipService, TimeClockService

logger = logging.getLogger(__name__)


class EmployeeViewSet(ModelViewSet):
    """
    CRUD de colaboradores.

    list     GET  /hr/employees/            → EmployeeListSerializer (filtros: status, department)
    create   POST /hr/employees/            → admissão (EmployeeCreateSerializer)
    retrieve GET  /hr/employees/{id}/       → EmployeeDetailSerializer
    update   PATCH /hr/employees/{id}/      → EmployeeUpdateSerializer
    terminate POST /hr/employees/{id}/terminate/ → desligamento
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {"status": ["exact"], "department": ["exact"], "contract_type": ["exact"]}
    search_fields = ["registration_number", "user__name"]
    ordering_fields = ["hire_date", "registration_number"]

    def get_permissions(self) -> list[Any]:
        if self.action in ["terminate"]:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> Any:
        return (
            Employee.objects.select_related("user")
            .filter(is_active=True)
            .order_by("user__name")
        )

    def get_serializer_class(self) -> Any:
        if self.action == "list":
            return EmployeeListSerializer
        if self.action == "create":
            return EmployeeCreateSerializer
        if self.action in ("update", "partial_update"):
            return EmployeeUpdateSerializer
        return EmployeeDetailSerializer

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request: Request) -> Response:
        """Perfil do colaborador autenticado — para o relógio de ponto."""
        employee = getattr(request.user, "employee_profile", None)
        if not employee or not employee.is_active:
            return Response(
                {"detail": "Usuário não possui perfil de colaborador ativo."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(EmployeeDetailSerializer(employee, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="terminate")
    @transaction.atomic
    def terminate(self, request: Request, pk: str | None = None) -> Response:
        """Desligamento: seta status=terminated e registra termination_date."""
        employee = self.get_object()
        if employee.status == Employee.Status.TERMINATED:
            return Response(
                {"detail": "Colaborador já está desligado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        employee.status = Employee.Status.TERMINATED
        employee.termination_date = date.today()
        employee.save(update_fields=["status", "termination_date", "updated_at"])
        logger.info("Employee terminated: %s", pk)
        return Response(EmployeeDetailSerializer(employee, context={"request": request}).data)


class EmployeeDocumentViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """
    Documentos do colaborador — soft delete apenas (nunca hard delete).

    list     GET  /hr/employees/{id}/documents/
    create   POST /hr/employees/{id}/documents/
    retrieve GET  /hr/employees/{id}/documents/{doc_id}/
    deactivate DELETE /hr/employees/{id}/documents/{doc_id}/  → soft delete
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = EmployeeDocumentSerializer

    def get_queryset(self) -> Any:
        return EmployeeDocument.objects.filter(
            employee_id=self.kwargs["employee_pk"],
            is_active=True,
        ).order_by("-created_at")

    def perform_create(self, serializer: EmployeeDocumentSerializer) -> None:
        serializer.save(employee_id=self.kwargs["employee_pk"])

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Soft delete — nunca hard delete de documentos trabalhistas."""
        doc = self.get_object()
        doc.soft_delete()
        logger.info("Document soft-deleted: %s", kwargs.get("pk"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class SalaryHistoryViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """
    Histórico de reajustes salariais — registros imutáveis após criação.

    list   GET  /hr/employees/{id}/salary-history/
    create POST /hr/employees/{id}/salary-history/  → também atualiza Employee.base_salary
    """

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self) -> Any:
        return (
            SalaryHistory.objects.filter(
                employee_id=self.kwargs["employee_pk"],
                is_active=True,
            )
            .select_related("authorized_by")
            .order_by("-effective_date")
        )

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return SalaryHistoryCreateSerializer
        return SalaryHistorySerializer

    @transaction.atomic
    def perform_create(self, serializer: SalaryHistoryCreateSerializer) -> None:
        """Cria reajuste e atualiza salário base do colaborador atomicamente."""
        employee = Employee.objects.select_for_update().get(
            pk=self.kwargs["employee_pk"]
        )
        history = serializer.save(
            employee=employee,
            authorized_by=self.request.user,
        )
        employee.base_salary = history.new_salary
        employee.save(update_fields=["base_salary", "updated_at"])
        logger.info(
            "Salary adjusted for employee %s: R$ %s",
            employee.registration_number,
            history.new_salary,
        )


# ── Sprint 6 ViewSets ─────────────────────────────────────────────────────────


class BonusViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """Bonificações — nested em /employees/{id}/bonuses/."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self) -> Any:
        return Bonus.objects.filter(
            employee_id=self.kwargs["employee_pk"], is_active=True
        ).order_by("-reference_month")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return BonusCreateSerializer
        return BonusSerializer

    def perform_create(self, serializer: BonusCreateSerializer) -> None:
        serializer.save(employee_id=self.kwargs["employee_pk"])


class GoalTargetViewSet(ModelViewSet):
    """Metas individuais e de setor."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {"status": ["exact"], "department": ["exact"]}

    def get_queryset(self) -> Any:
        return GoalTarget.objects.filter(is_active=True).select_related("employee__user")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return GoalTargetCreateSerializer
        if self.action in ("update", "partial_update"):
            return GoalTargetUpdateSerializer
        return GoalTargetSerializer

    @action(detail=True, methods=["post"], url_path="achieve")
    def achieve(self, request: Request, pk: str | None = None) -> Response:
        """Marca meta como atingida — gera Bonus automaticamente se employee."""
        goal = GoalService.achieve_goal(
            goal_id=str(pk), created_by_id=str(request.user.id)
        )
        logger.info("Goal achieved: %s", pk)
        return Response(GoalTargetSerializer(goal, context={"request": request}).data)


class AllowanceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Vales e benefícios — fluxo solicitação→aprovação→pagamento."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {"status": ["exact"], "allowance_type": ["exact"]}

    def get_permissions(self) -> list[Any]:
        if self.action in ["approve", "pay"]:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> Any:
        qs = Allowance.objects.filter(is_active=True).select_related("employee__user", "approved_by")
        # Nested em employee
        if "employee_pk" in self.kwargs:
            qs = qs.filter(employee_id=self.kwargs["employee_pk"])
        return qs.order_by("-reference_month")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return AllowanceCreateSerializer
        return AllowanceSerializer

    def perform_create(self, serializer: AllowanceCreateSerializer) -> None:
        employee_pk = self.kwargs.get("employee_pk")
        if employee_pk:
            serializer.save(employee_id=employee_pk)
        else:
            serializer.save()

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        """Gestor aprova solicitação de vale."""
        allowance = AllowanceService.approve_allowance(
            allowance_id=str(pk), approved_by_id=str(request.user.id)
        )
        return Response(AllowanceSerializer(allowance, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def pay(self, request: Request, pk: str | None = None) -> Response:
        """Marca vale como pago — opcionalmente vincula recibo."""
        receipt_key = request.data.get("receipt_file_key", "")
        allowance = AllowanceService.mark_as_paid(
            allowance_id=str(pk),
            receipt_file_key=receipt_key,
            paid_by_id=str(request.user.id),
        )
        return Response(AllowanceSerializer(allowance, context={"request": request}).data)


class DeductionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """Descontos — nested em /employees/{id}/deductions/."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self) -> Any:
        return Deduction.objects.filter(
            employee_id=self.kwargs["employee_pk"], is_active=True
        ).order_by("-reference_month")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return DeductionCreateSerializer
        return DeductionSerializer

    def perform_create(self, serializer: DeductionCreateSerializer) -> None:
        serializer.save(employee_id=self.kwargs["employee_pk"])


class TimeClockViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Registro de ponto — sequência validada pelo TimeClockService."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list[Any]:
        if self.action in ["approve"]:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> Any:
        return TimeClockEntry.objects.filter(is_active=True).select_related("employee__user")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return TimeClockRegisterSerializer
        return TimeClockEntrySerializer

    def perform_create(self, serializer: TimeClockRegisterSerializer) -> None:
        data = serializer.validated_data
        TimeClockService.register_clock(
            employee_id=str(data["employee"].id),
            entry_type=data["entry_type"],
            source=data.get("source", TimeClockEntry.Source.SYSTEM),
            ip_address=self.request.META.get("REMOTE_ADDR"),
            device_info=data.get("device_info", ""),
            justification=data.get("justification", ""),
        )

    @action(detail=False, methods=["get"], url_path="daily/(?P<day>[0-9-]+)")
    def daily(self, request: Request, day: str | None = None) -> Response:
        """Espelho de ponto do dia para o colaborador autenticado."""
        from datetime import date as date_type
        target_date = date_type.fromisoformat(day or date_type.today().isoformat())
        employee = getattr(request.user, "employee_profile", None)
        if not employee:
            return Response({"detail": "Usuário não é colaborador."}, status=status.HTTP_400_BAD_REQUEST)
        summary = TimeClockService.get_daily_summary(str(employee.id), target_date)
        return Response(summary)

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        """Gestor aprova ajuste manual de ponto."""
        entry = TimeClockService.approve_entry(
            entry_id=str(pk), approved_by_id=str(request.user.id)
        )
        return Response(TimeClockEntrySerializer(entry, context={"request": request}).data)


class WorkScheduleViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """Escala semanal — nested em /employees/{id}/schedules/."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = WorkScheduleSerializer

    def get_queryset(self) -> Any:
        return WorkSchedule.objects.filter(
            employee_id=self.kwargs["employee_pk"], is_active=True
        ).order_by("weekday")

    def perform_create(self, serializer: WorkScheduleSerializer) -> None:
        serializer.save(employee_id=self.kwargs["employee_pk"])


class PayslipViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Contracheques — geração, fechamento e PDF."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]
    serializer_class = PayslipSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {"is_closed": ["exact"]}

    def get_queryset(self) -> Any:
        return Payslip.objects.filter(is_active=True).select_related("employee__user")

    @action(detail=False, methods=["post"])
    def generate(self, request: Request) -> Response:
        """Gera/atualiza contracheque do mês para um colaborador."""
        serializer = PayslipGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payslip = PayslipService.generate_payslip(
            employee_id=str(data["employee"].id),
            reference_month=data["reference_month"],
        )
        return Response(
            PayslipSerializer(payslip, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def close(self, request: Request, pk: str | None = None) -> Response:
        """Fecha contracheque — torna imutável e gera PDF assíncrono."""
        payslip = PayslipService.close_payslip(
            payslip_id=str(pk), closed_by_id=str(request.user.id)
        )
        return Response(PayslipSerializer(payslip, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request: Request, pk: str | None = None) -> Response:
        """
        GET /hr/payslips/{id}/pdf/
        Retorna URL presignada S3 válida por 15 minutos para download do contracheque.
        Retorna 404 se o PDF ainda não foi gerado (fechamento ainda em processamento).
        """
        payslip = self.get_object()
        if not payslip.pdf_file_key:
            return Response(
                {"detail": "PDF ainda não gerado. Aguarde o processamento."},
                status=status.HTTP_404_NOT_FOUND,
            )
        url = _generate_presigned_url(payslip.pdf_file_key, expiration=900)
        return Response({"url": url})
