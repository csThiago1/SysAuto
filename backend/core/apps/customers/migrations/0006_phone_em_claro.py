"""
Telefone sai da criptografia e passa a ser texto claro, só dígitos, sem o DDI 55.

Decisão do Thiago (25/11/2026): o número precisa aparecer inteiro na tela e ser
buscado (casar a conversa do WhatsApp com o cliente). O valor antigo é lido
pelo EncryptedCharField do estado histórico (que decifra; linha não cifrada
volta como está), normalizado e gravado numa coluna nova, que toma o lugar
da antiga. Nenhuma linha é apagada.
"""

from django.db import migrations, models

from apps.persons.utils import normalize_phone, sha256_hex


def copy_to_plain(apps, schema_editor) -> None:
    Model = apps.get_model("customers", "UnifiedCustomer")
    batch = []
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.phone_plain = normalize_phone(obj.phone or "")
        obj.phone_hash = sha256_hex(obj.phone_plain) if obj.phone_plain else ""
        batch.append(obj)
        if len(batch) >= 500:
            Model.objects.bulk_update(batch, ["phone_plain", "phone_hash"])
            batch = []
    if batch:
        Model.objects.bulk_update(batch, ["phone_plain", "phone_hash"])


def copy_back(apps, schema_editor) -> None:
    # Volta o valor para a coluna cifrada (que já foi recriada pelo reverso do RemoveField).
    Model = apps.get_model("customers", "UnifiedCustomer")
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.phone = obj.phone_plain
        obj.save(update_fields=["phone"])


class Migration(migrations.Migration):
    dependencies = [("customers", "0005_cpf_hash_unique")]

    operations = [
        migrations.AddField(
            model_name="unifiedcustomer",
            name="phone_plain",
            field=models.CharField("Telefone", max_length=20, default=""),
        ),
        migrations.RunPython(copy_to_plain, copy_back),
        migrations.RemoveField(model_name="unifiedcustomer", name="phone"),
        migrations.RenameField(
            model_name="unifiedcustomer", old_name="phone_plain", new_name="phone"
        ),
    ]
