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
    Model = apps.get_model("cilia", "OrcamentoCilia")
    batch = []
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.client_phone_plain = normalize_phone(obj.client_phone or "")
        batch.append(obj)
        if len(batch) >= 500:
            Model.objects.bulk_update(batch, ["client_phone_plain"])
            batch = []
    if batch:
        Model.objects.bulk_update(batch, ["client_phone_plain"])


def copy_back(apps, schema_editor) -> None:
    # Volta o valor para a coluna cifrada (que já foi recriada pelo reverso do RemoveField).
    Model = apps.get_model("cilia", "OrcamentoCilia")
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.client_phone = obj.client_phone_plain
        obj.save(update_fields=["client_phone"])


class Migration(migrations.Migration):
    dependencies = [("cilia", "0005_backfill_encrypt_client_pii")]

    operations = [
        migrations.AddField(
            model_name="orcamentocilia",
            name="client_phone_plain",
            field=models.CharField(max_length=30, blank=True, default=""),
        ),
        migrations.RunPython(copy_to_plain, copy_back),
        migrations.RemoveField(model_name="orcamentocilia", name="client_phone"),
        migrations.RenameField(
            model_name="orcamentocilia", old_name="client_phone_plain", new_name="client_phone"
        ),
    ]
