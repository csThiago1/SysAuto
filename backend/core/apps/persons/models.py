"""
Paddock Solutions — Persons App
Entidade unificada de pessoas (tenant-level): clientes, seguradoras, corretores, funcionários, fornecedores.
"""
import logging

from django.db import models

logger = logging.getLogger(__name__)


class RolePessoa(models.TextChoices):
    CLIENTE = "CLIENT", "Cliente"
    SEGURADORA = "INSURER", "Seguradora"
    CORRETOR = "BROKER", "Corretor"
    FUNCIONARIO = "EMPLOYEE", "Funcionário"
    FORNECEDOR = "SUPPLIER", "Fornecedor"


class TipoPessoa(models.TextChoices):
    FISICA = "PF", "Pessoa Física"
    JURIDICA = "PJ", "Pessoa Jurídica"


class TipoContato(models.TextChoices):
    CELULAR = "CELULAR", "Celular"
    COMERCIAL = "COMERCIAL", "Comercial"
    WHATSAPP = "WHATSAPP", "WhatsApp"
    EMAIL = "EMAIL", "E-mail"
    EMAIL_NFE = "EMAIL_NFE", "E-mail NF-e"
    EMAIL_FINANCEIRO = "EMAIL_FINANCEIRO", "E-mail Financeiro"
    SITE = "SITE", "Site"


class TipoEndereco(models.TextChoices):
    PRINCIPAL = "PRINCIPAL", "Principal"
    COBRANCA = "COBRANCA", "Cobrança"
    ENTREGA = "ENTREGA", "Entrega"


class CargoPessoa(models.TextChoices):
    """Cargos operacionais do Grupo DS Car."""
    RECEPTIONIST  = "receptionist",  "Recepcionista"
    CONSULTANT    = "consultant",    "Consultor de Serviços"
    BODYWORKER    = "bodyworker",    "Funileiro"
    PAINTER       = "painter",       "Pintor"
    MECHANIC      = "mechanic",      "Mecânico"
    POLISHER      = "polisher",      "Polidor"
    WASHER        = "washer",        "Lavador"
    STOREKEEPER   = "storekeeper",   "Almoxarife"
    MANAGER       = "manager",       "Gerente"
    FINANCIAL     = "financial",     "Financeiro"
    ADMINISTRATIVE = "administrative", "Administrativo"
    DIRECTOR      = "director",      "Diretor"


class SetorPessoa(models.TextChoices):
    """Setores operacionais do Grupo DS Car."""
    RECEPTION    = "reception",    "Recepção"
    BODYWORK     = "bodywork",     "Funilaria"
    PAINTING     = "painting",     "Pintura"
    MECHANICAL   = "mechanical",   "Mecânica"
    AESTHETICS   = "aesthetics",   "Estética"
    POLISHING    = "polishing",    "Polimento"
    WASHING      = "washing",      "Lavagem"
    INVENTORY    = "inventory",    "Almoxarifado"
    FINANCIAL    = "financial",    "Financeiro"
    ADMINISTRATIVE = "administrative", "Administrativo"
    MANAGEMENT   = "management",   "Gerência"
    DIRECTION    = "direction",    "Diretoria"


