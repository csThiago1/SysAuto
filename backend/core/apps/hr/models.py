"""
Paddock Solutions — HR App
Módulo de Gestão de Recursos Humanos — Sprint 5 + Sprint 6

Contexto: ~30 colaboradores, DS Car, escala 6x1.
LGPD: campos sensíveis criptografados via django-encrypted-model-fields.

Models:
  Sprint 5: Employee, EmployeeDocument, SalaryHistory
  Sprint 6: Bonus, GoalTarget, Allowance, Deduction, TimeClockEntry, WorkSchedule, Payslip
"""
import hashlib
import logging

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from encrypted_model_fields.fields import EncryptedCharField

from apps.authentication.models import PaddockBaseModel
from apps.persons.models import CargoPessoa, SetorPessoa

logger = logging.getLogger(__name__)


class Employee(PaddockBaseModel):
    """
    Perfil trabalhista do colaborador — estende GlobalUser com dados de RH.

    Reutiliza SetorPessoa e CargoPessoa de apps.persons (TextChoices).
    Dados pessoais sensíveis armazenados criptografados (LGPD).
    """

    class ContractType(models.TextChoices):
        CLT = "clt", _("CLT")
        PJ = "pj", _("PJ / Prestador")
        INTERN = "intern", _("Estagiário")
        TEMP = "temp", _("Temporário")
        APPRENTICE = "apprentice", _("Jovem Aprendiz")

    class Status(models.TextChoices):
        ACTIVE = "active", _("Ativo")
        ON_LEAVE = "on_leave", _("Afastado")
        VACATION = "vacation", _("Férias")
        TERMINATED = "terminated", _("Desligado")

    class PayFrequency(models.TextChoices):
        MONTHLY  = "monthly",  _("Mensal")
        BIWEEKLY = "biweekly", _("Quinzenal")
        WEEKLY   = "weekly",   _("Semanal")

    # ── Vínculo com entidades existentes ──────────────────────────────────────
    user = models.OneToOneField(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="employee_profile",
        help_text="Conta de acesso ao sistema",
    )
    person = models.ForeignKey(
        "persons.Person",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
        help_text="Pessoa vinculada ao colaborador (criada automaticamente na admissão).",
    )
    # Setor e cargo reutilizam TextChoices de apps.persons — nunca duplicar
    department = models.CharField(
        _("Setor"),
        max_length=30,
        choices=SetorPessoa.choices,
        db_index=True,
    )
    position = models.CharField(
        _("Cargo"),
        max_length=30,
        choices=CargoPessoa.choices,
        db_index=True,
    )

    # ── Dados trabalhistas ────────────────────────────────────────────────────
    registration_number = models.CharField(
        _("Matrícula"), max_length=20, unique=True, db_index=True
    )
    contract_type = models.CharField(
        _("Tipo de contrato"),
        max_length=15,
        choices=ContractType.choices,
        default=ContractType.CLT,
    )
    status = models.CharField(
        _("Status"),
        max_length=15,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    hire_date = models.DateField(_("Data de admissão"))
    termination_date = models.DateField(
        _("Data de desligamento"), null=True, blank=True
    )

    # ── Dados pessoais — LGPD: sempre criptografados ──────────────────────────
    cpf = EncryptedCharField(_("CPF"), max_length=11, blank=True, default="")
    cpf_hash = models.CharField(
        max_length=64,
        db_index=True,
        blank=True,
        default="",
        help_text="SHA-256 do CPF — para lookup sem expor dado bruto",
    )
    rg = models.CharField(_("RG"), max_length=20, blank=True, default="")
    rg_issuer = models.CharField(
        _("Órgão emissor RG"), max_length=20, blank=True, default=""
    )
    birth_date = models.DateField(_("Data de nascimento"), null=True, blank=True)
    mother_name = models.CharField(
        _("Nome da mãe"), max_length=200, blank=True, default=""
    )
    father_name = models.CharField(
        _("Nome do pai"), max_length=200, blank=True, default=""
    )
    marital_status = models.CharField(
        _("Estado civil"), max_length=20, blank=True, default=""
    )
    education_level = models.CharField(
        _("Escolaridade"), max_length=30, blank=True, default=""
    )
    nationality = models.CharField(
        _("Nacionalidade"), max_length=50, default="Brasileira"
    )

    # ── Contato — LGPD ────────────────────────────────────────────────────────
    personal_email = EncryptedCharField(
        _("E-mail pessoal"), max_length=200, blank=True, default=""
    )
    personal_phone = EncryptedCharField(
        _("Telefone pessoal"), max_length=20, blank=True, default=""
    )
    emergency_contact_name = models.CharField(
        _("Contato emergência — nome"), max_length=200, blank=True, default=""
    )
    emergency_contact_phone = EncryptedCharField(
        _("Contato emergência — telefone"), max_length=20, blank=True, default=""
    )
    emergency_contact_relationship = models.CharField(
        _("Contato emergência — parentesco"),
        max_length=50,
        blank=True,
        default="",
        help_text="Ex: Esposa, Pai, Filho",
    )

    # ── Endereço ───────────────────────────────────────────────────────────────
    address_street = models.CharField(
        _("Logradouro"), max_length=300, blank=True, default=""
    )
    address_number = models.CharField(
        _("Número"), max_length=20, blank=True, default=""
    )
    address_complement = models.CharField(
        _("Complemento"), max_length=100, blank=True, default=""
    )
    address_neighborhood = models.CharField(
        _("Bairro"), max_length=100, blank=True, default=""
    )
    address_city = models.CharField(
        _("Cidade"), max_length=100, default="Manaus"
    )
    address_state = models.CharField(
        _("Estado"), max_length=2, default="AM"
    )
    address_zip = models.CharField(
        _("CEP"), max_length=9, blank=True, default=""
    )

    # ── Remuneração ────────────────────────────────────────────────────────────
    base_salary = models.DecimalField(
        _("Salário base"), max_digits=10, decimal_places=2, default=0
    )

    # ── Dados bancários ────────────────────────────────────────────────────────
    bank_name = models.CharField(
        _("Banco"), max_length=100, blank=True, default=""
    )
    bank_agency = models.CharField(
        _("Agência"), max_length=20, blank=True, default=""
    )
    bank_account = models.CharField(
        _("Conta"), max_length=30, blank=True, default=""
    )
    bank_account_type = models.CharField(
        _("Tipo de conta"),
        max_length=15,
        blank=True,
        default="",
        help_text="corrente ou poupanca",
    )

    # ── Pagamento — LGPD ──────────────────────────────────────────────────────
    pix_key = EncryptedCharField(
        _("Chave PIX"), max_length=100, blank=True, default=""
    )
    pix_key_type = models.CharField(
        _("Tipo de chave PIX"),
        max_length=10,
        blank=True,
        default="",
        help_text="cpf | email | phone | random | cnpj",
    )

    # ── Carga horária ─────────────────────────────────────────────────────────
    weekly_hours = models.DecimalField(
        _("Carga horária semanal"), max_digits=4, decimal_places=1, default=44.0
    )
    work_schedule = models.CharField(
        _("Escala"),
        max_length=20,
        default="6x1",
        help_text="6x1 (padrão DS Car), 5x2, 12x36, custom",
    )
    pay_frequency = models.CharField(
        _("Frequência de pagamento"),
        max_length=10,
        choices=PayFrequency.choices,
        default=PayFrequency.MONTHLY,
        help_text="Define o ciclo de pagamento do colaborador.",
    )

    # ── Migração legado ───────────────────────────────────────────────────────
    legacy_databox_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="ID no Box Empresa para rastreabilidade de migração",
    )

    class Meta:
        ordering = ["user__name"]
        indexes = [
            models.Index(fields=["department", "status"]),
            models.Index(fields=["status", "hire_date"]),
        ]
        verbose_name = _("Colaborador")
        verbose_name_plural = _("Colaboradores")

    def __str__(self) -> str:
        return f"{self.registration_number} — {self.user.get_full_name()}"

    @property
    def tenure_days(self) -> int:
        """Dias de empresa — usa termination_date se desligado, caso contrário hoje."""
        end = self.termination_date or timezone.now().date()
        return (end - self.hire_date).days

    def save(self, *args: object, **kwargs: object) -> None:
        """Gera cpf_hash automaticamente para lookup sem expor CPF em claro."""
        if self.cpf:
            self.cpf_hash = hashlib.sha256(self.cpf.encode()).hexdigest()
        super().save(*args, **kwargs)


