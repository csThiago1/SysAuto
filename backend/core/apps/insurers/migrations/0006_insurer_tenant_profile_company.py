# Generated manually — Ciclo 07: adiciona FK company a InsurerTenantProfile

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("insurers", "0005_insurer_tenant_profile"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        # 1. Adiciona coluna company_id (nullable — compatível com dados existentes)
        migrations.AddField(
            model_name="insurertenantprofile",
            name="company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="insurer_profiles",
                to="tenants.company",
                verbose_name="Empresa",
            ),
        ),
        # 2. Converte OneToOneField(insurer) → ForeignKey(insurer)
        #    (altera constraint UNIQUE → permite múltiplos por insurer)
        migrations.AlterField(
            model_name="insurertenantprofile",
            name="insurer",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="tenant_profiles",
                to="insurers.insurer",
                verbose_name="Seguradora",
            ),
        ),
        # 3. Adiciona unique_together(insurer, company)
        migrations.AlterUniqueTogether(
            name="insurertenantprofile",
            unique_together={("insurer", "company")},
        ),
    ]
