"""
Telefone sai da criptografia e passa a ser texto claro, só dígitos, sem o DDI 55.

Decisão do Thiago (25/11/2026): o número precisa aparecer inteiro na tela e ser
buscado (casar a conversa do WhatsApp com o cliente). O valor antigo é lido
pelo EncryptedCharField do estado histórico (que decifra; linha não cifrada
volta como está), normalizado e gravado numa coluna nova, que toma o lugar
da antiga. Nenhuma linha é apagada.
"""

from django.db import migrations, models
from django.utils.translation import gettext_lazy as _

from apps.persons.utils import normalize_phone, sha256_hex


def copy_to_plain(apps, schema_editor) -> None:
    Model = apps.get_model("hr", "Employee")
    batch = []
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.personal_phone_plain = normalize_phone(obj.personal_phone or "")
        obj.emergency_contact_phone_plain = normalize_phone(obj.emergency_contact_phone or "")
        batch.append(obj)
        if len(batch) >= 500:
            Model.objects.bulk_update(
                batch, ["personal_phone_plain", "emergency_contact_phone_plain"]
            )
            batch = []
    if batch:
        Model.objects.bulk_update(batch, ["personal_phone_plain", "emergency_contact_phone_plain"])


def copy_back(apps, schema_editor) -> None:
    # Volta o valor para a coluna cifrada (que já foi recriada pelo reverso do RemoveField).
    Model = apps.get_model("hr", "Employee")
    for obj in Model.objects.all().iterator(chunk_size=500):
        obj.personal_phone = obj.personal_phone_plain
        obj.emergency_contact_phone = obj.emergency_contact_phone_plain
        obj.save(update_fields=["personal_phone", "emergency_contact_phone"])


class Migration(migrations.Migration):
    dependencies = [("hr", "0010_add_vacation_and_payslip_type")]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="personal_phone_plain",
            field=models.CharField(_("Telefone pessoal"), max_length=20, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="employee",
            name="emergency_contact_phone_plain",
            field=models.CharField(
                _("Contato emergência — telefone"), max_length=20, blank=True, default=""
            ),
        ),
        migrations.RunPython(copy_to_plain, copy_back),
        migrations.RemoveField(model_name="employee", name="personal_phone"),
        migrations.RenameField(
            model_name="employee", old_name="personal_phone_plain", new_name="personal_phone"
        ),
        migrations.RemoveField(model_name="employee", name="emergency_contact_phone"),
        migrations.RenameField(
            model_name="employee",
            old_name="emergency_contact_phone_plain",
            new_name="emergency_contact_phone",
        ),
    ]