class EmployeeDocument(PaddockBaseModel):
    """
    Documentos digitalizados do colaborador — armazenados no R2/S3, nunca no banco.

    Política de retenção: soft delete apenas — arquivo S3 NUNCA deletado fisicamente.
    São evidência trabalhista (CTPS, contratos) e documentos legais.
    """

    class DocumentType(models.TextChoices):
        CNH = "cnh", _("CNH")
        RG = "rg", _("RG")
        BIRTH_CERTIFICATE = "birth_cert", _("Certidão de Nascimento")
        MARRIAGE_CERTIFICATE = "marriage_cert", _("Certidão de Casamento")
        WORK_CARD = "work_card", _("Carteira de Trabalho (CTPS)")
        VOTER_ID = "voter_id", _("Título de Eleitor")
        MILITARY_CERT = "military_cert", _("Certificado de Reservista")
        SCHOOL_CERT = "school_cert", _("Certificado Escolar")
        MEDICAL_EXAM = "medical_exam", _("Atestado / Exame Médico")
        CONTRACT = "contract", _("Contrato de Trabalho")
        OTHER = "other", _("Outro")

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    document_type = models.CharField(
        _("Tipo de documento"),
        max_length=20,
        choices=DocumentType.choices,
        db_index=True,
    )
    document_number = EncryptedCharField(
        _("Número do documento"), max_length=50, blank=True, default=""
    )
    file_key = models.CharField(
        _("Chave no storage"),
        max_length=500,
        help_text="Chave do arquivo no R2/S3 — NUNCA deletar fisicamente",
    )
    file_name = models.CharField(_("Nome do arquivo"), max_length=255)
    file_size = models.PositiveIntegerField(
        _("Tamanho"), help_text="Tamanho em bytes"
    )
    mime_type = models.CharField(
        _("Tipo MIME"), max_length=100, default="application/pdf"
    )
    issue_date = models.DateField(_("Data de emissão"), null=True, blank=True)
    expiry_date = models.DateField(_("Data de validade"), null=True, blank=True)
    notes = models.TextField(_("Observações"), blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["employee", "document_type"]),
        ]
        verbose_name = _("Documento do Colaborador")
        verbose_name_plural = _("Documentos dos Colaboradores")

    def __str__(self) -> str:
        return f"{self.get_document_type_display()} — {self.employee}"


