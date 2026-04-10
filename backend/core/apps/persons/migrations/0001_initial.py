from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Person",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("person_kind", models.CharField(choices=[("PF", "Pessoa Física"), ("PJ", "Pessoa Jurídica")], db_index=True, default="PF", max_length=2, verbose_name="Tipo de pessoa")),
                ("full_name", models.CharField(db_index=True, max_length=200, verbose_name="Nome / Razão social")),
                ("fantasy_name", models.CharField(blank=True, default="", max_length=200, verbose_name="Nome fantasia")),
                ("document", models.CharField(blank=True, db_index=True, default="", max_length=20, verbose_name="CPF / CNPJ (só dígitos)")),
                ("secondary_document", models.CharField(blank=True, default="", max_length=30, verbose_name="RG / IE")),
                ("municipal_registration", models.CharField(blank=True, default="", max_length=30, verbose_name="IM")),
                ("is_simples_nacional", models.BooleanField(default=False, verbose_name="Simples Nacional")),
                ("inscription_type", models.CharField(blank=True, choices=[("CONTRIBUINTE", "Contribuinte"), ("NAO_CONTRIBUINTE", "Não Contribuinte"), ("ISENTO", "Isento")], default="", max_length=20, verbose_name="Tipo de inscrição")),
                ("birth_date", models.DateField(blank=True, null=True, verbose_name="Data de nascimento")),
                ("gender", models.CharField(blank=True, choices=[("M", "Masculino"), ("F", "Feminino"), ("N", "Não informado")], default="", max_length=1, verbose_name="Sexo")),
                ("logo_url", models.URLField(blank=True, default="", verbose_name="URL do logo")),
                ("insurer_code", models.CharField(blank=True, default="", max_length=50, verbose_name="Código interno")),
                ("is_active", models.BooleanField(db_index=True, default=True, verbose_name="Ativo")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Observações")),
                ("legacy_code", models.CharField(blank=True, default="", max_length=30)),
                ("legacy_category", models.CharField(blank=True, default="", max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Pessoa",
                "verbose_name_plural": "Pessoas",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PersonRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("CLIENT", "Cliente"), ("INSURER", "Seguradora"), ("BROKER", "Corretor"), ("EMPLOYEE", "Funcionário"), ("SUPPLIER", "Fornecedor")], db_index=True, max_length=20)),
                ("person", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="roles", to="persons.person")),
            ],
            options={
                "verbose_name": "Role",
                "verbose_name_plural": "Roles",
                "unique_together": {("person", "role")},
            },
        ),
        migrations.CreateModel(
            name="PersonContact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("contact_type", models.CharField(choices=[("CELULAR", "Celular"), ("COMERCIAL", "Comercial"), ("WHATSAPP", "WhatsApp"), ("EMAIL", "E-mail"), ("EMAIL_NFE", "E-mail NF-e"), ("EMAIL_FINANCEIRO", "E-mail Financeiro"), ("SITE", "Site")], max_length=20, verbose_name="Tipo")),
                ("value", models.CharField(max_length=200, verbose_name="Valor")),
                ("label", models.CharField(blank=True, default="", max_length=100, verbose_name="Rótulo")),
                ("is_primary", models.BooleanField(default=False, verbose_name="Principal")),
                ("person", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contacts", to="persons.person")),
            ],
            options={
                "verbose_name": "Contato",
                "verbose_name_plural": "Contatos",
                "ordering": ["-is_primary", "contact_type"],
            },
        ),
        migrations.CreateModel(
            name="PersonAddress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("address_type", models.CharField(choices=[("PRINCIPAL", "Principal"), ("COBRANCA", "Cobrança"), ("ENTREGA", "Entrega")], default="PRINCIPAL", max_length=20, verbose_name="Tipo")),
                ("zip_code", models.CharField(blank=True, default="", max_length=9, verbose_name="CEP")),
                ("street", models.CharField(blank=True, default="", max_length=200, verbose_name="Logradouro")),
                ("number", models.CharField(blank=True, default="", max_length=20, verbose_name="Número")),
                ("complement", models.CharField(blank=True, default="", max_length=100, verbose_name="Complemento")),
                ("neighborhood", models.CharField(blank=True, default="", max_length=100, verbose_name="Bairro")),
                ("city", models.CharField(blank=True, default="", max_length=100, verbose_name="Cidade")),
                ("state", models.CharField(blank=True, default="", max_length=2, verbose_name="UF")),
                ("is_primary", models.BooleanField(default=False, verbose_name="Principal")),
                ("person", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="addresses", to="persons.person")),
            ],
            options={
                "verbose_name": "Endereço",
                "verbose_name_plural": "Endereços",
                "ordering": ["-is_primary", "address_type"],
            },
        ),
    ]
