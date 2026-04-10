"""
Paddock Solutions — Authentication Signals

Ao criar GlobalUser (primeiro login), vincula automaticamente ao UnifiedCustomer
que tiver o mesmo email_hash. Garante que cliente cadastrado antes de criar conta
seja reconhecido no primeiro acesso.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="authentication.GlobalUser")
def link_customer_on_first_login(
    sender: type,
    instance: "GlobalUser",  # noqa: F821
    created: bool,
    **kwargs: object,
) -> None:
    """
    Vincula GlobalUser ao UnifiedCustomer com o mesmo email_hash.

    Executado apenas na criação (primeiro login via JWT).
    Usa update() para evitar disparar signals adicionais no UnifiedCustomer.

    Args:
        instance: GlobalUser recém-criado.
        created: True apenas na criação — ignorar updates.
    """
    if not created:
        return

    try:
        from apps.customers.models import UnifiedCustomer  # import local para evitar circular

        updated = UnifiedCustomer.objects.filter(
            email_hash=instance.email_hash,
            global_user__isnull=True,  # não sobrescrever vínculo existente
            is_active=True,
        ).update(global_user=instance)

        if updated:
            logger.info(
                "[Auth] GlobalUser %s vinculado automaticamente ao UnifiedCustomer via email_hash.",
                instance.pk,
            )
    except Exception as exc:
        # Nunca quebrar o login por falha no signal
        logger.warning("[Auth] link_customer_on_first_login falhou para %s: %s", instance.pk, exc)
