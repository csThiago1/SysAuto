"""
Paddock Solutions — Authentication App
GlobalUser + PaddockBaseModel (abstract)
"""
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

    def create_user(
        self, email: str, password: str | None = None, **extra_fields: object
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
        self, email: str, password: str, **extra_fields: object
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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # LGPD: email criptografado em repouso
    email = EncryptedEmailField(unique=True)
    email_hash = models.CharField(max_length=64, unique=True, db_index=True)  # para busca
    name = models.CharField(max_length=200)
    # Keycloak subject (sub) — vazio para usuários locais
    keycloak_id = models.UUIDField(null=True, blank=True, unique=True)

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

    def __str__(self) -> str:
        return f"{self.name} ({self.id})"
