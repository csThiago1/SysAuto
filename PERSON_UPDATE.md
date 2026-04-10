# Refatoração: Módulo de Cadastros — Entidade Unificada de Pessoas

## Contexto do projeto

Monorepo em `/Users/thiagocampos/projetos/grupo-dscar` com:
- **Backend**: Django 5 + DRF em `backend/core/apps/`
- **Frontend**: React + Vite + TypeScript em `apps/dscar-web/src/`
- Stack de UI: Tailwind CSS com design system próprio (classes `bg-primary`, `bg-surface`, `bg-page-bg`, `border-surface`)

## Estado atual a ser SUBSTITUÍDO

O model `Person` atual (`backend/core/apps/persons/models.py`) tem apenas:
```python
full_name, person_type (choices único), phone, email, is_active, created_at, updated_at
```

`ServiceOrder` referencia `Person` via FK `customer`. Isso precisa ser preservado.

---

## O que fazer

### PARTE 1 — Backend Django

#### 1.1 Substituir `backend/core/apps/persons/models.py` completamente
```python
from django.db import models


class RolePessoa(models.TextChoices):
    CLIENTE = "CLIENT", "Cliente"
    SEGURADORA = "INSURER", "Seguradora"
    CORRETOR = "BROKER", "Corretor"
    FUNCIONARIO = "EMPLOYEE", "Funcionário"
    FORNECEDOR = "SUPPLIER", "Fornecedor"


class TipoPessoa(models.TextChoices):
    FISICA = "PF", "Pessoa Física"
    JURIDICA = "PJ", "Pessoa Jurídica"


class TipoContato(models.TextChoices):
    CELULAR = "CELULAR", "Celular"
    COMERCIAL = "COMERCIAL", "Comercial"
    WHATSAPP = "WHATSAPP", "WhatsApp"
    EMAIL = "EMAIL", "E-mail"
    EMAIL_NFE = "EMAIL_NFE", "E-mail NF-e"
    EMAIL_FINANCEIRO = "EMAIL_FINANCEIRO", "E-mail Financeiro"
    SITE = "SITE", "Site"


class TipoEndereco(models.TextChoices):
    PRINCIPAL = "PRINCIPAL", "Principal"
    COBRANCA = "COBRANCA", "Cobrança"
    ENTREGA = "ENTREGA", "Entrega"


class Person(models.Model):
    # Tipo de pessoa
    person_kind = models.CharField(
        max_length=2, choices=TipoPessoa.choices, default=TipoPessoa.FISICA, db_index=True
    )

    # Identificação
    full_name = models.CharField(max_length=200, db_index=True)   # Razão social ou nome completo
    fantasy_name = models.CharField(max_length=200, blank=True, default="")  # Nome fantasia (PJ)

    # Documento principal
    document = models.CharField(max_length=20, blank=True, default="", db_index=True)  # CPF ou CNPJ (só dígitos)

    # Dados fiscais
    secondary_document = models.CharField(max_length=30, blank=True, default="")  # RG ou IE
    municipal_registration = models.CharField(max_length=30, blank=True, default="")
    is_simples_nacional = models.BooleanField(default=False)
    inscription_type = models.CharField(
        max_length=20,
        choices=[("CONTRIBUINTE", "Contribuinte"), ("NAO_CONTRIBUINTE", "Não Contribuinte"), ("ISENTO", "Isento")],
        blank=True, default=""
    )

    # Dados pessoais (PF)
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=1,
        choices=[("M", "Masculino"), ("F", "Feminino"), ("N", "Não informado")],
        blank=True, default=""
    )

    # Seguradora
    logo_url = models.URLField(blank=True, default="")
    insurer_code = models.CharField(max_length=50, blank=True, default="")

    # Situação
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True, default="")

    # Migração legacy (Databox)
    legacy_code = models.CharField(max_length=30, blank=True, default="")
    legacy_category = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.full_name

    # Compatibilidade com código legado que usa person_type
    @property
    def person_type(self) -> str:
        roles = list(self.roles.values_list("role", flat=True))
        if "INSURER" in roles:
            return "INSURER"
        if "BROKER" in roles:
            return "BROKER"
        if "EMPLOYEE" in roles:
            return "EMPLOYEE"
        if "CLIENT" in roles:
            return "CLIENT"
        return roles[0] if roles else "CLIENT"


class PersonRole(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=20, choices=RolePessoa.choices, db_index=True)

    class Meta:
        unique_together = [("person", "role")]

    def __str__(self) -> str:
        return f"{self.person.full_name} — {self.role}"


class PersonContact(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="contacts")
    contact_type = models.CharField(max_length=20, choices=TipoContato.choices)
    value = models.CharField(max_length=200)
    label = models.CharField(max_length=100, blank=True, default="")
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "contact_type"]

    def __str__(self) -> str:
        return f"{self.contact_type}: {self.value}"


class PersonAddress(models.Model):
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="addresses")
    address_type = models.CharField(max_length=20, choices=TipoEndereco.choices, default=TipoEndereco.PRINCIPAL)
    zip_code = models.CharField(max_length=9, blank=True, default="")  # 99999-999
    street = models.CharField(max_length=200, blank=True, default="")
    number = models.CharField(max_length=20, blank=True, default="")
    complement = models.CharField(max_length=100, blank=True, default="")
    neighborhood = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=2, blank=True, default="")  # UF
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "address_type"]

    def __str__(self) -> str:
        return f"{self.street}, {self.number} — {self.city}/{self.state}"
```

