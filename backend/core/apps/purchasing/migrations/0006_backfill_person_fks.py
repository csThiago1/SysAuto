"""Backfill: popula person_fornecedor/person_supplier via SupplierProfile.legacy_supplier_id."""
from django.db import migrations


def backfill(apps, schema_editor):
    SupplierProfile = apps.get_model("persons", "SupplierProfile")
    ItemOrdemCompra = apps.get_model("purchasing", "ItemOrdemCompra")
    CotacaoLog = apps.get_model("purchasing", "CotacaoLog")
    RespostaCotacao = apps.get_model("purchasing", "RespostaCotacao")

    sup_legacy_to_person = {
        sp.legacy_supplier_id: sp.person_id
        for sp in SupplierProfile.objects.exclude(
            legacy_supplier_id__isnull=True
        ).exclude(legacy_supplier_id="")
    }

    # ItemOrdemCompra.fornecedor é FK para pricing_catalog.Fornecedor (tabela vazia,
    # 0 rows em prod) — pula backfill, deixa NULL. Quem usar terá que repopular via UI.
    # Se houver dados futuramente, usar Fornecedor.perfil_fornecedor_id como mapping.

    for cot in CotacaoLog.objects.all():
        cot.person_supplier_id = sup_legacy_to_person.get(str(cot.supplier_id))
        cot.save(update_fields=["person_supplier"])

    for resp in RespostaCotacao.objects.all():
        resp.person_supplier_id = sup_legacy_to_person.get(str(resp.supplier_id))
        resp.save(update_fields=["person_supplier"])


class Migration(migrations.Migration):
    dependencies = [("purchasing", "0005_add_person_fks_nullable")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
