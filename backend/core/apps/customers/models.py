"""
Paddock Solutions — Customers App
UnifiedCustomer: cliente unificado entre empresas do grupo (LGPD compliant)
"""
import hashlib
import uuid

from django.db import models
from encrypted_model_fields.fields import EncryptedCharField, EncryptedEmailField

from apps.authentication.models import PaddockBaseModel


class UnifiedCustomer(PaddockBaseModel):
    """
    Cliente unificado do Grupo — reside no schema public.

    Dados pessoais criptografados em repouso (LGPD Art. 46).
    Consentimentos versionados e auditáveis.
    Hard delete PROIBIDO — usar erasure (anonimização).
    """

    # Dados pessoais — SEMPRE criptografados
    name = models.CharField(max_length=200, verbose_name="Nome")
    cpf = EncryptedCharField(max_length=11, null=True, blank=True, verbose_name="CPF")
    cpf_hash = models.CharField(
        max_length=64, db_index=True, blank=True, default="", verbose_name="Hash CPF"
    )
    email = EncryptedEmailField(null=True, blank=True, verbose_name="E-mail")
    email_hash = models.CharField(max_length=64, db_index=True, blank=True, default="")
    phone = EncryptedCharField(max_length=20, verbose_name="Telefone")
    phone_hash = models.CharField(max_length=64, db_index=True, blank=True, default="")

    # Dados complementares
    birth_date = models.DateField(null=True, blank=True, verbose_name="Data de nascimento")
    # Endereço — campos individuais (migração 0004)
    zip_code = models.CharField(max_length=9, blank=True, default="", verbose_name="CEP")
    street = models.CharField(max_length=200, blank=True, default="", verbose_name="Rua / Av.")
    street_number = models.CharField(max_length=20, blank=True, default="", verbose_name="Número")
    complement = models.CharField(max_length=100, blank=True, default="", verbose_name="Complemento")
    neighborhood = models.CharField(max_length=100, blank=True, default="", verbose_name="Bairro")
    city = models.CharField(max_length=100, blank=True, default="", verbose_name="Cidade")
    state = models.CharField(max_length=2, blank=True, default="", verbose_name="UF")

    @property
    def address(self) -> str:
        """Backward-compat: retorna endereço formatado a partir dos campos individuais."""
        parts = [p for p in [self.street, self.street_number, self.neighborhood] if p]
        return ", ".join(parts) if parts else ""

    # LGPD — consentimentos
    lgpd_consent_version = models.CharField(max_length=10, default="1.0")
    lgpd_consent_date = models.DateTimeField(null=True, blank=True)
    lgpd_consent_ip = models.GenericIPAddressField(null=True, blank=True)
    # Consentimento explícito para cruzar dados entre empresas do grupo
    group_sharing_consent = models.BooleanField(
        default=False,
        verbose_name="Consentimento de compartilhamento no grupo",
        help_text="Opt-in EXPLÍCITO — verificar antes de qualquer cross-sell",
    )

    # Conta de acesso vinculada — preenchida automaticamente no primeiro login
    global_user = models.OneToOneField(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_profile",
        verbose_name="Conta de acesso",
        help_text="GlobalUser vinculado a este cliente. Preenchido automaticamente no 1º login.",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "customers_unified"
        verbose_name = "Cliente Unificado"
        verbose_name_plural = "Clientes Unificados"

    def __str__(self) -> str:
        return f"{self.name} ({self.id})"

    def save(self, *args: object, **kwargs: object) -> None:
        """Gera hashes para busca sem expor dados em texto claro."""
        if self.cpf:
            self.cpf_hash = self._hash(str(self.cpf))
        if self.email:
            self.email_hash = self._hash(str(self.email).lower())
        if self.phone:
            self.phone_hash = self._hash(str(self.phone))
        super().save(*args, **kwargs)

    @staticmethod
    def _hash(value: str) -> str:
        """SHA-256 determinístico para busca — NUNCA logar o valor original."""
        return hashlib.sha256(value.encode()).hexdigest()