class SalaryHistory(PaddockBaseModel):
    """
    Histórico de reajuste salarial — cada reajuste gera um registro imutável.

    Após criação, não deve ser editado. Correções via novo reajuste.
    """

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.CASCADE,
        related_name="salary_history",
    )
    previous_salary = models.DecimalField(
        _("Salário anterior"), max_digits=10, decimal_places=2
    )
    new_salary = models.DecimalField(
        _("Novo salário"), max_digits=10, decimal_places=2
    )
    effective_date = models.DateField(_("Data de vigência"), db_index=True)
    reason = models.CharField(
        _("Motivo"),
        max_length=300,
        blank=True,
        default="",
        help_text="Promoção, dissídio, mérito, etc.",
    )
    authorized_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="salary_authorizations",
    )

    class Meta:
        ordering = ["-effective_date"]
        indexes = [
            models.Index(fields=["employee", "effective_date"]),
        ]
        verbose_name = _("Histórico de Salário")
        verbose_name_plural = _("Históricos de Salário")

    def __str__(self) -> str:
        return f"{self.employee} → R$ {self.new_salary} ({self.effective_date})"


# ── Sprint 6 Models ───────────────────────────────────────────────────────────


class Bonus(PaddockBaseModel):
    """
    Bonificações pontuais ou recorrentes — separadas do salário base.

    Meta atingida gera Bonus automaticamente via GoalTarget.achieve().
    """

    class BonusType(models.TextChoices):
        PERFORMANCE = "performance", _("Desempenho")
        GOAL = "goal", _("Meta Atingida")
        COMMISSION = "commission", _("Comissão")
        GRATIFICATION = "gratification", _("Gratificação")
        PROFIT_SHARING = "profit_sharing", _("PLR")
        OTHER = "other", _("Outro")

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="bonuses"
    )
    bonus_type = models.CharField(
        max_length=20, choices=BonusType.choices, db_index=True
    )
    description = models.CharField(_("Descrição"), max_length=300)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reference_month = models.DateField(
        _("Mês de referência"),
        db_index=True,
        help_text="Primeiro dia do mês (ex: 2026-04-01)",
    )

    class Meta:
        ordering = ["-reference_month"]
        indexes = [
            models.Index(fields=["employee", "reference_month"]),
            models.Index(fields=["bonus_type", "reference_month"]),
        ]
        verbose_name = _("Bonificação")
        verbose_name_plural = _("Bonificações")

    def __str__(self) -> str:
        return f"{self.get_bonus_type_display()} — {self.employee} — R$ {self.amount}"


