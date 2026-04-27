# Cadastros Unificados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar cadastros do DS Car — limpar Person, criar sub-modelos por role, InsurerTenantProfile operacional, auto-vinculação Employee↔Person, páginas de Corretores e Especialistas.

**Architecture:** `Person` mantém apenas dados comuns. Cada role ganha sub-modelo com OneToOneField para Person (ClientProfile, BrokerOffice, BrokerPerson). InsurerTenantProfile é tenant-level e faz FK para o Insurer público. Employee auto-cria Person na admissão via service.

**Tech Stack:** Django 5 + DRF + pytest-django (backend) · Next.js 15 + TypeScript strict + TanStack Query v5 + React Hook Form + shadcn/ui (frontend)

**Branch:** `ciclo-07-cadastros-unificados`

---

## Mapa de Arquivos

### Backend — criar
- `backend/core/apps/persons/migrations/0010_person_cleanup.py`
- `backend/core/apps/persons/migrations/0011_add_submodels.py`
- `backend/core/apps/hr/migrations/0005_employee_fields.py`
- `backend/core/apps/insurers/migrations/0005_insurer_tenant_profile.py`

### Backend — modificar
- `backend/core/apps/persons/models.py` — remove 5 campos deprecated
- `backend/core/apps/persons/serializers.py` — adapta a sub-modelos + remove document
- `backend/core/apps/hr/models.py` — descriptografa campos + adiciona banco/parentesco
- `backend/core/apps/hr/serializers.py` — expõe novos campos no EmployeeDetailSerializer
- `backend/core/apps/insurers/models.py` — adiciona InsurerTenantProfile
- `backend/core/apps/insurers/serializers.py` — adiciona InsurerTenantProfileSerializer
- `backend/core/apps/insurers/views.py` — adiciona endpoint tenant_profile
- `backend/core/apps/insurers/urls.py` — registra nova rota

### Frontend — criar
- `apps/dscar-web/src/app/(app)/cadastros/seguradoras/[id]/page.tsx`
- `apps/dscar-web/src/app/(app)/cadastros/corretores/page.tsx`
- `apps/dscar-web/src/app/(app)/cadastros/especialistas/page.tsx`

### Frontend — modificar
- `packages/types/src/person.types.ts` — remove document, adiciona documents array
- `packages/types/src/hr.types.ts` — adiciona campos banco + parentesco emergência
- `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx` — seção Documentos
- `apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx` — usa documents[0] em vez de document
- `apps/dscar-web/src/features/create-os/CustomerPicker.tsx` — usa documents[0]
- `apps/dscar-web/src/hooks/useInsurers.ts` — adiciona useTenantProfile

---

## Task 1: Backend — Remover campos deprecated de Person

**Files:**
- Modify: `backend/core/apps/persons/models.py`
- Create: `backend/core/apps/persons/migrations/0010_person_cleanup.py`

- [ ] **Step 1: Escrever o teste que verifica que os campos não existem mais**

```python
# backend/core/apps/persons/tests/test_person_cleanup.py
from django.test import TestCase
from apps.persons.models import Person

class TestPersonCleanup(TestCase):
    def test_person_has_no_document_field(self):
        assert not hasattr(Person, 'document') or \
               'document' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_logo_url_field(self):
        assert 'logo_url' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_insurer_code_field(self):
        assert 'insurer_code' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_job_title_field(self):
        assert 'job_title' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_department_field(self):
        assert 'department' not in [f.name for f in Person._meta.get_fields()]
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA (campos ainda existem)**

```bash
cd backend && python -m pytest core/apps/persons/tests/test_person_cleanup.py -v
```
Esperado: FAIL — campos ainda existem no modelo

- [ ] **Step 3: Remover os 5 campos do modelo Person**

Em `backend/core/apps/persons/models.py`, remover os seguintes blocos:

```python
# REMOVER — bloco "Documento principal — DEPRECATED"
document = models.CharField(...)  # linhas ~116-118

# REMOVER — bloco "Seguradora"
logo_url = models.CharField(...)   # linhas ~151-154
insurer_code = models.CharField(...) # linhas ~152-154

# REMOVER — bloco "Funcionário"
job_title = models.CharField(...)   # linhas ~157-163
department = models.CharField(...)  # linhas ~164-170
```

Também remover as referências `CargoPessoa` e `SetorPessoa` do import **somente se** não forem mais usadas em outro lugar do mesmo arquivo. Verificar antes de remover:
```bash
grep -n "CargoPessoa\|SetorPessoa" backend/core/apps/persons/models.py
```
Se aparecer somente nas linhas dos campos removidos, remover do import também.

- [ ] **Step 4: Gerar a migration**

```bash
cd backend && python manage.py makemigrations persons --name person_cleanup
```
Esperado: arquivo `0010_person_cleanup.py` gerado com 5 `RemoveField`.

- [ ] **Step 5: Verificar o conteúdo da migration gerada**

Abrir o arquivo gerado e confirmar que contém exatamente:
```python
operations = [
    migrations.RemoveField(model_name='person', name='document'),
    migrations.RemoveField(model_name='person', name='logo_url'),
    migrations.RemoveField(model_name='person', name='insurer_code'),
    migrations.RemoveField(model_name='person', name='job_title'),
    migrations.RemoveField(model_name='person', name='department'),
]
```

- [ ] **Step 6: Aplicar a migration**

```bash
python manage.py migrate_schemas persons
```
Esperado: OK

- [ ] **Step 7: Rodar o teste para verificar que PASSA**

```bash
python -m pytest core/apps/persons/tests/test_person_cleanup.py -v
```
Esperado: 5 PASS

- [ ] **Step 8: Commit**

```bash
git add backend/core/apps/persons/models.py \
        backend/core/apps/persons/migrations/0010_person_cleanup.py \
        backend/core/apps/persons/tests/test_person_cleanup.py
git commit -m "feat(persons): remove campos deprecated de Person (document, logo_url, insurer_code, job_title, department)"
```

---

## Task 2: Backend — Criar ClientProfile, BrokerOffice, BrokerPerson

**Files:**
- Modify: `backend/core/apps/persons/models.py`
- Create: `backend/core/apps/persons/migrations/0011_add_submodels.py`

- [ ] **Step 1: Escrever testes dos novos modelos**

```python
# backend/core/apps/persons/tests/test_submodels.py
from django_tenants.test.cases import TenantTestCase
from apps.persons.models import Person, ClientProfile, BrokerOffice, BrokerPerson

class TestClientProfile(TenantTestCase):
    def setUp(self):
        self.person = Person.objects.create(person_kind="PF", full_name="João Silva")

    def test_create_client_profile(self):
        profile = ClientProfile.objects.create(
            person=self.person,
            lgpd_consent_version="1.0",
        )
        assert profile.pk is not None
        assert profile.group_sharing_consent is False

    def test_person_has_client_profile_accessor(self):
        ClientProfile.objects.create(person=self.person)
        assert self.person.client_profile is not None

class TestBrokerModels(TenantTestCase):
    def test_create_broker_office(self):
        person_pj = Person.objects.create(person_kind="PJ", full_name="Corretora ABC")
        office = BrokerOffice.objects.create(person=person_pj)
        assert office.pk is not None

    def test_create_broker_person_linked_to_office(self):
        person_pj = Person.objects.create(person_kind="PJ", full_name="Corretora ABC")
        office = BrokerOffice.objects.create(person=person_pj)
        person_pf = Person.objects.create(person_kind="PF", full_name="Carlos Corretor")
        broker = BrokerPerson.objects.create(person=person_pf, office=office)
        assert broker.office == office

    def test_create_broker_person_without_office(self):
        person_pf = Person.objects.create(person_kind="PF", full_name="Maria Corretora")
        broker = BrokerPerson.objects.create(person=person_pf)
        assert broker.office is None
