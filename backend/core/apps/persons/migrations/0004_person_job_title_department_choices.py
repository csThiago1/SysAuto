"""
Migration: converte job_title e department para campos com choices definidos.
Valores em branco permanecem válidos (funcionários sem cargo/setor atribuído).
"""
from django.db import migrations, models


JOB_TITLE_CHOICES = [
    ("receptionist",   "Recepcionista"),
    ("consultant",     "Consultor de Serviços"),
    ("bodyworker",     "Funileiro"),
    ("painter",        "Pintor"),
    ("mechanic",       "Mecânico"),
    ("polisher",       "Polidor"),
    ("washer",         "Lavador"),
    ("storekeeper",    "Almoxarife"),
    ("manager",        "Gerente"),
    ("financial",      "Financeiro"),
    ("administrative", "Administrativo"),
    ("director",       "Diretor"),
]

DEPARTMENT_CHOICES = [
    ("reception",      "Recepção"),
    ("bodywork",       "Funilaria"),
    ("painting",       "Pintura"),
    ("mechanical",     "Mecânica"),
    ("aesthetics",     "Estética"),
    ("polishing",      "Polimento"),
    ("washing",        "Lavagem"),
    ("inventory",      "Almoxarifado"),
    ("financial",      "Financeiro"),
    ("administrative", "Administrativo"),
    ("management",     "Gerência"),
    ("direction",      "Diretoria"),
]


class Migration(migrations.Migration):

    dependencies = [
        ("persons", "0003_person_employee_fields"),
    ]

    operations = [
        # Limpa valores livres que não se encaixam nos novos choices
        migrations.RunSQL(
            sql="UPDATE persons_person SET job_title = '' WHERE job_title NOT IN ("
                "'receptionist','consultant','bodyworker','painter','mechanic',"
                "'polisher','washer','storekeeper','manager','financial','administrative','director'"
                ")",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql="UPDATE persons_person SET department = '' WHERE department NOT IN ("
                "'reception','bodywork','painting','mechanical','aesthetics',"
                "'polishing','washing','inventory','financial','administrative','management','direction'"
                ")",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name="person",
            name="job_title",
            field=models.CharField(
                blank=True,
                choices=JOB_TITLE_CHOICES,
                default="",
                max_length=20,
                verbose_name="Cargo",
            ),
        ),
        migrations.AlterField(
            model_name="person",
            name="department",
            field=models.CharField(
                blank=True,
                choices=DEPARTMENT_CHOICES,
                default="",
                max_length=20,
                verbose_name="Setor",
            ),
        ),
    ]
