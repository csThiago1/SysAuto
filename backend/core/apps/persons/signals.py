"""Signals do app persons — auto-criação de profiles ao adicionar role."""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.persons.models import (
    PersonRole, SupplierProfile, ExpertProfile, ClientProfile, RolePessoa,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=PersonRole)
def auto_create_profile_for_role(sender, instance: PersonRole, created: bool, **kwargs) -> None:
    """Cria perfil OneToOne vazio quando role é adicionado à Person.
    Idempotente — get_or_create evita duplicatas.
    """
    if not created:
        return

    person = instance.person
    role = instance.role

    if role == RolePessoa.FORNECEDOR:
        SupplierProfile.objects.get_or_create(person=person)
    elif role == RolePessoa.PERITO:
        ExpertProfile.objects.get_or_create(person=person)
    elif role == RolePessoa.CLIENTE:
        ClientProfile.objects.get_or_create(person=person)
    # EMPLOYEE → criado pelo app hr/ ao admitir colaborador
    # BROKER → criado manualmente (escolher PF vs PJ)
    # INSURER → schema público, não cabe aqui