```

- [ ] **Step 2: Rodar os testes para verificar que FALHAM**

```bash
python -m pytest core/apps/persons/tests/test_submodels.py -v
```
Esperado: ImportError (modelos não existem)

- [ ] **Step 3: Adicionar os modelos em `persons/models.py`**

Adicionar ao final do arquivo (após a classe `PersonAddress`):

```python
class ClientProfile(models.Model):
    """
    Perfil de cliente — dados de consentimento LGPD por pessoa.
    OneToOne: uma pessoa pode ter um único perfil de cliente.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="client_profile",
        verbose_name="Pessoa",
    )
    lgpd_consent_version = models.CharField(
        max_length=10, default="1.0", verbose_name="Versão do consentimento LGPD"
    )
    lgpd_consent_date = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do consentimento LGPD"
    )
    lgpd_consent_ip = models.GenericIPAddressField(
        null=True, blank=True, verbose_name="IP do consentimento LGPD"
    )
    group_sharing_consent = models.BooleanField(
        default=False,
        verbose_name="Consentimento de compartilhamento no grupo",
        help_text="Opt-in EXPLÍCITO — verificar antes de cross-sell entre empresas do grupo.",
    )

    class Meta:
        verbose_name = "Perfil de Cliente"
        verbose_name_plural = "Perfis de Cliente"

    def __str__(self) -> str:
        return f"ClientProfile — {self.person.full_name}"


class BrokerOffice(models.Model):
    """
    Escritório de corretagem (PJ). Agrupa corretores individuais.
    person_kind=PJ obrigatório — validado no serializer.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="broker_office",
        verbose_name="Pessoa (PJ)",
    )

    class Meta:
        verbose_name = "Escritório de Corretagem"
        verbose_name_plural = "Escritórios de Corretagem"

    def __str__(self) -> str:
        return f"Escritório — {self.person.full_name}"


class BrokerPerson(models.Model):
    """
    Corretor individual (PF). Pode ser vinculado a um BrokerOffice.
    person_kind=PF obrigatório — validado no serializer.
    """

    person = models.OneToOneField(
        Person,
        on_delete=models.CASCADE,
        related_name="broker_person",
        verbose_name="Pessoa (PF)",
    )
    office = models.ForeignKey(
        BrokerOffice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
        verbose_name="Escritório de corretagem",
    )

    class Meta:
        verbose_name = "Corretor"
        verbose_name_plural = "Corretores"

    def __str__(self) -> str:
        return f"Corretor — {self.person.full_name}"
```

- [ ] **Step 4: Gerar e aplicar a migration**

```bash
python manage.py makemigrations persons --name add_submodels
python manage.py migrate_schemas persons
```
Esperado: OK

- [ ] **Step 5: Rodar os testes**

```bash
python -m pytest core/apps/persons/tests/test_submodels.py -v
```
Esperado: 5 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/models.py \
        backend/core/apps/persons/migrations/0011_add_submodels.py \
        backend/core/apps/persons/tests/test_submodels.py
git commit -m "feat(persons): adiciona ClientProfile, BrokerOffice, BrokerPerson"
```

---

## Task 3: Backend — Criar InsurerTenantProfile

**Files:**
- Modify: `backend/core/apps/insurers/models.py`
- Create: `backend/core/apps/insurers/migrations/0005_insurer_tenant_profile.py`

- [ ] **Step 1: Escrever o teste**

