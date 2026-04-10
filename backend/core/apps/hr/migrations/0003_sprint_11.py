"""
Migration Sprint 11:
  B-1: Employee.pay_frequency
  B-2: Deduction.discount_type, Deduction.rate, Deduction.amount (null=True)
  B-3: GoalTarget.is_recurring, GoalTarget.recurrence_day, GoalTarget.parent_goal
  B-4: Employee.person (FK → persons.Person)
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        (
            "hr",
            "0002_bonus_deduction_goaltarget_payslip_timeclockentry_and_more",
        ),
        ("persons", "0004_person_job_title_department_choices"),
    ]

    operations = [
        # B-1: Employee.pay_frequency
        migrations.AddField(
            model_name="employee",
            name="pay_frequency",
            field=models.CharField(
                choices=[
                    ("monthly", "Mensal"),
                    ("biweekly", "Quinzenal"),
                    ("weekly", "Semanal"),
                ],
                default="monthly",
                max_length=10,
                verbose_name="Frequência de pagamento",
                help_text="Define o ciclo de pagamento do colaborador.",
            ),
        ),
        # B-4: Employee.person
        migrations.AddField(
            model_name="employee",
            name="person",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employee_profile",
                to="persons.person",
                help_text="Pessoa vinculada ao colaborador (criada automaticamente na admissão).",
                verbose_name="Pessoa",
            ),
        ),
        # B-2: Deduction.amount → null=True, blank=True
        migrations.AlterField(
            model_name="deduction",
            name="amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Sempre positivo — o sinal é dado pelo tipo (desconto)",
                max_digits=10,
                null=True,
            ),
        ),
        # B-2: Deduction.discount_type
        migrations.AddField(
            model_name="deduction",
            name="discount_type",
            field=models.CharField(
                choices=[
                    ("fixed", "Valor Fixo"),
                    ("percentage", "Percentual do Salário"),
                ],
                default="fixed",
                max_length=12,
                verbose_name="Tipo de desconto",
            ),
        ),
        # B-2: Deduction.rate
        migrations.AddField(
            model_name="deduction",
            name="rate",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Usado quando discount_type=percentage. Ex: 11.0 = 11% do salário base.",
                max_digits=5,
                null=True,
                verbose_name="Percentual",
            ),
        ),
        # B-3: GoalTarget.is_recurring
        migrations.AddField(
            model_name="goaltarget",
            name="is_recurring",
            field=models.BooleanField(
                default=False,
                help_text="Se True, será clonada automaticamente no próximo ciclo mensal.",
                verbose_name="Meta recorrente",
            ),
        ),
        # B-3: GoalTarget.recurrence_day
        migrations.AddField(
            model_name="goaltarget",
            name="recurrence_day",
            field=models.IntegerField(
                default=1,
                help_text="Dia do mês para criar a próxima instância (1-28).",
                verbose_name="Dia de reinício",
            ),
        ),
        # B-3: GoalTarget.parent_goal
        migrations.AddField(
            model_name="goaltarget",
            name="parent_goal",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="recurrences",
                to="hr.goaltarget",
                help_text="Meta original que gerou esta instância recorrente.",
            ),
        ),
    ]
