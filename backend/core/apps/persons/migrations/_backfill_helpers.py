"""Helpers de backfill — extraídos das migrations pra ficarem testáveis.

Usados em:
  - persons/migrations/0013_backfill_persons_from_legacy.py (Supplier, Expert)
  - accounts_payable/migrations/0007_add_payable_person_fk.py (PayableDocument.person)
  - purchasing/migrations/0006_backfill_person_fks.py (3 FKs)
"""
import hashlib
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def _sha256_hex(value: str) -> str:
    """SHA-256 hex digest — inlined for migration stability."""
    return hashlib.sha256(value.encode()).hexdigest()


def _only_digits(s: str) -> str:
    """Remove non-digit characters from string."""
    return re.sub(r"\D", "", s or "")


def find_or_create_person_from_supplier(apps_registry: Any, supplier: Any) -> Any:
    """Idempotente — retorna Person existente (via legacy_supplier_id) ou cria nova.

    Cria também: PersonRole=SUPPLIER, SupplierProfile, PersonDocument (CPF/CNPJ),
    PersonContact (email, phone).

    Args:
        apps_registry: registry de migration (django.apps OR `apps` parameter de RunPython)
        supplier: instance de accounts_payable.Supplier (state da migration)

    Returns:
        Person instance (state da migration)
    """
    Person          = apps_registry.get_model("persons", "Person")
    PersonRole      = apps_registry.get_model("persons", "PersonRole")
    PersonDocument  = apps_registry.get_model("persons", "PersonDocument")
    PersonContact   = apps_registry.get_model("persons", "PersonContact")
    SupplierProfile = apps_registry.get_model("persons", "SupplierProfile")

    # Idempotência: buscar Person existente via legacy_supplier_id
    existing = SupplierProfile.objects.filter(legacy_supplier_id=supplier.id).first()
    if existing:
        return existing.person

    cnpj = _only_digits(supplier.cnpj)
    cpf  = _only_digits(supplier.cpf)
    person_kind = "PJ" if cnpj else "PF"
    primary_doc_type = "CNPJ" if cnpj else "CPF"
    primary_doc_value = cnpj or cpf

    # Criar Person
    person = Person.objects.create(person_kind=person_kind, full_name=supplier.name)

    # Criar PersonRole (pode disparar signal no context runtime, não em migration-time)
    PersonRole.objects.create(person=person, role="SUPPLIER")

    # Criar PersonDocument (CPF ou CNPJ)
    if primary_doc_value:
        PersonDocument.objects.create(
            person=person,
            doc_type=primary_doc_type,
            value=primary_doc_value,
            value_hash=_sha256_hex(primary_doc_value),
            is_primary=True,
        )

    # Criar PersonContact (EMAIL)
    if supplier.email:
        PersonContact.objects.create(
            person=person,
            contact_type="EMAIL",
            value=supplier.email,
            value_hash=_sha256_hex(supplier.email),
            is_primary=True,
        )

    # Criar PersonContact (CELULAR)
    if supplier.phone:
        PersonContact.objects.create(
            person=person,
            contact_type="CELULAR",
            value=supplier.phone,
            value_hash=_sha256_hex(supplier.phone),
            is_primary=True,
        )

    # Criar ou atualizar SupplierProfile (signal pode já ter criado um vazio)
    try:
        profile = SupplierProfile.objects.get(person=person)
        # Profile já existe (criado pelo signal) — atualizar com dados legados
        profile.notes = supplier.notes or ""
        profile.legacy_supplier_id = str(supplier.id)  # UUID → string
        profile.save()
    except SupplierProfile.DoesNotExist:
        # Profile não existe — criar novo
        SupplierProfile.objects.create(
            person=person,
            notes=supplier.notes or "",
            legacy_supplier_id=str(supplier.id),  # UUID → string
        )

    logger.info("backfill: Supplier #%s → Person #%s", supplier.id, person.id)
    return person


