# Adiciona 'xml_soma' como source choice em ImportAttempt.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cilia', '0002_import_attempt'),
    ]

    operations = [
        migrations.AlterField(
            model_name='importattempt',
            name='source',
            field=models.CharField(
                choices=[
                    ('cilia', 'Cilia API'),
                    ('hdi', 'HDI HTML'),
                    ('xml_porto', 'XML Porto'),
                    ('xml_azul', 'XML Azul'),
                    ('xml_itau', 'XML Itaú'),
                    ('xml_soma', 'XML Soma'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
    ]
