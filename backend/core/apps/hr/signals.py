"""
HR Signals — sincronização automática Employee ↔ Person.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="hr.Employee")
def sync_employee_to_person(
    sender: type,
    instance: "Employee",  # noqa: F821
    created: bool,
    **kwargs: object,
) -> None:
    """
    Ao criar um Employee, cria ou vincula um Person com role=EMPLOYEE.
    Ao atualizar, sincroniza department e job_title no Person.

    Lookup de Person existente usa Person.document (CPF em texto simples).
    Fallback: cria novo Person sem lookup se CPF não disponível.
    """
    from apps.persons.models import Person, PersonRole

    try:
        full_name = instance.user.get_full_name() or instance.user.email
        if created or not instance.person_id:
            person = None
            # Tenta localizar Person pelo CPF em texto simples (campo document)
            raw_cpf: str = instance.cpf  # EncryptedCharField retorna str decriptografado
            if raw_cpf:
                person = Person.objects.filter(document=raw_cpf).first()
            if not person:
                person = Person.objects.create(
                    full_name=full_name,
                    department=instance.department,
                    job_title=instance.position,
                )
            # Garante role=EMPLOYEE
            PersonRole.objects.get_or_create(person=person, role="EMPLOYEE")
            # Atualiza FK sem disparar signal novamente
            type(instance).objects.filter(pk=instance.pk).update(person=person)
        else:
            # Sync name/department/position no person existente
            if instance.person:
                instance.person.full_name = full_name
                instance.person.department = instance.department
                instance.person.job_title = instance.position
                instance.person.save(update_fields=["full_name", "department", "job_title"])
    except Exception as exc:
        logger.warning("[HR] sync_employee_to_person failed for %s: %s", instance.pk, exc)