def backfill_suppliers_to_persons(apps_registry: Any) -> dict[str, str]:
    """Migra TODOS os accounts_payable.Supplier para Person + SupplierProfile.

    Returns:
        dict {legacy_supplier_id: person_id}

    Em runtime pós-drop (accounts_payable.Supplier removido), retorna dict vazio.
    """
    try:
        Supplier = apps_registry.get_model("accounts_payable", "Supplier")
    except LookupError:
        logger.info("backfill_suppliers_to_persons: model removido, skip")
        return {}
    mapping: dict[str, str] = {}
    for sup in Supplier.objects.all():
        person = find_or_create_person_from_supplier(apps_registry, sup)
        mapping[sup.id] = person.id
    return mapping


def find_or_create_person_from_expert(apps_registry: Any, expert: Any) -> Any:
    """Idempotente — cria Person + role=EXPERT + ExpertProfile para Expert legado.

    Args:
        apps_registry: registry de migration (django.apps OR `apps` parameter de RunPython)
        expert: instance de experts.Expert (state da migration)

    Returns:
        Person instance (state da migration)
    """
    Person         = apps_registry.get_model("persons", "Person")
    PersonRole     = apps_registry.get_model("persons", "PersonRole")
    PersonContact  = apps_registry.get_model("persons", "PersonContact")
    ExpertProfile  = apps_registry.get_model("persons", "ExpertProfile")

    # Idempotência: buscar Person existente via legacy_expert_id
    existing = ExpertProfile.objects.filter(legacy_expert_id=expert.id).first()
    if existing:
        return existing.person

    # Criar Person
    person = Person.objects.create(person_kind="PF", full_name=expert.name)

    # Criar PersonRole (pode disparar signal no context runtime)
    PersonRole.objects.create(person=person, role="EXPERT")

    # Criar PersonContact (EMAIL)
    if expert.email:
        PersonContact.objects.create(
            person=person,
            contact_type="EMAIL",
            value=expert.email,
            value_hash=_sha256_hex(expert.email),
            is_primary=True,
        )

    # Criar PersonContact (CELULAR)
    if expert.phone:
        PersonContact.objects.create(
            person=person,
            contact_type="CELULAR",
            value=expert.phone,
            value_hash=_sha256_hex(expert.phone),
            is_primary=True,
        )

    # Criar ou atualizar ExpertProfile (signal pode já ter criado um vazio)
    try:
        profile = ExpertProfile.objects.get(person=person)
        # Profile já existe (criado pelo signal) — atualizar com dados legados
        profile.registration_number = expert.registration_number or ""
        profile.legacy_expert_id = str(expert.id)  # UUID → string
        profile.save()
    except ExpertProfile.DoesNotExist:
        # Profile não existe — criar novo
        profile = ExpertProfile.objects.create(
            person=person,
            registration_number=expert.registration_number or "",
            legacy_expert_id=str(expert.id),  # UUID → string
        )

    # Atribuir seguradoras (M2M) apenas se expert.insurers for acessível
    if hasattr(expert, "insurers") and expert.insurers.exists():
        profile.insurers.set(expert.insurers.all())

    logger.info("backfill: Expert #%s → Person #%s", expert.id, person.id)
    return person


def backfill_experts_to_persons(apps_registry: Any) -> dict[str, str]:
    """Migra TODOS os experts.Expert para Person + ExpertProfile.

    Returns:
        dict {legacy_expert_id: person_id}

    Em runtime pós-drop (experts.Expert removido), retorna dict vazio.
    """
    try:
        Expert = apps_registry.get_model("experts", "Expert")
    except LookupError:
        logger.info("backfill_experts_to_persons: model removido, skip")
        return {}
    mapping: dict[str, str] = {}
    for exp in Expert.objects.all():
        person = find_or_create_person_from_expert(apps_registry, exp)
        mapping[exp.id] = person.id
    return mapping
