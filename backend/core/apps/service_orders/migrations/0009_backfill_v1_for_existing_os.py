from decimal import Decimal

from django.db import migrations


def backfill_v1(apps, schema_editor) -> None:
    """Cria ServiceOrderVersion v1 pra cada OS legada que não tenha version.

    - net_total e subtotal = total_value (campo legado)
    - status = 'approved' (a não ser OS cancelled → 'rejected')
    - source = 'manual'
    - created_by identifica a origem da migration (pra facilitar auditoria)
    """
    ServiceOrder = apps.get_model("service_orders", "ServiceOrder")
    ServiceOrderVersion = apps.get_model("service_orders", "ServiceOrderVersion")

    for os in ServiceOrder.objects.all().iterator():
        if os.versions.exists():
            continue

        status = "rejected" if os.status == "cancelled" else "approved"
        total = os.total_value or Decimal("0")

        ServiceOrderVersion.objects.create(
            service_order=os,
            version_number=1,
            source="manual",
            status=status,
            net_total=total,
            subtotal=total,
            created_by="Sistema (migração 0.1 backfill)",
        )


def reverse_backfill(apps, schema_editor) -> None:
    """Remove apenas versions marcadas como 'Sistema (migração 0.1 backfill)'."""
    ServiceOrderVersion = apps.get_model("service_orders", "ServiceOrderVersion")
    ServiceOrderVersion.objects.filter(created_by="Sistema (migração 0.1 backfill)").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0007_migrate_status_history_to_events"),
        ("service_orders", "0008_fix_event_created_at"),
    ]

    operations = [
        migrations.RunPython(backfill_v1, reverse_backfill),
    ]
