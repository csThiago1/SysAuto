"""
Paddock Solutions — Persons App
Entidade unificada de pessoas (tenant-level): clientes, seguradoras, corretores, funcionários, fornecedores.

LGPD (Ciclo 06A):
  - PersonDocument: CPF, CNPJ, RG, IE, IM, CNH criptografados com EncryptedCharField
  - PersonContact.value: criptografado + value_hash para filter()
  - PersonAddress.municipio_ibge: código IBGE 7 dígitos (obrigatório NFS-e Manaus)
"""

import logging

from encrypted_model_fields.fields import EncryptedCharField

from django.db import models

logger = logging.getLogger(__name__)


class RolePessoa(models.TextChoices):
    CLIENTE = "CLIENT", "Cliente"
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

    RECEPTIONIST = "receptionist", "Recepcionista"
    CONSULTANT = "consultant", "Consultor de Serviços"
    BODYWORKER = "bodyworker", "Funileiro"
    PAINTER = "painter", "Pintor"
    MECHANIC = "mechanic", "Mecânico"
    POLISHER = "polisher", "Polidor"
    WASHER = "washer", "Lavador"
    STOREKEEPER = "storekeeper", "Almoxarife"
    MANAGER = "manager", "Gerente"
    FINANCIAL = "financial", "Financeiro"
    ADMINISTRATIVE = "administrative", "Administrativo"
    DIRECTOR = "director", "Diretor"


class SetorPessoa(models.TextChoices):
    """Setores operacionais do Grupo DS Car."""

    RECEPTION = "reception", "Recepção"
    BODYWORK = "bodywork", "Funilaria"
    PAINTING = "painting", "Pintura"
    MECHANICAL = "mechanical", "Mecânica"
    AESTHETICS = "aesthetics", "Estética"
    POLISHING = "polishing", "Polimento"
    WASHING = "washing", "Lavagem"
    INVENTORY = "inventory", "Almoxarifado"
    FINANCIAL = "financial", "Financeiro"
    ADMINISTRATIVE = "administrative", "Administrativo"
    MANAGEMENT = "management", "Gerência"
    DIRECTION = "direction", "Diretoria"


class TipoDocumento(models.TextChoices):
    """Tipos de documento suportados em PersonDocument."""

    CPF = "CPF", "CPF"
    CNPJ = "CNPJ", "CNPJ"
    RG = "RG", "RG"
    IE = "IE", "Inscrição Estadual"
    IM = "IM", "Inscrição Municipal"
    CNH = "CNH", "CNH"


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
    fantasy_name = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Nome fantasia"
    )

    # Dados fiscais
    secondary_document = models.CharField(
        max_length=30, blank=True, default="", verbose_name="RG / IE"
    )
    municipal_registration = models.CharField(
        max_length=30, blank=True, default="", verbose_name="IM"
    )
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


class PersonDocument(models.Model):
    """
    Documento de identificação da pessoa — armazenado criptografado (LGPD Art. 46).

    Filtro: SEMPRE usar value_hash (SHA-256) — EncryptedCharField não suporta filter().

    Exemplo:
        from apps.persons.utils import sha256_hex
        PersonDocument.objects.filter(value_hash=sha256_hex(cpf))
    """

    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="documents",
        verbose_name="Pessoa",
    )
    doc_type = models.CharField(
        max_length=10,
        choices=TipoDocumento.choices,
        db_index=True,
        verbose_name="Tipo de documento",
    )
    # PII criptografada em repouso
    value = EncryptedCharField(max_length=200, verbose_name="Valor")
    # Hash SHA-256 para filter() — EncryptedCharField não suporta filter()
    value_hash = models.CharField(
        max_length=64,
        db_index=True,
        default="",
        verbose_name="Hash do valor",
    )
    is_primary = models.BooleanField(default=False, verbose_name="Principal")
    issued_by = models.CharField(
        max_length=100, blank=True, default="", verbose_name="Órgão emissor"
    )
    issued_at = models.DateField(null=True, blank=True, verbose_name="Data de emissão")
    expires_at = models.DateField(null=True, blank=True, verbose_name="Data de validade")

    class Meta:
        unique_together = [("person", "doc_type", "value_hash")]
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"

    def save(self, *args, **kwargs) -> None:
        """Auto-gera value_hash a partir do value (SHA-256 para busca)."""
        if self.value:
            from apps.persons.utils import sha256_hex

            self.value_hash = sha256_hex(self.value)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.doc_type} — {self.person}"


