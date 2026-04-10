from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="person",
            name="logo_url",
            field=models.CharField(blank=True, default="", max_length=500, verbose_name="URL do logo"),
        ),
    ]
