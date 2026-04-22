from django.db import migrations


def copy_history(apps, schema_editor) -> None:
    """Copia ServiceOrderStatusHistory existentes → ServiceOrderEvent(STATUS_CHANGE)."""
    SOStatusHistory = apps.get_model("service_orders", "ServiceOrderStatusHistory")
    SOEvent = apps.get_model("service_orders", "ServiceOrderEvent")

    events = []
    for h in SOStatusHistory.objects.all().iterator():
        events.append(SOEvent(
            service_order=h.service_order,
            event_type="STATUS_CHANGE",
            actor=h.changed_by or "Sistema",
            payload={"notes": h.notes},
            from_state=h.from_status,
            to_state=h.to_status,
            created_at=h.changed_at,
        ))
    if events:
        SOEvent.objects.bulk_create(events, batch_size=500)


def reverse_copy(apps, schema_editor) -> None:
    SOEvent = apps.get_model("service_orders", "ServiceOrderEvent")
    SOEvent.objects.filter(event_type="STATUS_CHANGE").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("service_orders", "0008_fix_event_created_at"),
    ]

    operations = [
        migrations.RunPython(copy_history, reverse_copy),
    ]