class PersonContact(models.Model):
    """Contato da pessoa (múltiplos, tipados) — value criptografado (LGPD)."""

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="contacts")
    contact_type = models.CharField(max_length=20, choices=TipoContato.choices, verbose_name="Tipo")
    # PII criptografada em repouso (email, telefone)
    value = EncryptedCharField(max_length=200, verbose_name="Valor")
    # Hash SHA-256 para filter()
    value_hash = models.CharField(
        max_length=64,
        db_index=True,
        default="",
        verbose_name="Hash do valor",
    )
    label = models.CharField(max_length=100, blank=True, default="", verbose_name="Rótulo")
    is_primary = models.BooleanField(default=False, verbose_name="Principal")

    class Meta:
        ordering = ["-is_primary", "contact_type"]
        verbose_name = "Contato"
        verbose_name_plural = "Contatos"

    def save(self, *args, **kwargs) -> None:
        """Auto-gera value_hash a partir do value (SHA-256 para busca)."""
        if self.value:
            from apps.persons.utils import sha256_hex

            self.value_hash = sha256_hex(self.value)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.contact_type}: ***"


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
    complement = models.CharField(
        max_length=100, blank=True, default="", verbose_name="Complemento"
    )
    neighborhood = models.CharField(max_length=100, blank=True, default="", verbose_name="Bairro")
    city = models.CharField(max_length=100, blank=True, default="", verbose_name="Cidade")
    state = models.CharField(max_length=2, blank=True, default="", verbose_name="UF")
    municipio_ibge = models.CharField(
        max_length=7,
        blank=True,
        default="",
        verbose_name="Código IBGE do município",
        help_text="7 dígitos IBGE. Obrigatório para NFS-e Manaus (1302603).",
    )
    is_primary = models.BooleanField(default=False, verbose_name="Principal")

    class Meta:
        ordering = ["-is_primary", "address_type"]
        verbose_name = "Endereço"
        verbose_name_plural = "Endereços"

    def __str__(self) -> str:
        return f"{self.street}, {self.number} — {self.city}/{self.state}"


class ClientProfile(models.Model):
    """
    Perfil de cliente — dados de consentimento LGPD por pessoa.
    OneToOne: uma pessoa pode ter um único perfil de cliente.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="client_profile",
        verbose_name="Pessoa",
    )
    lgpd_consent_version = models.CharField(
        max_length=10, default="1.0", verbose_name="Versão do consentimento LGPD"
    )
    lgpd_consent_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do consentimento LGPD"
    )
    lgpd_consent_ip = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="IP do consentimento LGPD"
    )
    group_sharing_consent = models.BooleanField(
        default=False,
        verbose_name="Consentimento de compartilhamento no grupo",
        help_text="Opt-in EXPLÍCITO — verificar antes de cross-sell entre empresas do grupo.",
    )

    class Meta:
        verbose_name = "Perfil de Cliente"
        verbose_name_plural = "Perfis de Cliente"

    def __str__(self) -> str:
        return f"ClientProfile — {self.person.full_name}"


class BrokerOffice(models.Model):
    """
    Escritório de corretagem (PJ). Agrupa corretores individuais.
    person_kind=PJ obrigatório — validado no serializer.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="broker_office",
        verbose_name="Pessoa (PJ)",
    )

    class Meta:
        verbose_name = "Escritório de Corretagem"
        verbose_name_plural = "Escritórios de Corretagem"

    def __str__(self) -> str:
        return f"Escritório — {self.person.full_name}"


class BrokerPerson(models.Model):
    """
    Corretor individual (PF). Pode ser vinculado a um BrokerOffice.
    person_kind=PF obrigatório — validado no serializer.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="broker_person",
        verbose_name="Pessoa (PF)",
    )
    office = models.ForeignKey(
        BrokerOffice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
        verbose_name="Escritório de corretagem",
    )

    class Meta:
        verbose_name = "Corretor"
        verbose_name_plural = "Corretores"

    def __str__(self) -> str:
        return f"Corretor — {self.person.full_name}"
