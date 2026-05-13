"""
Paddock Solutions — HR Views
Sprint 5 + Sprint 6.

Regras de negócio ficam em services.py — nunca aqui.
"""
import logging
from datetime import date
from decimal import Decimal
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
from rest_framework.parsers import MultiPartParser
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
    Vacation,
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
    PJPaymentSerializer,
    SalaryHistoryCreateSerializer,
    SalaryHistorySerializer,
    TimeClockRegisterSerializer,
    TimeClockEntrySerializer,
    VacationCreateSerializer,
    VacationSerializer,
    WorkScheduleSerializer,
)
from .services import (
    AllowanceService,
    GoalService,
    PayslipService,
    TimeClockService,
    calculate_termination,
    calculate_vacation,
)

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

    @action(detail=True, methods=["post"], url_path="upload-signature", parser_classes=[MultiPartParser])
    def upload_signature(self, request: Request, pk: str | None = None) -> Response:
        """Upload assinatura digital do funcionário (PNG transparente)."""
        employee = self.get_object()
        file = request.FILES.get("signature_image")
        if not file:
            return Response({"detail": "Campo 'signature_image' é obrigatório."}, status=400)
        if not file.content_type.startswith("image/"):
            return Response({"detail": "Arquivo deve ser uma imagem."}, status=400)
        employee.signature_image = file
        employee.save(update_fields=["signature_image"])
        logger.info("Assinatura atualizada para employee %s", employee.pk)
        serializer = self.get_serializer(employee)
        return Response(serializer.data)

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

        # Calcular verbas rescisórias
        termination_extras = calculate_termination(employee)

        # Desativar acesso no Keycloak (se provisionado)
        if employee.user and employee.user.keycloak_id:
            try:
                from apps.authentication.keycloak_admin import disable_keycloak_user
                disable_keycloak_user(str(employee.user.keycloak_id))
            except Exception as exc:
                logger.warning("Keycloak disable failed for %s: %s", pk, exc)

        logger.info("Employee terminated: %s (extras: %s)", pk, termination_extras)
        data = EmployeeDetailSerializer(employee, context={"request": request}).data
        data["termination_extras"] = termination_extras
        return Response(data)

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
            payslip_type=data.get("payslip_type", "regular"),
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


# ── Vacation ─────────────────────────────────────────────────────────────────


class VacationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Férias — agendamento, cálculo e controle de saldo."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list[Any]:
        if self.action in ["create", "complete", "cancel"]:
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> Any:
        qs = Vacation.objects.filter(is_active=True).select_related("employee__user")
        if "employee_pk" in self.kwargs:
            qs = qs.filter(employee_id=self.kwargs["employee_pk"])
        return qs.order_by("-start_date")

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return VacationCreateSerializer
        return VacationSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Cria férias e calcula valores. Retorna VacationSerializer (com valores)."""
        serializer = VacationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.validated_data["employee"]
        vacation = serializer.save(base_salary_snapshot=employee.base_salary)
        calculate_vacation(vacation)
        return Response(
            VacationSerializer(vacation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: str | None = None, **kwargs: Any) -> Response:
        """Marca férias como concluídas."""
        vacation = self.get_object()
        if vacation.status != Vacation.Status.ACTIVE:
            return Response(
                {"detail": "Férias precisam estar em gozo para serem concluídas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        vacation.status = Vacation.Status.COMPLETED
        vacation.save(update_fields=["status", "updated_at"])
        return Response(VacationSerializer(vacation).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str | None = None, **kwargs: Any) -> Response:
        """Cancela férias agendadas."""
        vacation = self.get_object()
        if vacation.status not in (Vacation.Status.SCHEDULED,):
            return Response(
                {"detail": "Só é possível cancelar férias agendadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        vacation.status = Vacation.Status.CANCELLED
        vacation.save(update_fields=["status", "updated_at"])
        return Response(VacationSerializer(vacation).data)

    @action(detail=False, methods=["get"], url_path="balance/(?P<employee_pk>[^/.]+)")
    def balance(self, request: Request, employee_pk: str | None = None, **kwargs: Any) -> Response:
        """Retorna saldo de férias do colaborador."""
        from dateutil.relativedelta import relativedelta

        try:
            emp = Employee.objects.get(id=employee_pk, is_active=True)
        except Employee.DoesNotExist:
            return Response({"detail": "Colaborador não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        today = date.today()
        hire = emp.hire_date

        # Períodos aquisitivos
        periods = []
        period_start = hire
        while period_start < today:
            period_end = period_start + relativedelta(months=12) - relativedelta(days=1)
            # Dias usados nesse período
            used = Vacation.objects.filter(
                employee=emp,
                acquisition_start=period_start,
                status__in=["scheduled", "active", "completed"],
                is_active=True,
            ).values_list("days_taken", flat=True)
            total_used = sum(used)
            is_complete = today > period_end
            is_overdue = is_complete and total_used < 30 and (today - period_end).days > 365

            periods.append({
                "acquisition_start": str(period_start),
                "acquisition_end": str(period_end),
                "is_complete": is_complete,
                "days_entitled": 30,
                "days_used": total_used,
                "days_remaining": max(0, 30 - total_used),
                "is_overdue": is_overdue,
            })
            period_start = period_start + relativedelta(months=12)

        return Response({
            "employee_id": str(emp.id),
            "employee_name": emp.user.get_full_name(),
            "hire_date": str(hire),
            "periods": periods,
        })


# ── PJ Payment ──────────────────────────────────────────────────────────────


class PJPaymentViewSet(GenericViewSet):
    """Pagamento de colaboradores PJ — cria conta a pagar + lançamento contábil."""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]
    serializer_class = PJPaymentSerializer

    @action(detail=False, methods=["post"], url_path="(?P<employee_pk>[^/.]+)")
    @transaction.atomic
    def create_payment(self, request: Request, employee_pk: str | None = None) -> Response:
        """POST /hr/pj-payment/{employee_id}/ — registra pagamento PJ."""
        try:
            employee = Employee.objects.select_related("user").get(
                id=employee_pk, is_active=True
            )
        except Employee.DoesNotExist:
            return Response({"detail": "Colaborador não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if employee.contract_type != "pj":
            return Response(
                {"detail": "Este colaborador não é PJ."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PJPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        amount = data["amount"]
        ref = data["reference_month"].replace(day=1)
        desc = data.get("description") or f"Serviço PJ — {employee.user.get_full_name()}"
        nf_number = data.get("nf_number", "")
        nf_file_key = data.get("nf_file_key", "")

        # Criar conta a pagar
        from apps.accounts_payable.models import PayableDocument, Supplier
        # Reutilizar ou criar fornecedor "Colaboradores DS Car"
        supplier, _ = Supplier.objects.get_or_create(
            name=employee.user.get_full_name(),
            defaults={"notes": f"Colaborador PJ — {employee.registration_number}"},
        )
        due = date(ref.year, ref.month + 1, 5) if ref.month < 12 else date(ref.year + 1, 1, 5)
        payable = PayableDocument.objects.create(
            supplier=supplier,
            description=f"PJ {ref.strftime('%m/%Y')} — {employee.registration_number} — {employee.user.get_full_name()}",
            document_number=nf_number,
            amount=amount,
            due_date=due,
            competence_date=ref,
            status="open",
            origin="FOLHA",
            notes=f"NF: {nf_number}" if nf_number else "",
            created_by=request.user,
        )

        # Tentar contabilizar
        try:
            from apps.hr.accounting_service import HRAccountingService, _resolve_account
            acc_pj = _resolve_account("salary_gross")  # Despesa com PJ
            acc_payable = _resolve_account("payable_net")
            if acc_pj and acc_payable:
                from apps.accounting.services.journal_entry_service import JournalEntryService
                JournalEntryService.create_entry(
                    description=f"Pagamento PJ — {employee.registration_number} — {employee.user.get_full_name()} — {ref.strftime('%m/%Y')}",
                    competence_date=ref,
                    origin="FOLHA",
                    lines=[
                        {"account_id": acc_pj.pk, "debit_amount": amount, "credit_amount": Decimal("0")},
                        {"account_id": acc_payable.pk, "debit_amount": Decimal("0"), "credit_amount": amount},
                    ],
                    user=request.user,
                    auto_approve=True,
                )
        except Exception as exc:
            logger.warning("PJ accounting failed: %s", exc)

        return Response({
            "payable_id": str(payable.pk),
            "description": payable.description,
            "amount": str(amount),
            "due_date": str(payable.due_date),
            "nf_number": nf_number,
        }, status=status.HTTP_201_CREATED)
