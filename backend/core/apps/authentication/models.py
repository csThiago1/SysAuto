"""
Paddock Solutions — Authentication App
GlobalUser + PaddockBaseModel (abstract)
"""
import hashlib
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from encrypted_model_fields.fields import EncryptedCharField, EncryptedEmailField


class PaddockBaseModel(models.Model):
    """
    Model base — herdar em todas as entidades de negócio Paddock Solutions.

    Provê:
    - UUID como PK
    - Timestamps criação/atualização
    - Referência ao usuário criador
    - Soft delete via is_active
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    def soft_delete(self) -> None:
        """Soft delete — nunca hard delete em entidades de negócio."""
        self.is_active = False
        self.save(update_fields=["is_active", "updated_at"])


class GlobalUserManager(BaseUserManager):
    """Manager customizado para GlobalUser."""

    def get_by_natural_key(self, username: str) -> "GlobalUser":
        """Aceita e-mail legível OU email_hash — necessário para o login do Django admin."""
        if "@" in username:
            username = hashlib.sha256(username.lower().encode()).hexdigest()
        return self.get(**{self.model.USERNAME_FIELD: username})

    def create_user(
        self, email: str, password: str | None = None, **extra_fields
    ) -> "GlobalUser":
        """Cria usuário comum."""
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email: str, password: str, **extra_fields
    ) -> "GlobalUser":
        """Cria superusuário."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class GlobalUser(AbstractBaseUser, PermissionsMixin):
    """
    Usuário global do sistema Paddock Solutions.
    Reside no schema public — compartilhado entre todos os tenants.
    Autenticado via OIDC (Keycloak) ou JWT local.
    """

    class JobTitle(models.TextChoices):
        RECEPTION = "reception", "Recepção"
        PAINTING = "painting", "Pintura"
        MECHANICAL = "mechanical", "Mecânica"
        ADMIN = "admin", "Administração"
        INVENTORY = "inventory", "Estoque"
        SALES = "sales", "Vendas"
        PURCHASING = "purchasing", "Compras"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # LGPD: email criptografado em repouso
    email = EncryptedEmailField(unique=True)
    email_hash = models.CharField(max_length=64, unique=True, db_index=True)  # para busca
    name = models.CharField(max_length=200)
    # Keycloak subject (sub) — vazio para usuários locais
    keycloak_id = models.UUIDField(null=True, blank=True, unique=True)
    job_title = models.CharField(
        max_length=20,
        choices=JobTitle.choices,
        blank=True,
        default="",
        verbose_name="Setor / Cargo",
    )

    push_token = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="Expo Push Token",
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email_hash"
    REQUIRED_FIELDS = ["name"]

    objects = GlobalUserManager()

    class Meta:
        db_table = "users_global"
        verbose_name = "Usuário Global"
        verbose_name_plural = "Usuários Globais"

    def save(self, *args, **kwargs) -> None:
        """Computa email_hash automaticamente antes de salvar."""
        if self.email and not self.email_hash:
            self.email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
        super().save(*args, **kwargs)

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.name.split()[0] if self.name else ""

    def __str__(self) -> str:
        return f"{self.name} ({self.id})"
