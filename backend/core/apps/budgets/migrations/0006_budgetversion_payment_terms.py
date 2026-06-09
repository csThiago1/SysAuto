from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budgets", "0005_add_vehicle_make_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="budgetversion",
            name="validity_days",
            field=models.IntegerField(
                blank=True, default=30, null=True,
                help_text="Prazo de validade do orçamento em dias",
            ),
        ),
        migrations.AddField(
            model_name="budgetversion",
            name="payment_terms",
            field=models.TextField(
                blank=True, default="",
                help_text="Condições de pagamento ex: 50% entrada + 50% na entrega",
            ),
        ),
        migrations.AddField(
            model_name="budgetversion",
            name="payment_methods",
            field=models.CharField(
                blank=True, default="", max_length=200,
                help_text="Formas aceitas ex: PIX, Cartão, Boleto",
            ),
        ),
        migrations.AddField(
            model_name="budgetversion",
            name="estimated_days",
            field=models.IntegerField(
                blank=True, null=True,
                help_text="Prazo estimado de execução em dias úteis",
            ),
        ),
    ]