class Person(models.Model):
    """
    Pessoa cadastrada no tenant — cliente, seguradora, corretor, funcionário ou fornecedor.
    Reside no schema do tenant (não cruza dados entre empresas).
    """

    person_kind = models.CharField(
        max_length=2,
        choices=TipoPessoa.choices,
        default=TipoPessoa.FISICA,
        db_index=True,
        verbose_name="Tipo de pessoa",
    )

    # Identificação
    full_name = models.CharField(max_length=200, db_index=True, verbose_name="Nome / Razão social")
    fantasy_name = models.CharField(max_length=200, blank=True, default="", verbose_name="Nome fantasia")

    # Documento principal
    document = models.CharField(
        max_length=20, blank=True, default="", db_index=True, verbose_name="CPF / CNPJ (só dígitos)"
    )

    # Dados fiscais
    secondary_document = models.CharField(max_length=30, blank=True, default="", verbose_name="RG / IE")
    municipal_registration = models.CharField(max_length=30, blank=True, default="", verbose_name="IM")
    is_simples_nacional = models.BooleanField(default=False, verbose_name="Simples Nacional")
    inscription_type = models.CharField(
        max_length=20,
        choices=[
            ("CONTRIBUINTE", "Contribuinte"),
            ("NAO_CONTRIBUINTE", "Não Contribuinte"),
            ("ISENTO", "Isento"),
        ],
        blank=True,
        default="",
        verbose_name="Tipo de inscrição",
    )

    # Dados pessoais (PF)
    birth_date = models.DateField(null=True, blank=True, verbose_name="Data de nascimento")
    gender = models.CharField(
        max_length=1,
        choices=[("M", "Masculino"), ("F", "Feminino"), ("N", "Não informado")],
        blank=True,
        default="",
        verbose_name="Sexo",
    )

    # Seguradora
    logo_url = models.CharField(max_length=500, blank=True, default="", verbose_name="URL do logo")
    insurer_code = models.CharField(max_length=50, blank=True, default="", verbose_name="Código interno")

    # Funcionário
    job_title = models.CharField(
        max_length=20,
        choices=CargoPessoa.choices,
        blank=True,
        default="",
        verbose_name="Cargo",
    )
    department = models.CharField(
        max_length=20,
        choices=SetorPessoa.choices,
        blank=True,
        default="",
        verbose_name="Setor",
    )

    # Situação
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="Ativo")
    notes = models.TextField(blank=True, default="", verbose_name="Observações")

    # Migração legacy (Databox)
    legacy_code = models.CharField(max_length=30, blank=True, default="")
    legacy_category = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pessoa"
        verbose_name_plural = "Pessoas"

    def __str__(self) -> str:
        return self.full_name

    @property
    def person_type(self) -> str:
        """Retrocompatibilidade com código que usa person_type."""
        roles = list(self.roles.values_list("role", flat=True))
        if "INSURER" in roles:
            return "INSURER"
        if "BROKER" in roles:
            return "BROKER"
        if "EMPLOYEE" in roles:
            return "EMPLOYEE"
        if "CLIENT" in roles:
            return "CLIENT"
        return roles[0] if roles else "CLIENT"


class PersonRole(models.Model):
    """Papel da pessoa no tenant (pode ter múltiplos)."""

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=20, choices=RolePessoa.choices, db_index=True)

    class Meta:
        unique_together = [("person", "role")]
        verbose_name = "Role"
        verbose_name_plural = "Roles"

    def __str__(self) -> str:
        return f"{self.person.full_name} — {self.role}"


class PersonContact(models.Model):
    """Contato da pessoa (múltiplos, tipados)."""

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="contacts")
    contact_type = models.CharField(max_length=20, choices=TipoContato.choices, verbose_name="Tipo")
    value = models.CharField(max_length=200, verbose_name="Valor")
    label = models.CharField(max_length=100, blank=True, default="", verbose_name="Rótulo")
    is_primary = models.BooleanField(default=False, verbose_name="Principal")

    class Meta:
        ordering = ["-is_primary", "contact_type"]
        verbose_name = "Contato"
        verbose_name_plural = "Contatos"

    def __str__(self) -> str:
        return f"{self.contact_type}: {self.value}"


class PersonAddress(models.Model):
    """Endereço da pessoa (múltiplos, tipados)."""

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="addresses")
    address_type = models.CharField(
        max_length=20,
        choices=TipoEndereco.choices,
        default=TipoEndereco.PRINCIPAL,
        verbose_name="Tipo",
    )
    zip_code = models.CharField(max_length=9, blank=True, default="", verbose_name="CEP")
    street = models.CharField(max_length=200, blank=True, default="", verbose_name="Logradouro")
    number = models.CharField(max_length=20, blank=True, default="", verbose_name="Número")
    complement = models.CharField(max_length=100, blank=True, default="", verbose_name="Complemento")
    neighborhood = models.CharField(max_length=100, blank=True, default="", verbose_name="Bairro")
    city = models.CharField(max_length=100, blank=True, default="", verbose_name="Cidade")
    state = models.CharField(max_length=2, blank=True, default="", verbose_name="UF")
    is_primary = models.BooleanField(default=False, verbose_name="Principal")

    class Meta:
        ordering = ["-is_primary", "address_type"]
        verbose_name = "Endereço"
        verbose_name_plural = "Endereços"

    def __str__(self) -> str:
        return f"{self.street}, {self.number} — {self.city}/{self.state}"
