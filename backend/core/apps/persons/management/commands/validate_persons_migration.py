"""Valida invariantes de consistência pós-migração — exit 1 se houver BLOCKER."""
import sys
from typing import Iterable

from django.core.management.base import BaseCommand
from django.db.models import Count
from django_tenants.utils import schema_context, get_tenant_model


class Command(BaseCommand):
    help = "Valida consistência das tabelas após consolidação de Person."

    def handle(self, *args, **options) -> None:
        blockers: list[str] = []
        warnings: list[str] = []

        for schema in self._iter_tenant_schemas():
            with schema_context(schema):
                blockers.extend(self._check_orphan_legacy_fks(schema))
                blockers.extend(self._check_missing_primary_doc(schema))
                warnings.extend(self._check_supplier_without_profile(schema))
                warnings.extend(self._check_duplicate_cpf(schema))

        for w in warnings:
            self.stdout.write(self.style.WARNING(f"[WARNING] {w}"))
        for b in blockers:
            self.stdout.write(self.style.ERROR(f"[BLOCKER] {b}"))

        if blockers:
            self.stdout.write(
                self.style.ERROR(f"\n{len(blockers)} BLOCKER(s). Deploy NOT safe.")
            )
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS(f"\nOK. {len(warnings)} warning(s)."))
        sys.exit(0)

    def _iter_tenant_schemas(self) -> Iterable[str]:
        Tenant = get_tenant_model()
        return [
            t.schema_name
            for t in Tenant.objects.exclude(schema_name="public")
        ]

    def _check_orphan_legacy_fks(self, schema: str) -> list[str]:
        """Garante que toda Person criada pelo backfill tem profile linkado."""
        from apps.persons.models import SupplierProfile
        out = []
        for sp in SupplierProfile.objects.exclude(
            legacy_supplier_id__isnull=True
        ).exclude(legacy_supplier_id=""):
            if sp.person is None:
                out.append(
                    f"{schema}: SupplierProfile legacy_supplier_id={sp.legacy_supplier_id} sem Person"
                )
        return out

    def _check_missing_primary_doc(self, schema: str) -> list[str]:
        """Toda Person ativa deve ter PersonDocument primary (CPF ou CNPJ)."""
        from apps.persons.models import Person
        out = []
        missing = Person.objects.filter(is_active=True).exclude(
            documents__is_primary=True,
            documents__doc_type__in=["CPF", "CNPJ"],
        )
        for p in missing[:10]:
            out.append(
                f"{schema}: Person #{p.pk} '{p.full_name}' sem documento primário"
            )
        return out

    def _check_supplier_without_profile(self, schema: str) -> list[str]:
        from apps.persons.models import Person
        orphans = Person.objects.filter(
            roles__role="SUPPLIER", supplier_profile__isnull=True
        )
        return [
            f"{schema}: Person #{p.pk} '{p.full_name}' role=SUPPLIER sem SupplierProfile"
            for p in orphans[:10]
        ]

    def _check_duplicate_cpf(self, schema: str) -> list[str]:
        from apps.persons.models import PersonDocument
        dups = (
            PersonDocument.objects.filter(
                doc_type__in=["CPF", "CNPJ"], is_primary=True
            )
            .values("value_hash")
            .annotate(c=Count("id"))
            .filter(c__gt=1)
        )
        return [
            f"{schema}: documento value_hash={d['value_hash'][:12]}... em {d['c']} pessoas"
            for d in dups[:10]
        ]