#### 1.2 Criar migration manual

Criar `backend/core/apps/persons/migrations/0002_person_unified.py` que:

1. Adiciona todos os campos novos ao model `Person` (`person_kind`, `fantasy_name`, `document`, `secondary_document`, `municipal_registration`, `is_simples_nacional`, `inscription_type`, `birth_date`, `gender`, `logo_url`, `insurer_code`, `notes`, `legacy_code`, `legacy_category`)
2. Cria as tabelas `persons_personrole`, `persons_personcontact`, `persons_personaddress`
3. Faz migration de dados: para cada `Person` existente, cria um `PersonRole` com o valor mapeado:
   - `CLIENT` → `CLIENT`
   - `EMPLOYEE` → `EMPLOYEE`
   - `INSURER` → `INSURER`
   - `BROKER` → `BROKER`
4. Migra `phone` para `PersonContact(contact_type="CELULAR", value=phone)` quando não vazio
5. Migra `email` para `PersonContact(contact_type="EMAIL", value=email)` quando não vazio
6. Remove o campo `person_type` do model `Person` (já coberto por `PersonRole`)

#### 1.3 Atualizar `backend/core/apps/persons/serializers.py`
```python
from rest_framework import serializers
from .models import Person, PersonRole, PersonContact, PersonAddress


class PersonContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonContact
        fields = ["id", "contact_type", "value", "label", "is_primary"]


class PersonAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonAddress
        fields = ["id", "address_type", "zip_code", "street", "number",
                  "complement", "neighborhood", "city", "state", "is_primary"]


class PersonRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonRole
        fields = ["id", "role"]


class PersonListSerializer(serializers.ModelSerializer):
    roles = PersonRoleSerializer(many=True, read_only=True)
    primary_contact = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = ["id", "full_name", "fantasy_name", "person_kind", "document",
                  "roles", "primary_contact", "is_active", "logo_url", "created_at"]
        read_only_fields = fields

    def get_primary_contact(self, obj):
        contact = obj.contacts.filter(is_primary=True).first() or obj.contacts.first()
        if contact:
            return {"type": contact.contact_type, "value": contact.value}
        return None


class PersonCreateUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=["CLIENT", "INSURER", "BROKER", "EMPLOYEE", "SUPPLIER"]),
        write_only=True
    )
    contacts = PersonContactSerializer(many=True, required=False)
    addresses = PersonAddressSerializer(many=True, required=False)

    class Meta:
        model = Person
        fields = [
            "person_kind", "full_name", "fantasy_name", "document",
            "secondary_document", "municipal_registration", "is_simples_nacional",
            "inscription_type", "birth_date", "gender", "logo_url", "insurer_code",
            "is_active", "notes", "roles", "contacts", "addresses",
        ]

    def validate_full_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("Nome deve ter ao menos 2 caracteres.")
        return value.strip()

    def validate_roles(self, value):
        if not value:
            raise serializers.ValidationError("Pelo menos um role é obrigatório.")
        return list(set(value))

    def _sync_roles(self, person, roles):
        existing = set(person.roles.values_list("role", flat=True))
        new_roles = set(roles)
        for role in new_roles - existing:
            PersonRole.objects.create(person=person, role=role)
        person.roles.filter(role__in=existing - new_roles).delete()

    def _sync_contacts(self, person, contacts_data):
        person.contacts.all().delete()
        for c in contacts_data:
            PersonContact.objects.create(person=person, **c)

    def _sync_addresses(self, person, addresses_data):
        person.addresses.all().delete()
        for a in addresses_data:
            PersonAddress.objects.create(person=person, **a)

    def create(self, validated_data):
        roles = validated_data.pop("roles")
        contacts = validated_data.pop("contacts", [])
        addresses = validated_data.pop("addresses", [])
        person = Person.objects.create(**validated_data)
        self._sync_roles(person, roles)
        self._sync_contacts(person, contacts)
        self._sync_addresses(person, addresses)
        return person

    def update(self, instance, validated_data):
        roles = validated_data.pop("roles", None)
        contacts = validated_data.pop("contacts", None)
        addresses = validated_data.pop("addresses", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if roles is not None:
            self._sync_roles(instance, roles)
        if contacts is not None:
            self._sync_contacts(instance, contacts)
        if addresses is not None:
            self._sync_addresses(instance, addresses)
        return instance


class PersonDetailSerializer(serializers.ModelSerializer):
    roles = PersonRoleSerializer(many=True, read_only=True)
    contacts = PersonContactSerializer(many=True, read_only=True)
    addresses = PersonAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Person
        fields = [
            "id", "person_kind", "full_name", "fantasy_name", "document",
            "secondary_document", "municipal_registration", "is_simples_nacional",
            "inscription_type", "birth_date", "gender", "logo_url", "insurer_code",
            "is_active", "notes", "roles", "contacts", "addresses",
            "legacy_code", "legacy_category", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
```