class GoalTarget(PaddockBaseModel):
    """
    Metas individuais ou por setor — vinculadas a bonificação.

    Constraint: meta deve ser de UM colaborador OU de UM setor (nunca ambos/nenhum).
    Ao atingir (status=ACHIEVED), gera Bonus automaticamente.
    """

    class GoalStatus(models.TextChoices):
        ACTIVE = "active", _("Em andamento")
        ACHIEVED = "achieved", _("Atingida")
        PARTIALLY = "partially", _("Parcialmente atingida")
        MISSED = "missed", _("Não atingida")
        CANCELLED = "cancelled", _("Cancelada")

    employee = models.ForeignKey(
        "Employee",
        on_delete=models.CASCADE,
        related_name="goals",
        null=True,
        blank=True,
        help_text="Null = meta de setor",
    )
    department = models.CharField(
        _("Setor"),
        max_length=30,
        choices=SetorPessoa.choices,
        null=True,
        blank=True,
        db_index=True,
        help_text="Preenchido quando meta é do setor inteiro",
    )
    title = models.CharField(_("Título"), max_length=200)
    description = models.TextField(_("Descrição"), blank=True, default="")
    target_value = models.DecimalField(
        _("Valor alvo"),
        max_digits=12,
        decimal_places=2,
        help_text="Quantidade, R$, percentual, etc.",
    )
    current_value = models.DecimalField(
        _("Valor atual"), max_digits=12, decimal_places=2, default=0
    )
    unit = models.CharField(
        _("Unidade"),
        max_length=20,
        default="unit",
        help_text="unit | currency | percentage | hours",
    )
    bonus_amount = models.DecimalField(
        _("Bônus ao atingir"),
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Valor da bonificação ao atingir 100%",
    )
    start_date = models.DateField(_("Início"))
    end_date = models.DateField(_("Prazo"))
    status = models.CharField(
        max_length=15,
        choices=GoalStatus.choices,
        default=GoalStatus.ACTIVE,
        db_index=True,
    )
    linked_bonus = models.OneToOneField(
        "Bonus",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goal_origin",
        help_text="Bônus gerado automaticamente ao atingir a meta",
    )
    is_recurring = models.BooleanField(
        _("Meta recorrente"),
        default=False,
        help_text="Se True, será clonada automaticamente no próximo ciclo mensal.",
    )
    recurrence_day = models.IntegerField(
        _("Dia de reinício"),
        default=1,
        help_text="Dia do mês para criar a próxima instância (1-28).",
    )
    parent_goal = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recurrences",
        help_text="Meta original que gerou esta instância recorrente.",
    )

    class Meta:
        ordering = ["-end_date"]
        indexes = [
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["department", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(employee__isnull=False, department__isnull=True)
                    | models.Q(employee__isnull=True, department__isnull=False)
                ),
                name="goal_must_be_employee_or_department",
            ),
        ]
        verbose_name = _("Meta")
        verbose_name_plural = _("Metas")

    def __str__(self) -> str:
        target = self.employee or f"Setor {self.department}"
        return f"{self.title} — {target}"


