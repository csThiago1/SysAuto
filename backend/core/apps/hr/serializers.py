"""
Paddock Solutions — HR Serializers
Sprint 5: Employee, EmployeeDocument, SalaryHistory.
Sprint 6: Bonus, GoalTarget, Allowance, Deduction, TimeClockEntry, WorkSchedule, Payslip.
"""
import hashlib
import logging
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.authentication.models import GlobalUser
from apps.authentication.permissions import _get_role
from apps.persons.models import Person, PersonRole

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

logger = logging.getLogger(__name__)


# ── Auxiliar ──────────────────────────────────────────────────────────────────


class UserMinimalSerializer(serializers.ModelSerializer):
    """Representação mínima de GlobalUser — sem dados LGPD."""

    class Meta:
        model = GlobalUser
        fields = ["id", "name", "email_hash"]
        read_only_fields = ["id", "name", "email_hash"]


# ── Employee ──────────────────────────────────────────────────────────────────


class EmployeeListSerializer(serializers.ModelSerializer):
    """Serializer de listagem — dados não-sensíveis para tabelas e kanban."""

    user = UserMinimalSerializer(read_only=True)
    department_display = serializers.CharField(
        source="get_department_display", read_only=True
    )
    position_display = serializers.CharField(
        source="get_position_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    contract_type_display = serializers.CharField(
        source="get_contract_type_display", read_only=True
    )

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "registration_number",
            "department",
            "department_display",
            "position",
            "position_display",
            "status",
            "status_display",
            "contract_type",
            "contract_type_display",
            "hire_date",
            "tenure_days",
            "pay_frequency",
        ]
        read_only_fields = fields


class EmployeeDetailSerializer(serializers.ModelSerializer):
    """Serializer de detalhe — dados completos. CPF mascarado (LGPD)."""

    user = UserMinimalSerializer(read_only=True)
    department_display = serializers.CharField(
        source="get_department_display", read_only=True
    )
    position_display = serializers.CharField(
        source="get_position_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    contract_type_display = serializers.CharField(
        source="get_contract_type_display", read_only=True
    )
    cpf_masked = serializers.SerializerMethodField()
    rg = serializers.SerializerMethodField()
    mother_name = serializers.SerializerMethodField()
    father_name = serializers.SerializerMethodField()

    def _is_manager_or_above(self) -> bool:
        request = self.context.get("request")
        if not request:
            return False
        return _get_role(request) in ("MANAGER", "ADMIN", "OWNER")

    def get_cpf_masked(self, obj: Employee) -> str:
        """Retorna CPF parcialmente mascarado — LGPD: nunca expor em claro."""
        cpf = obj.cpf
        if cpf and len(cpf) >= 5:
            return f"{cpf[:3]}****{cpf[-2:]}"
        return "***"

    def get_rg(self, obj: Employee) -> str | None:
        return obj.rg if self._is_manager_or_above() else None

    def get_mother_name(self, obj: Employee) -> str | None:
        return obj.mother_name if self._is_manager_or_above() else None

    def get_father_name(self, obj: Employee) -> str | None:
        return obj.father_name if self._is_manager_or_above() else None

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "registration_number",
            "department",
            "department_display",
            "position",
            "position_display",
            "status",
            "status_display",
            "contract_type",
            "contract_type_display",
            "hire_date",
            "termination_date",
            "tenure_days",
            "cpf_masked",
            "rg_issuer",
            "birth_date",
            "marital_status",
            "education_level",
            "nationality",
            "rg",
            "mother_name",
            "father_name",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "bank_name",
            "bank_agency",
            "bank_account",
            "bank_account_type",
            "address_street",
            "address_number",
            "address_complement",
            "address_neighborhood",
            "address_city",
            "address_state",
            "address_zip",
            "base_salary",
            "pix_key_type",
            "weekly_hours",
            "work_schedule",
            "pay_frequency",
            "legacy_databox_id",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "tenure_days",
            "cpf_masked",
            "rg",
            "mother_name",
            "father_name",
            "is_active",
            "created_at",
            "updated_at",
        ]