#### 1.4 Atualizar `backend/core/apps/persons/views.py`
```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
import requests

from .models import Person
from .serializers import (
    PersonListSerializer, PersonDetailSerializer, PersonCreateUpdateSerializer
)


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.prefetch_related("roles", "contacts", "addresses").order_by("-created_at")
    filterset_fields = ["person_kind", "is_active"]
    search_fields = ["full_name", "fantasy_name", "document", "contacts__value"]

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(roles__role=role)
        return qs.distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return PersonListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PersonCreateUpdateSerializer
        return PersonDetailSerializer

    def destroy(self, request, *args, **kwargs):
        # Soft delete
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="cep/(?P<cep>[0-9]{8})")
    def cep_lookup(self, request, cep=None):
        try:
            resp = requests.get(f"https://viacep.com.br/ws/{cep}/json/", timeout=5)
            resp.raise_for_status()
            data = resp.json()
            if "erro" in data:
                return Response({"error": "CEP não encontrado"}, status=404)
            return Response({
                "zip_code": data.get("cep", ""),
                "street": data.get("logradouro", ""),
                "neighborhood": data.get("bairro", ""),
                "city": data.get("localidade", ""),
                "state": data.get("uf", ""),
                "complement": data.get("complemento", ""),
            })
        except Exception:
            return Response({"error": "Erro ao consultar CEP"}, status=400)
```

#### 1.5 Criar seeds de seguradoras

Criar `data/seeds/insurers.py` (ou management command) que popula as seguradoras padrão da DS Car caso não existam:
```python
INSURERS = [
    "Bradesco Seguros",
    "Porto Seguro",
    "Azul Seguros",
    "Itaú Seguros",
    "Mitsui Sumitomo",
    "HDI Seguros",
    "Yelum Seguros",
    "Allianz Seguros",
    "Tokio Marine",
]
# Para cada: criar Person(person_kind="PJ", full_name=nome) + PersonRole(role="INSURER")
```

---

### PARTE 2 — Frontend React

#### 2.1 Atualizar `apps/dscar-web/src/types.ts`