class Allowance(PaddockBaseModel):
    """
    Vales e benefícios — fluxo obrigatório: requested → approved → paid.

    Nunca pular etapas. Vale recorrente (is_recurring=True) é gerado
    automaticamente no 1º dia útil do mês via Celery task.
    """

    class AllowanceType(models.TextChoices):
        FOOD = "food", _("Vale Alimentação")
        MEAL = "meal", _("Vale Refeição")
        TRANSPORT = "transport", _("Vale Transporte")
        FUEL = "fuel", _("Auxílio Combustível")
        HEALTH = "health", _("Plano de Saúde")
        DENTAL = "dental", _("Plano Odontológico")
        OTHER = "other", _("Outro")

    class AllowanceStatus(models.TextChoices):
        REQUESTED = "requested", _("Solicitado")
        APPROVED = "approved", _("Aprovado")
        REJECTED = "rejected", _("Rejeitado")
        PAID = "paid", _("Pago")

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="allowances"
    )
    allowance_type = models.CharField(
        max_length=15, choices=AllowanceType.choices, db_index=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reference_month = models.DateField(
        _("Mês de referência"),
        db_index=True,
        help_text="Primeiro dia do mês (ex: 2026-04-01)",
    )
    status = models.CharField(
        max_length=15,
        choices=AllowanceStatus.choices,
        default=AllowanceStatus.REQUESTED,
        db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_allowances",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    receipt_file_key = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Recibo assinado no R2/S3 — gerado ao pagar",
    )
    notes = models.TextField(blank=True, default="")
    is_recurring = models.BooleanField(
        default=True,
        help_text="Se True, gera automaticamente nos próximos meses",
    )

    class Meta:
        ordering = ["-reference_month"]
        indexes = [
            models.Index(fields=["employee", "reference_month"]),
            models.Index(fields=["allowance_type", "status"]),
        ]
        verbose_name = _("Vale / Benefício")
        verbose_name_plural = _("Vales / Benefícios")

    def __str__(self) -> str:
        return f"{self.get_allowance_type_display()} — {self.employee} — {self.status}"


class Deduction(PaddockBaseModel):
    """
    Descontos na folha — faltas, atrasos, adiantamentos, INSS, IRRF, etc.

    amount é sempre positivo — o sinal de desconto é dado pelo tipo.
    """

    class DeductionType(models.TextChoices):
        ABSENCE = "absence", _("Falta")
        LATE = "late", _("Atraso")
        ADVANCE = "advance", _("Adiantamento")
        LOAN = "loan", _("Empréstimo Consignado")
        DAMAGE = "damage", _("Dano/Prejuízo")
        INSS = "inss", _("INSS")
        IRRF = "irrf", _("IRRF")
        UNION_FEE = "union_fee", _("Contribuição Sindical")
        OTHER = "other", _("Outro")

    class DiscountType(models.TextChoices):
        FIXED      = "fixed",      _("Valor Fixo")
        PERCENTAGE = "percentage", _("Percentual do Salário")

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="deductions"
    )
    deduction_type = models.CharField(
        max_length=15, choices=DeductionType.choices, db_index=True
    )
    description = models.CharField(_("Descrição"), max_length=300, blank=True, default="")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Sempre positivo — o sinal é dado pelo tipo (desconto)",
    )
    discount_type = models.CharField(
        _("Tipo de desconto"),
        max_length=12,
        choices=DiscountType.choices,
        default=DiscountType.FIXED,
    )
    rate = models.DecimalField(
        _("Percentual"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Usado quando discount_type=percentage. Ex: 11.0 = 11% do salário base.",
    )
    reference_month = models.DateField(_("Mês de referência"), db_index=True)

    class Meta:
        ordering = ["-reference_month"]
        indexes = [
            models.Index(fields=["employee", "reference_month"]),
            models.Index(fields=["deduction_type", "reference_month"]),
        ]
        verbose_name = _("Desconto")
        verbose_name_plural = _("Descontos")

    def __str__(self) -> str:
        return f"{self.get_deduction_type_display()} — {self.employee} — R$ {self.amount}"


class TimeClockEntry(PaddockBaseModel):
    """
    Registro de ponto — imutável após aprovação do gestor.

    Sequência válida por dia:
      clock_in → break_start → break_end → clock_out
      (break pode ocorrer múltiplas vezes)

    INTEGRAÇÃO BIOMÉTRICA: bloqueada até implementação física.
    source='biometric' retorna erro amigável.
    """

    class EntryType(models.TextChoices):
        CLOCK_IN = "clock_in", _("Entrada")
        BREAK_START = "break_start", _("Início Intervalo")
        BREAK_END = "break_end", _("Fim Intervalo")
        CLOCK_OUT = "clock_out", _("Saída")

    class Source(models.TextChoices):
        SYSTEM = "system", _("Sistema Web")
        MOBILE = "mobile", _("App Mobile")
        MANUAL = "manual", _("Ajuste Manual")
        BIOMETRIC = "biometric", _("Biométrico (Em breve)")

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="time_entries"
    )
    entry_type = models.CharField(
        _("Tipo"), max_length=15, choices=EntryType.choices
    )
    timestamp = models.DateTimeField(_("Data/Hora"), db_index=True)
    source = models.CharField(
        max_length=15, choices=Source.choices, default=Source.SYSTEM
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.CharField(max_length=300, blank=True, default="")
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_time_entries",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    justification = models.TextField(
        blank=True,
        default="",
        help_text="Obrigatório para ajuste manual",
    )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["employee", "timestamp"]),
            models.Index(fields=["employee", "is_approved"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(source="manual", justification=""),
                name="manual_entry_requires_justification",
            ),
        ]
        verbose_name = _("Registro de Ponto")
        verbose_name_plural = _("Registros de Ponto")

    def __str__(self) -> str:
        return f"{self.get_entry_type_display()} — {self.employee} — {self.timestamp}"