class EmployeeCreateSerializer(serializers.ModelSerializer):
    """
    Admissão de colaborador.

    Aceita ``name`` + ``email`` em vez do UUID do GlobalUser —
    cria ou localiza o GlobalUser automaticamente via email_hash.
    Retorna ``id`` para o frontend redirecionar ao detalhe.
    """

    # Identificação — substituem o campo 'user' no input
    name = serializers.CharField(max_length=200, write_only=True)
    email = serializers.EmailField(write_only=True)

    # Campos LGPD: write_only — nunca retornados na resposta
    cpf = serializers.CharField(max_length=11, write_only=True, required=False, allow_blank=True)
    rg = serializers.CharField(max_length=20, write_only=True, required=False, allow_blank=True)
    mother_name = serializers.CharField(
        max_length=200, write_only=True, required=False, allow_blank=True
    )
    father_name = serializers.CharField(
        max_length=200, write_only=True, required=False, allow_blank=True
    )
    personal_email = serializers.CharField(
        max_length=200, write_only=True, required=False, allow_blank=True
    )
    personal_phone = serializers.CharField(
        max_length=20, write_only=True, required=False, allow_blank=True
    )
    emergency_contact_phone = serializers.CharField(
        max_length=20, write_only=True, required=False, allow_blank=True
    )
    pix_key = serializers.CharField(
        max_length=100, write_only=True, required=False, allow_blank=True
    )

    def validate_email(self, value: str) -> str:
        """Normaliza e verifica se o e-mail já possui colaborador ativo."""
        email_norm = value.lower().strip()
        email_hash = hashlib.sha256(email_norm.encode()).hexdigest()
        existing = GlobalUser.objects.filter(email_hash=email_hash).first()
        if existing and Employee.objects.filter(user=existing, is_active=True).exists():
            raise serializers.ValidationError(
                "Este e-mail já possui um perfil de colaborador ativo."
            )
        return email_norm

    def validate_cpf(self, value: str) -> str:
        """Valida e normaliza CPF — verifica duplicidade via hash."""
        digits = "".join(c for c in value if c.isdigit())
        if digits and len(digits) != 11:
            raise serializers.ValidationError("CPF deve ter 11 dígitos.")
        if digits:
            cpf_hash = hashlib.sha256(digits.encode()).hexdigest()
            if Employee.objects.filter(cpf_hash=cpf_hash).exists():
                raise serializers.ValidationError("CPF já cadastrado.")
        return digits

    def validate_base_salary(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError("Salário base não pode ser negativo.")
        return value

    def create(self, validated_data: dict) -> "Employee":
        """Cria ou localiza GlobalUser pelo e-mail e admite o colaborador.

        Usa transaction.atomic() para evitar race condition ao criar GlobalUser
        concorrentemente (unique constraint em email_hash).
        """
        name: str = validated_data.pop("name")
        email: str = validated_data.pop("email")
        # email já normalizado por validate_email() — hash consistente
        email_hash = hashlib.sha256(email.encode()).hexdigest()

        with transaction.atomic():
            user, created = GlobalUser.objects.get_or_create(
                email_hash=email_hash,
                defaults={"name": name, "email": email},
            )
            if not created and user.name != name:
                # Atualiza o nome se o GlobalUser já existia com nome diferente
                user.name = name
                user.save(update_fields=["name", "updated_at"])

            logger.info(
                "Employee onboarding: GlobalUser %s (%s)",
                user.pk,
                "created" if created else "existing",
            )

            # Cria Person (PF) com role EMPLOYEE e vincula ao colaborador
            person = Person.objects.create(
                person_kind="PF",
                full_name=name,
            )
            PersonRole.objects.create(person=person, role="EMPLOYEE")

            return Employee.objects.create(user=user, person=person, **validated_data)

    class Meta:
        model = Employee
        fields = [
            "id",               # read_only — para redirect pós-criação
            "name",             # write_only — GlobalUser.name
            "email",            # write_only — GlobalUser.email (chave de busca)
            "department",
            "position",
            "registration_number",
            "contract_type",
            "hire_date",
            "cpf",
            "rg",
            "mother_name",
            "father_name",
            "personal_email",
            "personal_phone",
            "birth_date",
            "marital_status",
            "education_level",
            "nationality",
            "emergency_contact_name",
            "emergency_contact_phone",
            "address_street",
            "address_number",
            "address_complement",
            "address_neighborhood",
            "address_city",
            "address_state",
            "address_zip",
            "base_salary",
            "pix_key",
            "pix_key_type",
            "weekly_hours",
            "work_schedule",
            "pay_frequency",
            "legacy_databox_id",
        ]
        read_only_fields = ["id"]


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    """Serializer de atualização — não permite alterar user nem matrícula."""

    def validate_base_salary(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError("Salário base não pode ser negativo.")
        return value

    class Meta:
        model = Employee
        fields = [
            "department",
            "position",
            "contract_type",
            "rg_issuer",
            "birth_date",
            "marital_status",
            "education_level",
            "nationality",
            "emergency_contact_name",
            "address_street",
            "address_number",
            "address_complement",
            "address_neighborhood",
            "address_city",
            "address_state",
            "address_zip",
            "base_salary",
            "pix_key_type",
            "weekly_hours",
            "work_schedule",
            "pay_frequency",
        ]


# ── EmployeeDocument ──────────────────────────────────────────────────────────


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    """Serializer de documento — sem expor document_number em claro."""

    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True
    )
    employee_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = EmployeeDocument
        fields = [
            "id",
            "employee_id",
            "document_type",
            "document_type_display",
            "file_key",
            "file_name",
            "file_size",
            "mime_type",
            "issue_date",
            "expiry_date",
            "notes",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "employee_id", "is_active", "created_at"]


# ── SalaryHistory ─────────────────────────────────────────────────────────────


class SalaryHistorySerializer(serializers.ModelSerializer):
    """Leitura do histórico de reajustes."""

    authorized_by_name = serializers.SerializerMethodField()

    def get_authorized_by_name(self, obj: SalaryHistory) -> str:
        if obj.authorized_by:
            return obj.authorized_by.get_full_name()
        return ""

    class Meta:
        model = SalaryHistory
        fields = [
            "id",
            "employee",
            "previous_salary",
            "new_salary",
            "effective_date",
            "reason",
            "authorized_by",
            "authorized_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "authorized_by",
            "authorized_by_name",
            "created_at",
        ]


class SalaryHistoryCreateSerializer(serializers.ModelSerializer):
    """Criação de reajuste — injeta employee e authorized_by na view."""

    def validate_new_salary(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Novo salário deve ser positivo.")
        return value

    class Meta:
        model = SalaryHistory
        fields = ["previous_salary", "new_salary", "effective_date", "reason"]


# ── Sprint 6 Serializers ──────────────────────────────────────────────────────


class BonusSerializer(serializers.ModelSerializer):
    bonus_type_display = serializers.CharField(source="get_bonus_type_display", read_only=True)

    class Meta:
        model = Bonus
        fields = [
            "id", "employee", "bonus_type", "bonus_type_display",
            "description", "amount", "reference_month",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "employee", "is_active", "created_at"]


class BonusCreateSerializer(serializers.ModelSerializer):
    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Valor da bonificação deve ser positivo.")
        return value

    class Meta:
        model = Bonus
        fields = ["bonus_type", "description", "amount", "reference_month"]


class GoalTargetSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    progress_pct = serializers.SerializerMethodField()

    def get_progress_pct(self, obj: GoalTarget) -> float:
        if obj.target_value and obj.target_value > 0:
            return round(float(obj.current_value / obj.target_value * 100), 1)
        return 0.0

    class Meta:
        model = GoalTarget
        fields = [
            "id", "employee", "department",
            "title", "description", "target_value", "current_value",
            "unit", "bonus_amount", "start_date", "end_date",
            "status", "status_display", "progress_pct",
            "linked_bonus", "is_recurring", "recurrence_day", "parent_goal",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "linked_bonus"]


class GoalTargetCreateSerializer(serializers.ModelSerializer):
    def validate(self, data: dict) -> dict:
        employee = data.get("employee")
        department = data.get("department")
        if employee and department:
            raise serializers.ValidationError(
                "Meta deve ser de um colaborador OU de um setor — não ambos."
            )
        if not employee and not department:
            raise serializers.ValidationError(
                "Meta deve ter um colaborador ou um setor."
            )
        return data

    class Meta:
        model = GoalTarget
        fields = [
            "employee", "department", "title", "description",
            "target_value", "unit", "bonus_amount",
            "start_date", "end_date",
            "is_recurring", "recurrence_day",
        ]


class GoalTargetUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalTarget
        fields = ["current_value", "status", "description", "is_recurring", "recurrence_day"]


class AllowanceSerializer(serializers.ModelSerializer):
    allowance_type_display = serializers.CharField(
        source="get_allowance_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    def get_approved_by_name(self, obj: Allowance) -> str:
        if obj.approved_by:
            return obj.approved_by.get_full_name()
        return ""

    class Meta:
        model = Allowance
        fields = [
            "id", "employee", "allowance_type", "allowance_type_display",
            "amount", "reference_month",
            "status", "status_display",
            "approved_by", "approved_by_name", "approved_at",
            "paid_at", "receipt_file_key",
            "notes", "is_recurring", "is_active", "created_at",
        ]
        read_only_fields = [
            "id", "status", "approved_by", "approved_by_name",
            "approved_at", "paid_at", "is_active", "created_at",
        ]


class AllowanceCreateSerializer(serializers.ModelSerializer):
    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Valor do vale deve ser positivo.")
        return value

    class Meta:
        model = Allowance
        fields = ["employee", "allowance_type", "amount", "reference_month", "notes", "is_recurring"]


class DeductionSerializer(serializers.ModelSerializer):
    deduction_type_display = serializers.CharField(
        source="get_deduction_type_display", read_only=True
    )

    class Meta:
        model = Deduction
        fields = [
            "id", "employee", "deduction_type", "deduction_type_display",
            "description", "amount", "discount_type", "rate", "reference_month",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "employee", "is_active", "created_at"]


class DeductionCreateSerializer(serializers.ModelSerializer):
    def validate(self, attrs: dict) -> dict:
        discount_type = attrs.get("discount_type", "fixed")
        amount = attrs.get("amount")
        rate = attrs.get("rate")
        if discount_type == "fixed":
            if amount is None or amount <= 0:
                raise serializers.ValidationError({"amount": "Informe um valor positivo para desconto fixo."})
        else:  # percentage
            if rate is None or not (0 < rate <= 100):
                raise serializers.ValidationError({"rate": "Taxa deve ser entre 0.01 e 100."})
        return attrs

    class Meta:
        model = Deduction
        fields = ["deduction_type", "description", "amount", "discount_type", "rate", "reference_month"]


class TimeClockEntrySerializer(serializers.ModelSerializer):
    entry_type_display = serializers.CharField(source="get_entry_type_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = TimeClockEntry
        fields = [
            "id", "employee",
            "entry_type", "entry_type_display",
            "timestamp",
            "source", "source_display",
            "ip_address", "device_info",
            "is_approved", "approved_by", "approved_at",
            "justification",
            "created_at",
        ]
        read_only_fields = ["id", "timestamp", "ip_address", "is_approved", "approved_by", "approved_at", "created_at"]


class TimeClockRegisterSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(status="active"))
    entry_type = serializers.ChoiceField(choices=TimeClockEntry.EntryType.choices)
    source = serializers.ChoiceField(
        choices=TimeClockEntry.Source.choices,
        default=TimeClockEntry.Source.SYSTEM,
    )
    device_info = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    justification = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class WorkScheduleSerializer(serializers.ModelSerializer):
    weekday_display = serializers.SerializerMethodField()

    def get_weekday_display(self, obj: WorkSchedule) -> str:
        return dict(WorkSchedule.WEEKDAY_CHOICES).get(obj.weekday, str(obj.weekday))

    class Meta:
        model = WorkSchedule
        fields = [
            "id", "employee",
            "weekday", "weekday_display",
            "start_time", "break_start", "break_end", "end_time",
            "is_day_off", "effective_from", "effective_until",
            "created_at",
        ]
        read_only_fields = ["id", "employee", "created_at"]


class PayslipSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    def get_employee_name(self, obj: Payslip) -> str:
        return obj.employee.user.get_full_name()

    class Meta:
        model = Payslip
        fields = [
            "id", "employee", "employee_name", "reference_month",
            "base_salary", "total_bonuses", "total_allowances",
            "total_overtime_hours", "total_overtime_value",
            "total_deductions", "gross_pay", "net_pay",
            "worked_days", "worked_hours", "total_absences", "total_late_minutes",
            "bonus_breakdown", "allowance_breakdown", "deduction_breakdown",
            "is_closed", "closed_at", "closed_by",
            "pdf_file_key", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "employee_name", "is_closed", "closed_at", "closed_by",
            "pdf_file_key", "created_at", "updated_at",
        ]


class PayslipGenerateSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(is_active=True))
    reference_month = serializers.DateField(help_text="Primeiro dia do mês (ex: 2026-04-01)")