Substituir o tipo `Person` e adicionar os novos tipos:
```typescript
// Remover PersonType como union type único
// Adicionar:

export type PersonRole = 'CLIENT' | 'INSURER' | 'BROKER' | 'EMPLOYEE' | 'SUPPLIER';
export type PersonKind = 'PF' | 'PJ';
export type ContactType = 'CELULAR' | 'COMERCIAL' | 'WHATSAPP' | 'EMAIL' | 'EMAIL_NFE' | 'EMAIL_FINANCEIRO' | 'SITE';
export type AddressType = 'PRINCIPAL' | 'COBRANCA' | 'ENTREGA';

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  CLIENT: 'Cliente',
  INSURER: 'Seguradora',
  BROKER: 'Corretor',
  EMPLOYEE: 'Funcionário',
  SUPPLIER: 'Fornecedor',
};

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  CELULAR: 'Celular',
  COMERCIAL: 'Comercial',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  EMAIL_NFE: 'E-mail NF-e',
  EMAIL_FINANCEIRO: 'E-mail Financeiro',
  SITE: 'Site',
};

export interface PersonContact {
  id?: number;
  contact_type: ContactType;
  value: string;
  label?: string;
  is_primary: boolean;
}

export interface PersonAddress {
  id?: number;
  address_type: AddressType;
  zip_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  is_primary: boolean;
}

export interface Person {
  id: string;
  person_kind: PersonKind;
  full_name: string;
  fantasy_name?: string;
  document?: string;
  secondary_document?: string;
  municipal_registration?: string;
  is_simples_nacional?: boolean;
  inscription_type?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'N';
  logo_url?: string;
  insurer_code?: string;
  is_active: boolean;
  notes?: string;
  roles: { id: number; role: PersonRole }[];
  contacts: PersonContact[];
  addresses: PersonAddress[];
  created_at: string;
  // helpers
  primary_contact?: { type: ContactType; value: string } | null;
  // retrocompatibilidade
  name: string;          // alias de full_name (computado no adapter)
  phone: string;         // primeiro contato CELULAR/COMERCIAL
  email: string;         // primeiro contato EMAIL
  type: string;          // primeiro role (para componentes antigos)
}
```

#### 2.2 Atualizar `apps/dscar-web/src/api/persons.ts`

Reescrever completamente para refletir a nova API:
```typescript
import { apiRequest } from './client';
import { Person, PersonContact, PersonAddress, PersonRole } from '../types';

export interface CreatePersonPayload {
  person_kind: 'PF' | 'PJ';
  full_name: string;
  fantasy_name?: string;
  document?: string;
  secondary_document?: string;
  is_simples_nacional?: boolean;
  inscription_type?: string;
  birth_date?: string;
  gender?: string;
  logo_url?: string;
  insurer_code?: string;
  notes?: string;
  roles: PersonRole[];
  contacts: Omit<PersonContact, 'id'>[];
  addresses: Omit<PersonAddress, 'id'>[];
}

// Adapter: normaliza resposta da API para o tipo Person usado no app
function adaptPerson(raw: any): Person {
  const contacts: PersonContact[] = raw.contacts ?? [];
  const phone = contacts.find(c => ['CELULAR', 'COMERCIAL', 'WHATSAPP'].includes(c.contact_type))?.value ?? '';
  const email = contacts.find(c => c.contact_type === 'EMAIL')?.value ?? '';
  return {
    ...raw,
    name: raw.full_name,
    phone,
    email,
    type: raw.roles?.[0]?.role ?? 'CLIENT',
  };
}

interface PaginatedResponse<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listPersons(params?: {
  role?: PersonRole;
  person_kind?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Person>> {
  const query = new URLSearchParams();
  if (params?.role) query.set('role', params.role);
  if (params?.person_kind) query.set('person_kind', params.person_kind);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  const res = await apiRequest<PaginatedResponse<any>>(`/persons/?${query.toString()}`);
  return { ...res, results: res.results.map(adaptPerson) };
}

export async function getPerson(id: number | string): Promise<Person> {
  const raw = await apiRequest<any>(`/persons/${id}/`);
  return adaptPerson(raw);
}

export async function createPerson(data: CreatePersonPayload): Promise<Person> {
  const raw = await apiRequest<any>('/persons/', { method: 'POST', body: JSON.stringify(data) });
  return adaptPerson(raw);
}

export async function updatePerson(id: number | string, data: Partial<CreatePersonPayload>): Promise<Person> {
  const raw = await apiRequest<any>(`/persons/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  return adaptPerson(raw);
}

export async function deactivatePerson(id: number | string): Promise<void> {
  await apiRequest(`/persons/${id}/`, { method: 'DELETE' });
}