class WorkSchedule(PaddockBaseModel):
    """
    Escala semanal do colaborador.

    Padrão DS Car (6x1):
      Seg–Sex: 08:00–12:00, 13:00–17:00
      Sáb:     08:00–12:00
      Dom:     Folga (is_day_off=True)
    """

    WEEKDAY_CHOICES = [
        (0, "Segunda-feira"),
        (1, "Terça-feira"),
        (2, "Quarta-feira"),
        (3, "Quinta-feira"),
        (4, "Sexta-feira"),
        (5, "Sábado"),
        (6, "Domingo"),
    ]

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="schedules"
    )
    weekday = models.IntegerField(_("Dia da semana"), choices=WEEKDAY_CHOICES)
    start_time = models.TimeField(_("Entrada"), null=True, blank=True)
    break_start = models.TimeField(_("Início intervalo"), null=True, blank=True)
    break_end = models.TimeField(_("Fim intervalo"), null=True, blank=True)
    end_time = models.TimeField(_("Saída"), null=True, blank=True)
    is_day_off = models.BooleanField(_("Folga"), default=False)
    effective_from = models.DateField(_("Vigente a partir de"), db_index=True)
    effective_until = models.DateField(
        _("Vigente até"), null=True, blank=True
    )

    class Meta:
        ordering = ["employee", "effective_from", "weekday"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "weekday", "effective_from"],
                name="unique_schedule_per_day",
            ),
        ]
        verbose_name = _("Escala de Trabalho")
        verbose_name_plural = _("Escalas de Trabalho")

    def __str__(self) -> str:
        day = dict(self.WEEKDAY_CHOICES).get(self.weekday, str(self.weekday))
        if self.is_day_off:
            return f"{self.employee} — {day}: Folga"
        return f"{self.employee} — {day}: {self.start_time}–{self.end_time}"


