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
    Model = apps.get_model("persons", "PersonContact")
    batch = []
    PHONE_TYPES = {"CELULAR", "COMERCIAL", "WHATSAPP"}
    for obj in Model.objects.all().iterator(chunk_size=500):
        value = obj.value or ""
        if obj.contact_type in PHONE_TYPES:
            value = normalize_phone(value)
        obj.value_plain = value
        obj.value_hash = sha256_hex(value) if value else obj.value_hash
        batch.append(obj)
        if len(batch) >= 500:
            Model.objects.bulk_update(batch, ["value_plain", "value_hash"])
            batch = []
    if batch:
        Model.objects.bulk_update(batch, ["value_plain", "value_hash"])


def copy_back(apps, schema_editor) -> None:
    # Volta o valor para a coluna cifrada (que já foi recriada pelo reverso do RemoveField).
    Model = apps.get_model("persons", "PersonContact")
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.value = obj.value_plain
        obj.save(update_fields=["value"])


class Migration(migrations.Migration):
    dependencies = [("persons", "0015_person_followup_opt_out")]

    operations = [
        migrations.AddField(
            model_name="personcontact",
            name="value_plain",
            field=models.CharField("Valor", max_length=200, default=""),
        ),
        migrations.RunPython(copy_to_plain, copy_back),
        migrations.RemoveField(model_name="personcontact", name="value"),
        migrations.RenameField(
            model_name="personcontact", old_name="value_plain", new_name="value"
        ),
    ]
