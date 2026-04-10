from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="globaluser",
            name="job_title",
            field=models.CharField(
                blank=True,
                choices=[
                    ("reception", "Recepção"),
                    ("painting", "Pintura"),
                    ("mechanical", "Mecânica"),
                    ("admin", "Administração"),
                    ("inventory", "Estoque"),
                    ("sales", "Vendas"),
                    ("purchasing", "Compras"),
                ],
                default="",
                max_length=20,
                verbose_name="Setor / Cargo",
            ),
        ),
    ]
