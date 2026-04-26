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
    Ao atualizar, sincroniza o nome completo no Person.

    Lookup de Person existente usa PersonDocument (CPF via value_hash).
    Fallback: cria novo Person sem lookup se CPF não disponível.

    Nota: os campos Person.document, Person.department e Person.job_title foram
    removidos no Ciclo 07. A sincronização agora mantém apenas o nome completo.
    """
    from apps.persons.models import Person, PersonRole
    from apps.persons.utils import sha256_hex

    try:
        full_name = instance.user.get_full_name() or instance.user.email
        if created or not instance.person_id:
            person = None
            # Tenta localizar Person pelo CPF via PersonDocument (value_hash)
            raw_cpf: str = instance.cpf  # EncryptedCharField retorna str decriptografado
            if raw_cpf:
                from apps.persons.models import PersonDocument

                doc = PersonDocument.objects.filter(
                    doc_type="CPF", value_hash=sha256_hex(raw_cpf)
                ).first()
                if doc:
                    person = doc.person
            if not person:
                person = Person.objects.create(full_name=full_name)
            # Garante role=EMPLOYEE
            PersonRole.objects.get_or_create(person=person, role="EMPLOYEE")
            # Atualiza FK sem disparar signal novamente
            type(instance).objects.filter(pk=instance.pk).update(person=person)
        else:
            # Sync apenas nome no person existente (department/job_title foram removidos de Person)
            if instance.person:
                instance.person.full_name = full_name
                instance.person.save(update_fields=["full_name"])
    except Exception as exc:
        logger.warning("[HR] sync_employee_to_person failed for %s: %s", instance.pk, exc)