class Payslip(PaddockBaseModel):
    """
    Contracheque mensal — snapshot imutável gerado pelo fechamento da folha.

    Fórmula: salário_base + Σ bonificações + Σ vales_pagos
             + horas_extras - Σ descontos = líquido

    Após is_closed=True: nenhum campo pode ser alterado.
    Correções exigem lançamento compensatório no mês seguinte.
    """

    employee = models.ForeignKey(
        "Employee", on_delete=models.CASCADE, related_name="payslips"
    )
    reference_month = models.DateField(
        _("Mês de referência"),
        db_index=True,
        help_text="Primeiro dia do mês (ex: 2026-04-01)",
    )

    # ── Componentes do cálculo ────────────────────────────────────────────────
    base_salary = models.DecimalField(
        _("Salário base"), max_digits=10, decimal_places=2
    )
    total_bonuses = models.DecimalField(
        _("Total bonificações"), max_digits=10, decimal_places=2, default=0
    )
    total_allowances = models.DecimalField(
        _("Total vales"), max_digits=10, decimal_places=2, default=0
    )
    total_overtime_hours = models.DecimalField(
        _("Horas extras"), max_digits=6, decimal_places=2, default=0
    )
    total_overtime_value = models.DecimalField(
        _("Valor horas extras"), max_digits=10, decimal_places=2, default=0
    )
    total_deductions = models.DecimalField(
        _("Total descontos"), max_digits=10, decimal_places=2, default=0
    )

    # ── Resultado ─────────────────────────────────────────────────────────────
    gross_pay = models.DecimalField(
        _("Salário bruto"),
        max_digits=10,
        decimal_places=2,
        help_text="base + bonificações + vales + horas extras",
    )
    net_pay = models.DecimalField(
        _("Salário líquido"),
        max_digits=10,
        decimal_places=2,
        help_text="bruto - descontos",
    )

    # ── Dados de ponto do mês ─────────────────────────────────────────────────
    worked_days = models.IntegerField(_("Dias trabalhados"), default=0)
    worked_hours = models.DecimalField(
        _("Horas trabalhadas"), max_digits=6, decimal_places=2, default=0
    )
    total_absences = models.IntegerField(_("Faltas"), default=0)
    total_late_minutes = models.IntegerField(_("Minutos de atraso"), default=0)

    # ── Detalhamento JSON — snapshot dos itens ────────────────────────────────
    bonus_breakdown = models.JSONField(
        default=list,
        help_text='[{"type": "goal", "description": "...", "amount": 500.00}]',
    )
    allowance_breakdown = models.JSONField(
        default=list,
        help_text='[{"type": "food", "amount": 600.00}]',
    )
    deduction_breakdown = models.JSONField(
        default=list,
        help_text='[{"type": "inss", "amount": 150.00}]',
    )

    # ── Controle ──────────────────────────────────────────────────────────────
    is_closed = models.BooleanField(_("Fechado"), default=False, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_payslips",
    )
    pdf_file_key = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="PDF do contracheque no R2/S3",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-reference_month"]
        indexes = [
            models.Index(fields=["reference_month", "is_closed"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "reference_month"],
                name="unique_payslip_per_month",
            ),
        ]
        verbose_name = _("Contracheque")
        verbose_name_plural = _("Contracheques")

    def __str__(self) -> str:
        return f"Contracheque {self.employee} — {self.reference_month} — R$ {self.net_pay}"