export async function lookupCep(cep: string): Promise<{
  zip_code: string; street: string; neighborhood: string; city: string; state: string; complement: string;
}> {
  const cleanCep = cep.replace(/\D/g, '');
  return apiRequest(`/persons/cep/${cleanCep}/`);
}
```

#### 2.3 Atualizar `apps/dscar-web/src/components/Sidebar.tsx`

Trocar o item `people` de `"Pessoas"` para `"Cadastros"` e atualizar o ícone para `UsersRound` (ou manter `Users`):
```typescript
{ id: 'cadastros', label: 'Cadastros', icon: Users, roles: ['Administrador', 'Consultor'] },
```

Remover o `id: 'people'` e adicionar `id: 'cadastros'` no lugar.

#### 2.4 Criar `apps/dscar-web/src/components/Cadastros/` (nova pasta)

Criar os seguintes arquivos:

**`index.tsx`** — componente principal com tabs:
```
Tabs: [Todos] [Clientes] [Seguradoras] [Corretores] [Funcionários] [Fornecedores]
Cada tab passa o filtro de role para o hook usePeople
Botão "+ Nova Pessoa" abre o modal de criação
```

**`PersonTable.tsx`** — tabela reutilizável que recebe `persons: Person[]`. Colunas:
- Avatar com iniciais (2 letras, `bg-surface`)
- Nome / Razão Social + fantasma abaixo se existir
- Badges de roles (pills coloridos)
- Contato principal (ícone + valor)
- Situação (badge Ativo/Inativo)
- Botão editar

**`PersonFormModal.tsx`** — modal com formulário completo de criação/edição. Seções:

*Seção 1 — Tipo e Roles* (sempre visível):
```
Tipo de Pessoa: [○ Pessoa Física] [○ Pessoa Jurídica]
Categorias: pills clicáveis multi-select para cada role
```

*Seção 2 — Dados Gerais* (campos variam por person_kind):
- PF: Nome, CPF (máscara `999.999.999-99`), RG, Data Nascimento, Sexo
- PJ: Razão Social, CNPJ (máscara `99.999.999/9999-99`), Nome Fantasia, IE, IM, tipo inscrição, switches Simples Nacional

*Seção 3 — Contatos* (lista dinâmica com `+` e `×`):
- Select tipo + input valor + input label opcional + toggle Principal

*Seção 4 — Endereços* (lista dinâmica):
- Select tipo + input CEP (busca automática ao sair com 8 dígitos) + campos preenchidos pelo ViaCEP

*Seção 5 — Dados de Seguradora* (só se role INSURER selecionado):
- Input URL do logo + preview circular + código interno

*Rodapé*: Switch Ativo/Inativo + Textarea Observações + botões [Cancelar] [Salvar]

**Validações no submit:**
- `full_name` obrigatório, mínimo 2 chars
- Pelo menos 1 role selecionado
- CPF: 11 dígitos — validar algoritmo (não apenas máscara)
- CNPJ: 14 dígitos — validar algoritmo
- CEP: ao digitar 8 dígitos chamar `lookupCep()` e preencher campos

**`RoleBadge.tsx`** — componente pill de role com cor por tipo:
```
CLIENT → azul (bg-primary/10 text-primary)
INSURER → âmbar (bg-amber-100 text-amber-700)
BROKER → coral/laranja (bg-orange-100 text-orange-700)
EMPLOYEE → verde (bg-emerald-100 text-emerald-700)
SUPPLIER → cinza (bg-slate-100 text-slate-600)
```

#### 2.5 Atualizar `apps/dscar-web/src/App.tsx`

Substituir o case `'people'` por `'cadastros'` no switch/render principal e renderizar o novo componente `<Cadastros />`.

#### 2.6 Atualizar `apps/dscar-web/src/hooks/usePersons.ts`

Refatorar para usar os novos endpoints, manter retrocompatibilidade para componentes que ainda referenciam `people` (ServiceOrders, Dashboard).

---

### PARTE 3 — Compatibilidade com código existente

O model `ServiceOrder` tem `customer = ForeignKey(Person, ...)` — **não muda nada** na tabela, apenas o model `Person` ganhou campos. Nenhuma migration no `service_orders` é necessária.

Componentes que usam `person.name`, `person.phone`, `person.email`, `person.type` continuam funcionando via os campos adaptados no adapter `adaptPerson()`.

O campo `person_type` no backend não existe mais, mas o `@property person_type` no model garante retrocompatibilidade para qualquer código Python existente que o acesse.

---

### PARTE 4 — Ordem de execução

1. Atualizar `models.py`
2. Criar e rodar `0002_person_unified.py` (`python manage.py migrate`)
3. Atualizar `serializers.py` e `views.py`
4. Adicionar `requests` ao `requirements.txt` se não existir
5. Rodar seed de seguradoras
6. Atualizar `types.ts` e `api/persons.ts` no frontend
7. Criar pasta `Cadastros/` com os componentes
8. Atualizar `Sidebar.tsx` e `App.tsx`
9. Testar fluxo completo: criar pessoa PF como Cliente + Corretor, verificar que aparece em ambas as tabs
10. Verificar que OS existentes ainda exibem o cliente corretamente