```python
# backend/core/apps/insurers/tests/test_tenant_profile.py
from django_tenants.test.cases import TenantTestCase
from apps.insurers.models import Insurer, InsurerTenantProfile

class TestInsurerTenantProfile(TenantTestCase):
    def setUp(self):
        self.insurer = Insurer.objects.create(
            name="Porto Seguro Cia Seguros",
            cnpj="61198164000160",
        )

    def test_create_profile(self):
        profile = InsurerTenantProfile.objects.create(
            insurer=self.insurer,
            sla_dias_uteis=3,
            contact_sinistro_nome="João Sinistros",
        )
        assert profile.pk is not None
        assert profile.sla_dias_uteis == 3

    def test_upsert_idempotente(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer, sla_dias_uteis=3)
        profile, created = InsurerTenantProfile.objects.get_or_create(
            insurer=self.insurer, defaults={"sla_dias_uteis": 5}
        )
        assert not created
        assert profile.sla_dias_uteis == 3  # não sobrescreveu

    def test_insurer_tem_accessor(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer)
        assert hasattr(self.insurer, 'tenant_profile')
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA**

```bash
python -m pytest core/apps/insurers/tests/test_tenant_profile.py -v
```
Esperado: ImportError (modelo não existe)

- [ ] **Step 3: Adicionar `InsurerTenantProfile` em `insurers/models.py`**

Adicionar ao final do arquivo (após a classe `Insurer`):

```python
class InsurerTenantProfile(models.Model):
    """
    Perfil operacional da seguradora por empresa do grupo (tenant-level).

    Complementa o registro público Insurer com dados operacionais locais:
    contatos, SLA, portal de acionamento, observações internas.
    """

    insurer = models.OneToOneField(
        Insurer,
        on_delete=models.PROTECT,
        related_name="tenant_profile",
        verbose_name="Seguradora",
    )

    # Contato de sinistros
    contact_sinistro_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Sinistros — Nome"
    )
    contact_sinistro_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Sinistros — Telefone"
    )
    contact_sinistro_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Sinistros — E-mail"
    )

    # Contato financeiro
    contact_financeiro_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Financeiro — Nome"
    )
    contact_financeiro_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Financeiro — Telefone"
    )
    contact_financeiro_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Financeiro — E-mail"
    )

    # Contato comercial
    contact_comercial_nome = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Comercial — Nome"
    )
    contact_comercial_phone = models.CharField(
        max_length=20, blank=True, default="", verbose_name="Comercial — Telefone"
    )
    contact_comercial_email = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Comercial — E-mail"
    )

    portal_url = models.URLField(
        blank=True, default="", verbose_name="Portal de acionamento (URL)"
    )
    sla_dias_uteis = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="SLA de resposta (dias úteis)"
    )
    observacoes_operacionais = models.TextField(
        blank=True, default="", verbose_name="Observações operacionais"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil Operacional da Seguradora"
        verbose_name_plural = "Perfis Operacionais de Seguradoras"

    def __str__(self) -> str:
        return f"Perfil tenant — {self.insurer.name}"
```

- [ ] **Step 4: Gerar e aplicar migration**

```bash
python manage.py makemigrations insurers --name insurer_tenant_profile
python manage.py migrate_schemas insurers
```

- [ ] **Step 5: Rodar os testes**

```bash
python -m pytest core/apps/insurers/tests/test_tenant_profile.py -v
```
Esperado: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/insurers/models.py \
        backend/core/apps/insurers/migrations/0005_insurer_tenant_profile.py \
        backend/core/apps/insurers/tests/test_tenant_profile.py
git commit -m "feat(insurers): adiciona InsurerTenantProfile com contatos operacionais e SLA"
```

---

## Task 4: Backend — Employee: descriptografar campos + adicionar banco e parentesco

**Files:**
- Modify: `backend/core/apps/hr/models.py`
- Create: `backend/core/apps/hr/migrations/0005_employee_fields.py`

- [ ] **Step 1: Escrever o teste**

```python
# backend/core/apps/hr/tests/test_employee_fields.py
from django.test import TestCase
from apps.hr.models import Employee

class TestEmployeeFields(TestCase):
    def test_rg_is_plain_charfield(self):
        field = Employee._meta.get_field('rg')
        assert field.__class__.__name__ == 'CharField'

    def test_mother_name_is_plain_charfield(self):
        field = Employee._meta.get_field('mother_name')
        assert field.__class__.__name__ == 'CharField'

    def test_father_name_is_plain_charfield(self):
        field = Employee._meta.get_field('father_name')
        assert field.__class__.__name__ == 'CharField'

    def test_emergency_contact_phone_is_plain_charfield(self):
        field = Employee._meta.get_field('emergency_contact_phone')
        assert field.__class__.__name__ == 'CharField'

    def test_has_bank_name_field(self):
        field = Employee._meta.get_field('bank_name')
        assert field.blank is True

    def test_has_bank_agency_field(self):
        Employee._meta.get_field('bank_agency')

    def test_has_bank_account_field(self):
        Employee._meta.get_field('bank_account')

    def test_has_bank_account_type_field(self):
        Employee._meta.get_field('bank_account_type')

    def test_has_emergency_contact_relationship_field(self):
        Employee._meta.get_field('emergency_contact_relationship')
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA**

```bash
python -m pytest core/apps/hr/tests/test_employee_fields.py -v
```
Esperado: FAIL (campos criptografados e novos ausentes)

- [ ] **Step 3: Atualizar `hr/models.py`**

Localizar e substituir os campos criptografados (seção "Dados pessoais — LGPD"):

```python
# ANTES (criptografados):
rg = EncryptedCharField(_("RG"), max_length=20, blank=True, default="")
mother_name = EncryptedCharField(_("Nome da mãe"), max_length=200, blank=True, default="")
father_name = EncryptedCharField(_("Nome do pai"), max_length=200, blank=True, default="")

# DEPOIS (plain CharField):
rg = models.CharField(_("RG"), max_length=20, blank=True, default="")
mother_name = models.CharField(_("Nome da mãe"), max_length=200, blank=True, default="")
father_name = models.CharField(_("Nome do pai"), max_length=200, blank=True, default="")
```

Localizar e substituir na seção "Contato — LGPD":
```python
# ANTES:
emergency_contact_phone = EncryptedCharField(
    _("Contato emergência — telefone"), max_length=20, blank=True, default=""
)

# DEPOIS:
emergency_contact_phone = models.CharField(
    _("Contato emergência — telefone"), max_length=20, blank=True, default=""
)
```

Adicionar novo campo `emergency_contact_relationship` logo após `emergency_contact_phone`:
```python
emergency_contact_relationship = models.CharField(
    _("Contato emergência — parentesco"),
    max_length=50,
    blank=True,
    default="",
    help_text="Ex: Esposa, Pai, Filho",
)
```

Adicionar novo bloco "Dados bancários" após o bloco de Remuneração:
```python
# ── Dados bancários ────────────────────────────────────────────────────────
bank_name = models.CharField(
    _("Banco"), max_length=100, blank=True, default=""
)
bank_agency = models.CharField(
    _("Agência"), max_length=20, blank=True, default=""
)
bank_account = models.CharField(
    _("Conta"), max_length=30, blank=True, default=""
)
bank_account_type = models.CharField(
    _("Tipo de conta"),
    max_length=15,
    blank=True,
    default="",
    help_text="corrente ou poupanca",
)
```

- [ ] **Step 4: Gerar e aplicar migration**

```bash
python manage.py makemigrations hr --name employee_fields
python manage.py migrate_schemas hr
```
Esperado: migration com AlterField (rg, mother_name, father_name, emergency_contact_phone) + AddField (bank_name, bank_agency, bank_account, bank_account_type, emergency_contact_relationship)

- [ ] **Step 5: Rodar os testes**

```bash
python -m pytest core/apps/hr/tests/test_employee_fields.py -v
```
Esperado: 9 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/hr/models.py \
        backend/core/apps/hr/migrations/0005_employee_fields.py \
        backend/core/apps/hr/tests/test_employee_fields.py
git commit -m "feat(hr): descriptografa rg/mother_name/father_name/emergency_phone + adiciona campos bancários e parentesco"
```

---

## Task 5: Backend — Auto-criar Person na admissão de Employee

**Files:**
- Modify: `backend/core/apps/hr/serializers.py`

- [ ] **Step 1: Escrever o teste**

```python
# backend/core/apps/hr/tests/test_employee_admission.py
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from apps.authentication.models import GlobalUser
from apps.hr.models import Employee
from apps.persons.models import Person, PersonRole

class TestEmployeeAutoCreatesPerson(TenantTestCase):
    def setUp(self):
        self.admin = GlobalUser.objects.create_user(
            email="admin@test.com", name="Admin", password="test"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admissao_cria_person(self):
        payload = {
            "name": "Maria Técnica",
            "email": "maria@dscar.com",
            "registration_number": "001",
            "department": "bodywork",
            "position": "bodyworker",
            "contract_type": "clt",
            "hire_date": "2026-04-24",
            "base_salary": "2500.00",
        }
        response = self.client.post("/api/v1/hr/employees/", payload, format="json")
        assert response.status_code == 201

        employee = Employee.objects.get(registration_number="001")
        assert employee.person is not None
        assert employee.person.full_name == "Maria Técnica"
        assert employee.person.person_kind == "PF"

    def test_admissao_cria_person_com_role_employee(self):
        payload = {
            "name": "Carlos Pintor",
            "email": "carlos@dscar.com",
            "registration_number": "002",
            "department": "painting",
            "position": "painter",
            "contract_type": "clt",
            "hire_date": "2026-04-24",
            "base_salary": "3000.00",
        }
        self.client.post("/api/v1/hr/employees/", payload, format="json")
        employee = Employee.objects.get(registration_number="002")
        roles = list(employee.person.roles.values_list("role", flat=True))
        assert "EMPLOYEE" in roles
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA**

```bash
python -m pytest core/apps/hr/tests/test_employee_admission.py -v
```
Esperado: FAIL (person é None após criação)

- [ ] **Step 3: Atualizar `EmployeeCreateSerializer` em `hr/serializers.py`**

Localizar `EmployeeCreateSerializer.create()` e adicionar a criação automática de Person após criar o GlobalUser e antes de criar o Employee:

```python
from django.db import transaction
from apps.persons.models import Person, PersonRole

class EmployeeCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    registration_number = serializers.CharField(max_length=20)
    department = serializers.ChoiceField(choices=SetorPessoa.choices)
    position = serializers.ChoiceField(choices=CargoPessoa.choices)
    contract_type = serializers.ChoiceField(choices=Employee.ContractType.choices)
    hire_date = serializers.DateField()
    base_salary = serializers.DecimalField(max_digits=10, decimal_places=2)
    weekly_hours = serializers.DecimalField(max_digits=4, decimal_places=1, default=44.0, required=False)
    work_schedule = serializers.CharField(max_length=20, default="6x1", required=False)
    pay_frequency = serializers.ChoiceField(choices=Employee.PayFrequency.choices, default="monthly", required=False)
    cpf = serializers.CharField(max_length=11, required=False, allow_blank=True, default="")

    def validate_email(self, value: str) -> str:
        import hashlib
        email_hash = hashlib.sha256(value.lower().encode()).hexdigest()
        if Employee.objects.filter(user__email_hash=email_hash, status__in=["active", "on_leave", "vacation"]).exists():
            raise serializers.ValidationError("Já existe um colaborador ativo com este e-mail.")
        return value

    def validate_registration_number(self, value: str) -> str:
        if Employee.objects.filter(registration_number=value).exists():
            raise serializers.ValidationError("Matrícula já cadastrada.")
        return value

    @transaction.atomic
    def create(self, validated_data: dict) -> Employee:
        name = validated_data.pop("name")
        email = validated_data.pop("email")
        cpf = validated_data.pop("cpf", "")

        # 1. Cria ou localiza GlobalUser
        import hashlib
        email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
        user, _ = GlobalUser.objects.get_or_create(
            email_hash=email_hash,
            defaults={"name": name, "email": email},
        )

        # 2. Cria Person com role EMPLOYEE
        person = Person.objects.create(
            person_kind="PF",
            full_name=name,
        )
        PersonRole.objects.create(person=person, role="EMPLOYEE")

        # 3. Cria Employee vinculado ao Person
        employee = Employee.objects.create(
            user=user,
            person=person,
            cpf=cpf,
            **validated_data,
        )
        return employee
```

- [ ] **Step 4: Rodar os testes**

```bash
python -m pytest core/apps/hr/tests/test_employee_admission.py -v
```
Esperado: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/hr/serializers.py \
        backend/core/apps/hr/tests/test_employee_admission.py
git commit -m "feat(hr): admissão auto-cria Person com role EMPLOYEE vinculado ao Employee"
```

---

## Task 6: Backend — Atualizar serializers de Person

**Files:**
- Modify: `backend/core/apps/persons/serializers.py`

- [ ] **Step 1: Escrever o teste de serializer**

```python
# backend/core/apps/persons/tests/test_serializers_v2.py
from django_tenants.test.cases import TenantTestCase
from apps.persons.models import Person, PersonRole, ClientProfile
from apps.persons.serializers import PersonDetailSerializer, PersonCreateUpdateSerializer

class TestPersonSerializerV2(TenantTestCase):
    def test_detail_serializer_nao_tem_campo_document(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        data = PersonDetailSerializer(person).data
        assert "document" not in data

    def test_detail_serializer_tem_documents_array(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        data = PersonDetailSerializer(person).data
        assert "documents" in data
        assert isinstance(data["documents"], list)

    def test_detail_serializer_tem_client_profile(self):
        person = Person.objects.create(person_kind="PF", full_name="Ana Lima")
        PersonRole.objects.create(person=person, role="CLIENT")
        ClientProfile.objects.create(person=person)
        data = PersonDetailSerializer(person).data
        assert "client_profile" in data
        assert data["client_profile"] is not None

    def test_create_serializer_nao_aceita_campo_document(self):
        payload = {
            "person_kind": "PF",
            "full_name": "Pedro",
            "roles": ["CLIENT"],
            "document": "123.456.789-00",  # campo deprecated
            "contacts": [],
            "addresses": [],
        }
        s = PersonCreateUpdateSerializer(data=payload)
        s.is_valid()
        # document não deve aparecer nos dados validados
        assert "document" not in s.validated_data
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA**

```bash
python -m pytest core/apps/persons/tests/test_serializers_v2.py -v
```
Esperado: FAIL

- [ ] **Step 3: Atualizar `persons/serializers.py`**

**3a — Adicionar `ClientProfileSerializer`** (após `PersonAddressSerializer`):

```python
from .models import Person, PersonAddress, PersonContact, PersonDocument, PersonRole, ClientProfile

class ClientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientProfile
        fields = [
            "lgpd_consent_version",
            "lgpd_consent_date",
            "lgpd_consent_ip",
            "group_sharing_consent",
        ]
        read_only_fields = ["lgpd_consent_date", "lgpd_consent_ip"]
```

**3b — Atualizar `PersonListSerializer`**: remover `document`, `logo_url`, `insurer_code`, `job_title`, `job_title_display`, `department`, `department_display` dos fields.

**3c — Atualizar `PersonDetailSerializer`**: remover os mesmos campos + adicionar `client_profile`:

```python
class PersonDetailSerializer(serializers.ModelSerializer):
    roles = PersonRoleSerializer(many=True, read_only=True)
    documents = PersonDocumentMaskedSerializer(many=True, read_only=True)
    contacts = PersonContactSerializer(many=True, read_only=True)
    addresses = PersonAddressSerializer(many=True, read_only=True)
    client_profile = ClientProfileSerializer(read_only=True)

    class Meta:
        model = Person
        fields = [
            "id",
            "person_kind",
            "full_name",
            "fantasy_name",
            "secondary_document",
            "municipal_registration",
            "is_simples_nacional",
            "inscription_type",
            "birth_date",
            "gender",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
            "roles",
            "documents",
            "contacts",
            "addresses",
            "client_profile",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
```

**3d — Atualizar `PersonCreateUpdateSerializer`**: remover `document`, `logo_url`, `insurer_code`, `job_title`, `department` dos campos.

- [ ] **Step 4: Rodar os testes**

```bash
python -m pytest core/apps/persons/tests/test_serializers_v2.py -v
```
Esperado: 4 PASS

- [ ] **Step 5: Garantir que os testes existentes ainda passam**

```bash
python -m pytest core/apps/persons/tests/ -v
```
Esperado: todos PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/persons/serializers.py \
        backend/core/apps/persons/tests/test_serializers_v2.py
git commit -m "feat(persons): serializers v2 — remove document/logo_url/job_title, adiciona client_profile"
```

---

## Task 7: Backend — Endpoint InsurerTenantProfile

**Files:**
- Modify: `backend/core/apps/insurers/serializers.py`
- Modify: `backend/core/apps/insurers/views.py`
- Modify: `backend/core/apps/insurers/urls.py`

- [ ] **Step 1: Escrever o teste de endpoint**

```python
# backend/core/apps/insurers/tests/test_tenant_profile_endpoint.py
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from apps.authentication.models import GlobalUser
from apps.insurers.models import Insurer, InsurerTenantProfile

class TestInsurerTenantProfileEndpoint(TenantTestCase):
    def setUp(self):
        self.user = GlobalUser.objects.create_user(
            email="admin@test.com", name="Admin", password="test"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.insurer = Insurer.objects.create(
            name="Porto Seguro", cnpj="61198164000160"
        )

    def test_get_profile_sem_dados_retorna_defaults(self):
        response = self.client.get(f"/api/v1/insurers/{self.insurer.id}/tenant_profile/")
        assert response.status_code == 200
        assert response.data["sla_dias_uteis"] is None
        assert response.data["contact_sinistro_nome"] == ""

    def test_put_cria_profile(self):
        payload = {
            "contact_sinistro_nome": "Ana Sinistros",
            "contact_sinistro_phone": "(92) 99999-0000",
            "sla_dias_uteis": 3,
        }
        response = self.client.put(
            f"/api/v1/insurers/{self.insurer.id}/tenant_profile/",
            payload, format="json"
        )
        assert response.status_code == 200
        profile = InsurerTenantProfile.objects.get(insurer=self.insurer)
        assert profile.sla_dias_uteis == 3

    def test_put_atualiza_profile_existente(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer, sla_dias_uteis=5)
        payload = {"sla_dias_uteis": 10}
        self.client.put(
            f"/api/v1/insurers/{self.insurer.id}/tenant_profile/",
            payload, format="json"
        )
        profile = InsurerTenantProfile.objects.get(insurer=self.insurer)
        assert profile.sla_dias_uteis == 10
```

- [ ] **Step 2: Rodar o teste para verificar que FALHA**

```bash
python -m pytest core/apps/insurers/tests/test_tenant_profile_endpoint.py -v
```
Esperado: 404 (rota não existe)

- [ ] **Step 3: Adicionar `InsurerTenantProfileSerializer` em `insurers/serializers.py`**

```python
from .models import Insurer, InsurerTenantProfile

class InsurerTenantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsurerTenantProfile
        fields = [
            "contact_sinistro_nome",
            "contact_sinistro_phone",
            "contact_sinistro_email",
            "contact_financeiro_nome",
            "contact_financeiro_phone",
            "contact_financeiro_email",
            "contact_comercial_nome",
            "contact_comercial_phone",
            "contact_comercial_email",
            "portal_url",
            "sla_dias_uteis",
            "observacoes_operacionais",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
```

- [ ] **Step 4: Adicionar `@action tenant_profile` em `InsurerViewSet` (`insurers/views.py`)**

```python
from apps.insurers.models import Insurer, InsurerTenantProfile
from apps.insurers.serializers import (
    InsurerMinimalSerializer,
    InsurerSerializer,
    InsurerTenantProfileSerializer,
)

# Dentro de InsurerViewSet, adicionar:
@action(detail=True, methods=["get", "put"], url_path="tenant_profile")
def tenant_profile(self, request: Request, pk: str | None = None) -> Response:
    """
    GET  → retorna perfil operacional (ou defaults se não existir)
    PUT  → cria ou atualiza perfil operacional (upsert)
    """
    insurer: Insurer = self.get_object()

    if request.method == "GET":
        profile, _ = InsurerTenantProfile.objects.get_or_create(insurer=insurer)
        return Response(InsurerTenantProfileSerializer(profile).data)

    # PUT — upsert
    profile, _ = InsurerTenantProfile.objects.get_or_create(insurer=insurer)
    serializer = InsurerTenantProfileSerializer(
        profile, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)
```

- [ ] **Step 5: Rodar os testes**

```bash
python -m pytest core/apps/insurers/tests/test_tenant_profile_endpoint.py -v
```
Esperado: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/insurers/serializers.py \
        backend/core/apps/insurers/views.py \
        backend/core/apps/insurers/tests/test_tenant_profile_endpoint.py
git commit -m "feat(insurers): endpoint tenant_profile — GET/PUT perfil operacional por empresa"
```

---

## Task 8: Frontend — Atualizar TypeScript types

**Files:**
- Modify: `packages/types/src/person.types.ts`
- Modify: `packages/types/src/hr.types.ts`

- [ ] **Step 1: Atualizar `person.types.ts`**

Localizar a interface `Person` e remover o campo `document?: string | null`. Garantir que `documents` existe como array:

```typescript
// packages/types/src/person.types.ts

export interface PersonDocument {
  id: number
  doc_type: "CPF" | "CNPJ" | "RG" | "IE" | "IM" | "CNH"
  value_masked: string   // sempre mascarado no frontend
  is_primary: boolean
  issued_by?: string
  issued_at?: string | null
  expires_at?: string | null
}

export interface PersonDocumentWrite {
  doc_type: "CPF" | "CNPJ" | "RG" | "IE" | "IM" | "CNH"
  value: string          // plaintext na escrita
  is_primary: boolean
  issued_by?: string
  issued_at?: string | null
  expires_at?: string | null
}

export interface ClientProfile {
  lgpd_consent_version: string
  lgpd_consent_date: string | null
  lgpd_consent_ip: string | null
  group_sharing_consent: boolean
}

export interface Person {
  id: number
  person_kind: PersonKind
  full_name: string
  fantasy_name: string
  secondary_document: string
  municipal_registration: string
  is_simples_nacional: boolean
  inscription_type: InscriptionType | ""
  birth_date: string | null
  gender: Gender | ""
  is_active: boolean
  notes: string
  created_at: string
  updated_at: string
  roles: PersonRoleEntry[]
  documents: PersonDocument[]    // ← era document: string
  contacts: PersonContact[]
  addresses: PersonAddress[]
  client_profile: ClientProfile | null
}

export interface CreatePersonPayload {
  person_kind: PersonKind
  full_name: string
  fantasy_name?: string
  secondary_document?: string
  municipal_registration?: string
  is_simples_nacional?: boolean
  inscription_type?: InscriptionType | ""
  birth_date?: string | null
  gender?: Gender | ""
  is_active?: boolean
  notes?: string
  roles: PersonRole[]
  documents?: PersonDocumentWrite[]   // ← era document: string
  contacts?: Omit<PersonContact, "id">[]
  addresses?: Omit<PersonAddress, "id">[]
}

export type UpdatePersonPayload = Partial<CreatePersonPayload>

// Adicionar tipos para Broker e InsurerTenantProfile
export interface InsurerTenantProfile {
  contact_sinistro_nome: string
  contact_sinistro_phone: string
  contact_sinistro_email: string
  contact_financeiro_nome: string
  contact_financeiro_phone: string
  contact_financeiro_email: string
  contact_comercial_nome: string
  contact_comercial_phone: string
  contact_comercial_email: string
  portal_url: string
  sla_dias_uteis: number | null
  observacoes_operacionais: string
  updated_at: string
}
```

- [ ] **Step 2: Atualizar `hr.types.ts`**

Adicionar campos novos em `Employee` e `CreateEmployeePayload`:

```typescript
// Em Employee — adicionar campos após emergency_contact_phone:
emergency_contact_relationship: string

// Em Employee — adicionar bloco bancário:
bank_name: string
bank_agency: string
bank_account: string
bank_account_type: "corrente" | "poupanca" | ""

// Em CreateEmployeePayload — adicionar opcionais:
emergency_contact_relationship?: string
bank_name?: string
bank_agency?: string
bank_account?: string
bank_account_type?: "corrente" | "poupanca"

// Em UpdateEmployeePayload — garantir que os mesmos campos opcionais existem
```

- [ ] **Step 3: Verificar que o TypeScript compila sem erros**

```bash
cd apps/dscar-web && npx tsc --noEmit
```
Esperado: erros de compilação apontando onde `person.document` ainda é usado (guia para os próximos steps)

- [ ] **Step 4: Commit dos types**

```bash
git add packages/types/src/person.types.ts packages/types/src/hr.types.ts
git commit -m "feat(types): remove Person.document, adiciona documents[], ClientProfile, InsurerTenantProfile, campos bancários Employee"
```

---

## Task 9: Frontend — PersonFormModal: seção Documentos + remover campos deprecated

**Files:**
- Modify: `apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx`

- [ ] **Step 1: Mapear o que precisa mudar no modal**

No `PersonFormModal.tsx`:
- Remover `document` de `defaultValues` (linha ~89)
- Remover `document` do `useEffect` de reset (linha ~114)
- Remover o campo `document` no formulário (seção `<CpfCnpjInput>`) — linhas ~232-243
- Remover os campos de seguradora: `logo_url` e `insurer_code` (seção 5, linhas ~423-437)
- Remover os campos de funcionário: `job_title` e `department` (seção 6, linhas ~439-480)
- Adicionar nova seção "Documentos" com `useFieldArray`

- [ ] **Step 2: Atualizar o tipo `FormValues` e `defaultValues`**

```typescript
// Atualizar FormValues no topo do componente
type FormValues = Omit<CreatePersonPayload, "roles"> & {
  roles: PersonRole[]
  documents: PersonDocumentWrite[]
}

// Atualizar defaultValues no useForm
defaultValues: {
  person_kind: "PF",
  full_name: "",
  fantasy_name: "",
  secondary_document: "",
  municipal_registration: "",
  is_simples_nacional: false,
  inscription_type: "" as const,
  birth_date: "",
  gender: "" as const,
  is_active: true,
  notes: "",
  roles: ["CLIENT"] as PersonRole[],
  documents: [],
  contacts: [],
  addresses: [],
}
```

- [ ] **Step 3: Adicionar `useFieldArray` para documentos**

```typescript
const { fields: documentFields, append: appendDocument, remove: removeDocument } =
  useFieldArray({ control, name: "documents" })
```

- [ ] **Step 4: Substituir campo `document` pela nova seção Documentos (após seção Dados Gerais)**

```tsx
{/* ── Seção: Documentos ─────────────────────────────────────────── */}
<div className="space-y-2">
  <div className="flex items-center justify-between border-b pb-1">
    <h3 className="text-sm font-semibold text-neutral-700">Documentos</h3>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() =>
        appendDocument({
          doc_type: personKind === "PJ" ? "CNPJ" : "CPF",
          value: "",
          is_primary: documentFields.length === 0,
          issued_by: "",
          issued_at: null,
          expires_at: null,
        })
      }
    >
      + Adicionar
    </Button>
  </div>
  {documentFields.map((field, index) => (
    <div key={field.id} className="space-y-2 p-3 border rounded-md bg-neutral-50">
      <div className="flex items-center justify-between">
        <Controller
          control={control}
          name={`documents.${index}.doc_type`}
          render={({ field: f }) => (
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {personKind === "PF" ? (
                  <>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="RG">RG</SelectItem>
                    <SelectItem value="CNH">CNH</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="IE">Inscrição Estadual</SelectItem>
                    <SelectItem value="IM">Inscrição Municipal</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-neutral-400 hover:text-red-500"
          onClick={() => removeDocument(index)}
        >
          ✕
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Número *</Label>
          <Input
            {...register(`documents.${index}.value`, { required: true })}
            placeholder={watch(`documents.${index}.doc_type`) === "CPF" ? "000.000.000-00" : ""}
          />
        </div>
        <div>
          <Label className="text-xs">Órgão emissor</Label>
          <Input {...register(`documents.${index}.issued_by`)} placeholder="Ex: SSP/AM" />
        </div>
        <div>
          <Label className="text-xs">Validade</Label>
          <Input type="date" {...register(`documents.${index}.expires_at`)} />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <input
          type="checkbox"
          {...register(`documents.${index}.is_primary`)}
          className="accent-primary"
        />
        Principal
      </label>
    </div>
  ))}
</div>
```

- [ ] **Step 5: Remover seções de Seguradora e Funcionário (já não fazem parte de Person)**

Remover as seções 5 e 6 inteiras do JSX (`showInsurerFields` e `showEmployeeFields`). Remover também as constantes `showInsurerFields` e `showEmployeeFields` e os campos `logo_url`, `insurer_code`, `job_title`, `department` do `defaultValues` e do `useEffect`.

- [ ] **Step 6: Atualizar o `onSubmit` para incluir documentos no payload**

O payload já inclui `documents` automaticamente pois está no `FormValues`. Verificar que o hook `useCreatePerson` aceita `documents` no payload (deve aceitar pois `CreatePersonPayload` foi atualizado).

- [ ] **Step 7: Verificar que o TypeScript compila**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep PersonFormModal
```
Esperado: sem erros neste arquivo

- [ ] **Step 8: Commit**

```bash
git add apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx
git commit -m "feat(cadastros): PersonFormModal — seção Documentos (array) substitui campo document deprecated"
```

---

## Task 10: Frontend — Atualizar detalhe e CustomerPicker

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx`
- Modify: `apps/dscar-web/src/features/create-os/CustomerPicker.tsx`

- [ ] **Step 1: Atualizar `/cadastros/[id]/page.tsx`**

Linha 172 — substituir `person.document` pelo primeiro documento da lista:

```tsx
// ANTES:
<InfoItem label={isPF ? "CPF" : "CNPJ"} value={person.document} />

// DEPOIS — mostrar todos os documentos do array:
{person.documents.map((doc) => (
  <InfoItem
    key={doc.id}
    label={doc.doc_type}
    value={`${doc.value_masked}${doc.is_primary ? " · Principal" : ""}`}
  />
))}
```

Adicionar exibição de `client_profile` se existir:

```tsx
{person.client_profile && (
  <div className="mt-4 pt-4 border-t">
    <p className="text-2xs font-medium text-white/40 uppercase tracking-wide mb-2">LGPD</p>
    <div className="grid grid-cols-2 gap-2">
      <InfoItem
        label="Consentimento"
        value={person.client_profile.lgpd_consent_date
          ? formatDate(person.client_profile.lgpd_consent_date)
          : "Não registrado"}
      />
      <InfoItem
        label="Compartilhamento no grupo"
        value={person.client_profile.group_sharing_consent ? "Autorizado" : "Não autorizado"}
        valueClassName={person.client_profile.group_sharing_consent
          ? "text-emerald-600"
          : "text-white/40"}
      />
    </div>
  </div>
)}
```

- [ ] **Step 2: Atualizar `CustomerPicker.tsx`**

Linhas 118 e 179 — substituir `person.document` pelo CPF mascarado do array:

```tsx
// Helper local no topo do componente:
function getDocumentDisplay(person: Person): string {
  const primary = person.documents.find((d) => d.is_primary) ?? person.documents[0]
  return primary ? primary.value_masked : ""
}

// Linha 118 (uso no item selecionado):
{getDocumentDisplay(selected) ? `${getDocumentDisplay(selected)} · ` : ""}

// Linha 179 (uso na lista de resultados):
{getDocumentDisplay(person) ? `${getDocumentDisplay(person)} · ` : ""}
```

- [ ] **Step 3: Verificar compilação**

```bash
cd apps/dscar-web && npx tsc --noEmit
```
Esperado: 0 erros

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/[id]/page.tsx \
        apps/dscar-web/src/features/create-os/CustomerPicker.tsx
git commit -m "feat(cadastros): usa documents[] em vez de document deprecated no detalhe e CustomerPicker"
```

---

## Task 11: Frontend — /cadastros/seguradoras/[id] com InsurerTenantProfile

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/seguradoras/[id]/page.tsx`
- Modify: `apps/dscar-web/src/hooks/useInsurers.ts`

- [ ] **Step 1: Adicionar hooks em `useInsurers.ts`**

```typescript
// Adicionar ao final de useInsurers.ts

export function useInsurerTenantProfile(insurerId: string | null) {
  return useQuery({
    queryKey: ["insurers", insurerId, "tenant-profile"],
    queryFn: () =>
      apiFetch<InsurerTenantProfile>(`/api/proxy/insurers/${insurerId}/tenant_profile/`),
    enabled: !!insurerId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateInsurerTenantProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ insurerId, data }: { insurerId: string; data: Partial<InsurerTenantProfile> }) =>
      apiFetch<InsurerTenantProfile>(`/api/proxy/insurers/${insurerId}/tenant_profile/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { insurerId }) => {
      qc.invalidateQueries({ queryKey: ["insurers", insurerId, "tenant-profile"] })
      toast.success("Perfil operacional atualizado.")
    },
    onError: () => toast.error("Erro ao salvar perfil."),
  })
}
```

Adicionar import de `InsurerTenantProfile` de `@paddock/types`.

- [ ] **Step 2: Criar a página `/cadastros/seguradoras/[id]/page.tsx`**

```tsx
"use client"

import React, { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Textarea } from "@/components/ui"
import { useInsurer, useInsurerTenantProfile, useUpdateInsurerTenantProfile } from "@/hooks/useInsurers"
import type { InsurerTenantProfile } from "@paddock/types"

interface Props {
  params: Promise<{ id: string }>
}

export default function InsurerDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: insurer, isLoading: loadingInsurer } = useInsurer(id)
  const { data: profile, isLoading: loadingProfile } = useInsurerTenantProfile(id)
  const updateProfile = useUpdateInsurerTenantProfile()
  const [activeTab, setActiveTab] = useState<"geral" | "operacional">("geral")

  const { register, handleSubmit } = useForm<Partial<InsurerTenantProfile>>({
    values: profile,
  })

  if (loadingInsurer || loadingProfile) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>
  }
  if (!insurer) return <p className="text-white/50">Seguradora não encontrada.</p>

  async function onSubmit(data: Partial<InsurerTenantProfile>) {
    try {
      await updateProfile.mutateAsync({ insurerId: id, data })
    } catch { /* toast já disparado no hook */ }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cadastros/seguradoras"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-white">{insurer.name}</h1>
          {insurer.trade_name && <p className="text-sm text-white/50">{insurer.trade_name}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["geral", "operacional"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-primary"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {tab === "geral" ? "Dados Gerais" : "Perfil Operacional"}
          </button>
        ))}
      </div>

      {activeTab === "geral" && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-white/40">CNPJ</p><p className="text-sm text-white">{insurer.cnpj}</p></div>
            <div><p className="text-xs text-white/40">Abreviação</p><p className="text-sm text-white">{insurer.abbreviation || "—"}</p></div>
            <div><p className="text-xs text-white/40">Integração Cilia</p><p className="text-sm text-white">{insurer.uses_cilia ? "Sim" : "Não"}</p></div>
          </CardContent>
        </Card>
      )}

      {activeTab === "operacional" && profile && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Contato Sinistros */}
          <Card>
            <CardHeader><CardTitle className="text-base">Contato de Sinistros</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Nome</Label><Input {...register("contact_sinistro_nome")} /></div>
              <div><Label className="text-xs">Telefone</Label><Input {...register("contact_sinistro_phone")} /></div>
              <div><Label className="text-xs">E-mail</Label><Input {...register("contact_sinistro_email")} /></div>
            </CardContent>
          </Card>

          {/* Contato Financeiro */}
          <Card>
            <CardHeader><CardTitle className="text-base">Contato Financeiro</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Nome</Label><Input {...register("contact_financeiro_nome")} /></div>
              <div><Label className="text-xs">Telefone</Label><Input {...register("contact_financeiro_phone")} /></div>
              <div><Label className="text-xs">E-mail</Label><Input {...register("contact_financeiro_email")} /></div>
            </CardContent>
          </Card>

          {/* Contato Comercial */}
          <Card>
            <CardHeader><CardTitle className="text-base">Contato Comercial</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Nome</Label><Input {...register("contact_comercial_nome")} /></div>
              <div><Label className="text-xs">Telefone</Label><Input {...register("contact_comercial_phone")} /></div>
              <div><Label className="text-xs">E-mail</Label><Input {...register("contact_comercial_email")} /></div>
            </CardContent>
          </Card>

          {/* SLA e Portal */}
          <Card>
            <CardHeader><CardTitle className="text-base">SLA e Portal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SLA de resposta (dias úteis)</Label>
                <Input type="number" min={1} max={60} {...register("sla_dias_uteis", { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="text-xs">Portal de acionamento (URL)</Label>
                <Input type="url" placeholder="https://..." {...register("portal_url")} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações operacionais</Label>
                <Textarea rows={3} {...register("observacoes_operacionais")} placeholder="Orientações internas, documentos exigidos..." />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Adicionar `useInsurer(id)` em `useInsurers.ts`** se não existir:

```typescript
export function useInsurer(id: string | null) {
  return useQuery({
    queryKey: ["insurers", id],
    queryFn: () => apiFetch<InsurerFull>(`/api/proxy/insurers/${id}/`),
    enabled: !!id,
  })
}
```

- [ ] **Step 4: Adicionar link para detalhe na lista de seguradoras**

Em `apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx`, adicionar um link de "Ver detalhe" em cada linha da tabela:

```tsx
// Na coluna de ações da tabela, adicionar ao lado do botão de editar:
<Button variant="ghost" size="sm" asChild>
  <Link href={`/cadastros/seguradoras/${insurer.id}`}>Perfil Operacional</Link>
</Button>
```

- [ ] **Step 5: Verificar compilação**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "seguradoras"
```
Esperado: sem erros

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/seguradoras/[id]/page.tsx \
        apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx \
        apps/dscar-web/src/hooks/useInsurers.ts
git commit -m "feat(seguradoras): página de detalhe com tabs Dados Gerais + Perfil Operacional"
```

---

## Task 12: Frontend — /cadastros/corretores

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/corretores/page.tsx`

- [ ] **Step 1: Criar a página de corretores**

```tsx
"use client"

import React, { useState } from "react"
import { Building2, User, Plus } from "lucide-react"
import { Button, Card, CardContent, Input, Skeleton } from "@/components/ui"
import { usePersons } from "@/hooks"
import { PersonFormModal } from "@/components/Cadastros/PersonFormModal"
import type { Person } from "@paddock/types"

export default function CorretoresPage() {
  const { data: offices, isLoading: loadingOffices } = usePersons({ role: "BROKER", kind: "PJ" })
  const [selectedOffice, setSelectedOffice] = useState<Person | null>(null)
  const { data: members, isLoading: loadingMembers } = usePersons(
    selectedOffice ? { role: "BROKER", kind: "PF", search: "" } : undefined
  )
  const [newOfficeOpen, setNewOfficeOpen] = useState(false)
  const [newBrokerOpen, setNewBrokerOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Corretores</h1>
        <Button onClick={() => setNewOfficeOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Escritório
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-6 min-h-[400px]">
        {/* Painel esquerdo — Escritórios */}
        <div className="col-span-2 space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wide mb-3">
            Escritórios <Building2 className="inline h-3 w-3 ml-1" />
          </p>
          {loadingOffices ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (offices?.results ?? []).length === 0 ? (
            <p className="text-sm text-white/40">Nenhum escritório cadastrado.</p>
          ) : (
            (offices?.results ?? []).map((office) => (
              <button
                key={office.id}
                onClick={() => setSelectedOffice(office)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedOffice?.id === office.id
                    ? "border-primary bg-primary/10 text-white"
                    : "border-white/10 hover:border-white/20 text-white/70"
                }`}
              >
                <p className="text-sm font-medium">{office.full_name}</p>
                {office.fantasy_name && (
                  <p className="text-xs text-white/40 mt-0.5">{office.fantasy_name}</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Painel direito — Corretores do escritório selecionado */}
        <div className="col-span-3">
          {!selectedOffice ? (
            <div className="flex items-center justify-center h-full text-white/30">
              <p className="text-sm">Selecione um escritório para ver os corretores</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/40 uppercase tracking-wide">
                  Corretores — {selectedOffice.full_name}
                </p>
                <Button variant="outline" size="sm" onClick={() => setNewBrokerOpen(true)} className="gap-1">
                  <Plus className="h-3 w-3" /> Corretor
                </Button>
              </div>
              {loadingMembers ? (
                <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (members?.results ?? []).length === 0 ? (
                <p className="text-sm text-white/40">Nenhum corretor vinculado.</p>
              ) : (
                (members?.results ?? []).map((broker) => (
                  <Card key={broker.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <User className="h-4 w-4 text-white/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{broker.full_name}</p>
                        <p className="text-xs text-white/40">
                          {broker.contacts.find((c) => c.contact_type === "CELULAR")?.value ?? "Sem telefone"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <PersonFormModal
        open={newOfficeOpen}
        onOpenChange={setNewOfficeOpen}
        defaultRoles={["BROKER"]}
        defaultKind="PJ"
      />
      <PersonFormModal
        open={newBrokerOpen}
        onOpenChange={setNewBrokerOpen}
        defaultRoles={["BROKER"]}
        defaultKind="PF"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar que `usePersons` aceita filtros `{ role, kind }`**

Em `apps/dscar-web/src/hooks/usePersons.ts` (ou equivalente), garantir que o hook aceita e passa os parâmetros `role` e `kind` como query params para `/api/proxy/persons/?role=BROKER&kind=PJ`.

Se o hook não existir com essa assinatura, adicionar:
```typescript
export function usePersons(params?: { role?: string; kind?: string; search?: string }) {
  const query = new URLSearchParams()
  if (params?.role) query.set("role", params.role)
  if (params?.kind) query.set("kind", params.kind)
  if (params?.search) query.set("search", params.search)
  return useQuery({
    queryKey: ["persons", params],
    queryFn: () => fetchList<Person>(`/api/proxy/persons/?${query.toString()}`),
    enabled: params !== undefined,
  })
}
```

- [ ] **Step 3: Adicionar `defaultRoles` e `defaultKind` props ao `PersonFormModal`**

Em `PersonFormModal.tsx`, adicionar props opcionais:
```typescript
interface PersonFormModalProps extends ModalProps {
  person?: Person | null
  defaultRoles?: PersonRole[]
  defaultKind?: "PF" | "PJ"
}
```
E usar nos `defaultValues`:
```typescript
defaultValues: {
  person_kind: defaultKind ?? "PF",
  ...
  roles: defaultRoles ?? ["CLIENT"],
  ...
}
```

- [ ] **Step 4: Adicionar "Corretores" ao Sidebar**

Em `apps/dscar-web/src/components/Sidebar.tsx`, adicionar sob "Cadastros":
```typescript
{ href: "/cadastros/corretores", label: "Corretores", icon: Handshake }
```

- [ ] **Step 5: Verificar compilação**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | grep "corretores"
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/corretores/page.tsx \
        apps/dscar-web/src/components/Cadastros/PersonFormModal.tsx \
        apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(cadastros): página Corretores — painel escritórios + corretores vinculados"
```

---

## Task 13: Frontend — /cadastros/especialistas

**Files:**
- Create: `apps/dscar-web/src/app/(app)/cadastros/especialistas/page.tsx`

- [ ] **Step 1: Criar a página de especialistas**

```tsx
"use client"

import React, { useState } from "react"
import { Plus, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button, Card, CardContent, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, Skeleton } from "@/components/ui"
import { useExperts, useCreateExpert, useUpdateExpert } from "@/hooks/useExperts"
import type { Expert } from "@paddock/types"

interface ExpertFormValues {
  name: string
  email: string
  phone: string
  is_active: boolean
}

export default function EspecialistasPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expert | null>(null)
  const { data: experts, isLoading } = useExperts({ search })
  const createExpert = useCreateExpert()
  const updateExpert = useUpdateExpert()

  const { register, handleSubmit, reset } = useForm<ExpertFormValues>({
    defaultValues: { name: "", email: "", phone: "", is_active: true },
  })

  function openNew() {
    setEditing(null)
    reset({ name: "", email: "", phone: "", is_active: true })
    setFormOpen(true)
  }

  function openEdit(expert: Expert) {
    setEditing(expert)
    reset({ name: expert.name, email: expert.email, phone: expert.phone, is_active: expert.is_active })
    setFormOpen(true)
  }

  async function onSubmit(data: ExpertFormValues) {
    try {
      if (editing) {
        await updateExpert.mutateAsync({ id: editing.id, data })
        toast.success("Especialista atualizado.")
      } else {
        await createExpert.mutateAsync(data)
        toast.success("Especialista cadastrado.")
      }
      setFormOpen(false)
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Especialistas / Peritos</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Especialista
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (experts?.results ?? []).length === 0 ? (
        <p className="text-sm text-white/40 py-8 text-center">Nenhum especialista cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {(experts?.results ?? []).map((expert) => (
            <Card key={expert.id} className="cursor-pointer hover:border-white/20 transition-colors" onClick={() => openEdit(expert)}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="text-sm font-medium text-white">{expert.name}</p>
                  <p className="text-xs text-white/40">
                    {expert.phone || "Sem telefone"} · {expert.email || "Sem e-mail"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${expert.is_active ? "bg-emerald-900/40 text-emerald-400" : "bg-white/5 text-white/30"}`}>
                  {expert.is_active ? "Ativo" : "Inativo"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Especialista" : "Novo Especialista"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input {...register("name", { required: true })} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...register("phone")} placeholder="(92) 99999-0000" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} placeholder="perito@email.com" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
              <input type="checkbox" {...register("is_active")} className="accent-primary" />
              Ativo
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createExpert.isPending || updateExpert.isPending}>
                {createExpert.isPending || updateExpert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Criar `hooks/useExperts.ts`**

```typescript
// apps/dscar-web/src/hooks/useExperts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch, fetchList } from "@/lib/api"
import type { Expert } from "@paddock/types"

const expertsKeys = {
  all: ["experts"] as const,
  list: (params: object) => ["experts", "list", params] as const,
}

export function useExperts(params?: { search?: string }) {
  const query = new URLSearchParams()
  if (params?.search) query.set("search", params.search)
  return useQuery({
    queryKey: expertsKeys.list(params ?? {}),
    queryFn: () => fetchList<Expert>(`/api/proxy/experts/?${query.toString()}`),
  })
}

export function useCreateExpert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; is_active: boolean }) =>
      apiFetch<Expert>("/api/proxy/experts/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expertsKeys.all }),
  })
}

export function useUpdateExpert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expert> }) =>
      apiFetch<Expert>(`/api/proxy/experts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expertsKeys.all }),
  })
}
```

- [ ] **Step 3: Adicionar `Expert` ao `@paddock/types` se não existir**

```typescript
// packages/types/src/expert.types.ts
export interface Expert {
  id: string
  name: string
  phone: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

Exportar de `packages/types/src/index.ts`.

- [ ] **Step 4: Adicionar "Especialistas" ao Sidebar**

```typescript
{ href: "/cadastros/especialistas", label: "Especialistas", icon: UserSearch }
```

- [ ] **Step 5: Verificar compilação**

```bash
cd apps/dscar-web && npx tsc --noEmit
```
Esperado: 0 erros

- [ ] **Step 6: Commit final**

```bash
git add apps/dscar-web/src/app/(app)/cadastros/especialistas/ \
        apps/dscar-web/src/hooks/useExperts.ts \
        packages/types/src/expert.types.ts \
        packages/types/src/index.ts \
        apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(cadastros): página Especialistas — lista com CRUD inline de peritos"
```

---

## Verificação Final

Após completar todas as tasks:

- [ ] Rodar todos os testes do backend:
```bash
cd backend && python -m pytest core/apps/persons/ core/apps/hr/ core/apps/insurers/ core/apps/experts/ -v
```
Esperado: todos PASS

- [ ] Rodar typecheck frontend:
```bash
cd apps/dscar-web && npx tsc --noEmit
```
Esperado: 0 erros

- [ ] Verificar lint:
```bash
make lint
```
Esperado: 0 erros

- [ ] Abrir PR para `main`:
```bash
gh pr create \
  --title "feat(cadastros): Ciclo 07 — Cadastros Unificados" \
  --body "$(cat <<'EOF'
## O que muda

- Remove campos deprecated de Person (document, logo_url, insurer_code, job_title, department)
- Adiciona sub-modelos: ClientProfile, BrokerOffice, BrokerPerson
- Cria InsurerTenantProfile com contatos operacionais e SLA
- Employee auto-cria Person na admissão
- Descriptografa rg/mother_name/father_name/emergency_contact_phone em Employee
- Adiciona campos bancários ao Employee
- Frontend: PersonFormModal com seção Documentos (array)
- Frontend: /cadastros/seguradoras/[id] com Perfil Operacional
- Frontend: /cadastros/corretores — painel escritórios + corretores
- Frontend: /cadastros/especialistas — lista com CRUD

## Spec
docs/superpowers/specs/2026-04-24-cadastros-unificados-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
