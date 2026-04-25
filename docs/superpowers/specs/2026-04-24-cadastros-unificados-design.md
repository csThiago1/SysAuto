# Spec: Cadastros Unificados — Ciclo 07
**Data:** 2026-04-24
**Status:** Aprovado — aguardando plano de implementação
**Escopo:** Refatoração completa dos módulos de cadastro (Person, Employee, Insurer, Broker, Expert)

---

## Contexto e Problema

O sistema atual tem três entidades que representam "uma pessoa" sem se comunicarem:

- `UnifiedCustomer` (schema público) — usado nas OS
- `Person` (schema tenant) — gerenciado em `/cadastros`
- `Employee` (schema tenant) — gerenciado em `/rh`

Problemas identificados:
1. `Person.document` deprecated desde Ciclo 06A mas ainda é campo primário no frontend
2. `Person.job_title` e `Person.department` duplicam `Employee.position` e `Employee.department`
3. Admissão de colaborador cria `Employee` mas **não cria `Person`** — dois silos
4. `Insurer` público sem dados operacionais por empresa (contatos, SLA, portal)
5. Corretor sem distinção entre escritório (PJ) e corretor individual (PF)
6. Perito sem UI (modelo existe em `apps/experts/` mas sem páginas)
7. Sobre-criptografia: campos como `mother_name`, `father_name`, `rg` criptografados sem necessidade real

---

## Decisões de Design

### Arquitetura: Sub-modelos tipados por role (Abordagem B)

`Person` mantém apenas campos comuns. Cada role ganha seu próprio sub-modelo com FK para `Person`. Padrão já existente: `Employee` já é um sub-modelo de `Person`.

### Criptografia: Cirúrgica, controlada por RBAC

Remover criptografia de campos onde controle de acesso por role é suficiente. Manter apenas onde o dado, vazado isoladamente, causa dano real (LGPD Art. 46).

### Acesso a dados sensíveis: Contexto determina visibilidade

- Listagem: sempre mascarado
- Detalhe individual: visível conforme role do usuário
- Exportações: exige ADMIN+
- Sem botão "revelar" — RBAC de rota é a proteção

### CONSULTANT vê dados de clientes

CONSULTANT é quem cadastra e atende o cliente — tem acesso completo a dados de clientes (CPF, telefone, email, endereço). Dados internos de colaboradores (salário, PIX, documentos) são MANAGER+.

---

## Campos por Tipo de Cadastro

### Base comum (todos os tipos)

| Campo | PF | PJ | Obr. |
|-------|----|----|------|
| Nome completo | ✅ | — | ✅ |
| Razão social | — | ✅ | ✅ |
| Nome fantasia | — | ✅ | ❌ |
| CEP | ✅ | ✅ | ❌ |
| Logradouro | ✅ | ✅ | ❌ |
| Número | ✅ | ✅ | ❌ |
| Complemento | ✅ | ✅ | ❌ |
| Bairro | ✅ | ✅ | ❌ |
| Cidade | ✅ | ✅ | ❌ |
| UF | ✅ | ✅ | ❌ |
| Código IBGE | ✅ | ✅ | ❌ |
| Telefone(s) | ✅ | ✅ | ❌ |
| E-mail(s) | ✅ | ✅ | ❌ |
| Site | ✅ | ✅ | ❌ |
| Observações | ✅ | ✅ | ❌ |
| Ativo | ✅ | ✅ | ✅ |

### Identidade PF

| Campo | Obr. |
|-------|------|
| CPF | ❌ |
| RG | ❌ |
| Órgão emissor RG | ❌ |
| Data de nascimento | ❌ |
| Gênero | ❌ |

### Identidade PJ

| Campo | Obr. |
|-------|------|
| CNPJ | ❌ |
| Inscrição Estadual (IE) | ❌ |
| Inscrição Municipal (IM) | ❌ |
| Tipo de inscrição | ❌ |
| Simples Nacional | ❌ |

### Cliente (CLIENT)

Herda base + identidade PF ou PJ.

| Campo extra | Obr. |
|-------------|------|
| CPF (PF) / CNPJ (PJ) | ❌ |
| Consentimento LGPD | ✅ |
| Compartilhamento entre empresas do grupo | ❌ |

### Seguradora — entidade pública (INSURER)

| Campo | Obr. |
|-------|------|
| CNPJ | ✅ |
| Razão social | ✅ |
| Nome fantasia | ❌ |
| Abreviação (max 5 chars) | ❌ |
| Cor da marca | ❌ |
| Logo | ❌ |
| Integração Cilia | ❌ |

### Seguradora — perfil operacional por empresa (InsurerTenantProfile)

| Campo | Obr. |
|-------|------|
| Contato de sinistros (nome + telefone + e-mail) | ❌ |
| Contato financeiro (nome + telefone + e-mail) | ❌ |
| Contato comercial (nome + telefone + e-mail) | ❌ |
| Portal de acionamento (URL) | ❌ |
| SLA de resposta (dias úteis) | ❌ |
| Observações operacionais | ❌ |

> Peritos **não ficam na seguradora** — são cadastrados em `/cadastros/especialistas` e atendem múltiplas seguradoras.

### Escritório de Corretagem (BROKER — PJ)

| Campo | Obr. |
|-------|------|
| Razão social | ✅ |
| Nome fantasia | ❌ |
| CNPJ | ❌ |
| Telefone(s) | ❌ |
| E-mail(s) | ❌ |
| Site | ❌ |
| Endereço completo | ❌ |
| Corretores vinculados | — |

### Corretor Individual (BROKER — PF)

| Campo | Obr. |
|-------|------|
| Nome completo | ✅ |
| Telefone | ❌ |
| E-mail | ❌ |
| Escritório de corretagem | ❌ |

### Colaborador (EMPLOYEE)

Herda base PF + identidade PF.

**Trabalhistas:**

| Campo | Obr. |
|-------|------|
| Matrícula | ✅ |
| Cargo | ✅ |
| Setor | ✅ |
| Tipo de contrato | ✅ |
| Data de admissão | ✅ |
| Salário base | ✅ |
| Frequência de pagamento | ❌ |
| Carga horária semanal | ❌ |
| Escala | ❌ |

**Pessoais:**

| Campo | Obr. |
|-------|------|
| CPF | ✅ |
| RG + órgão emissor | ❌ |
| Data de nascimento | ❌ |
| Estado civil | ❌ |
| Escolaridade | ❌ |
| Nacionalidade | ❌ |
| Nome da mãe | ❌ |
| Nome do pai | ❌ |

**Contato pessoal:**

| Campo | Obr. |
|-------|------|
| E-mail pessoal | ❌ |
| Telefone pessoal | ❌ |
| Contato de emergência (nome + telefone + parentesco) | ❌ |

**Pagamento:**

| Campo | Obr. |
|-------|------|
| Banco | ❌ |
| Agência + Conta | ❌ |
| Chave PIX + tipo | ❌ |

### Fornecedor (SUPPLIER)

Herda base PF ou PJ + identidade.

| Campo extra | Obr. |
|-------------|------|
| CPF (PF) / CNPJ (PJ) | ❌ |
| Contato principal (nome + telefone) | ❌ |
| Banco + Agência + Conta | ❌ |
| Chave PIX + tipo | ❌ |

### Perito / Especialista (EXPERT)

| Campo | Obr. |
|-------|------|
| Nome completo | ✅ |
| E-mail | ❌ |
| Telefone | ❌ |
| Observações | ❌ |
| Ativo | ✅ |

---

## Backend

### Person — campos removidos

- `document` — hard cut, sem migração de dados (ingest do CSV usará `PersonDocument`)
- `logo_url`, `insurer_code` — movidos para `InsurerTenantProfile`
- `job_title`, `department` — redundantes com `Employee`, removidos

### Novos modelos

**`ClientProfile`** (tenant-level, `apps/persons/`):
```python
person = OneToOneField(Person, related_name="client_profile")
lgpd_consent_version = CharField(max_length=10, default="1.0")
lgpd_consent_date = DateTimeField(null=True)
lgpd_consent_ip = GenericIPAddressField(null=True)
group_sharing_consent = BooleanField(default=False)
```

**`BrokerOffice`** (tenant-level, `apps/persons/`):
```python
person = OneToOneField(Person, related_name="broker_office")
# person_kind=PJ obrigatório — validado no serializer
```

**`BrokerPerson`** (tenant-level, `apps/persons/`):
```python
person = OneToOneField(Person, related_name="broker_person")
office = ForeignKey(BrokerOffice, null=True, on_delete=SET_NULL)
# person_kind=PF obrigatório — validado no serializer
```

**`InsurerTenantProfile`** (tenant-level, `apps/insurers/`):
```python
insurer = ForeignKey(Insurer, on_delete=PROTECT)
contact_sinistro_nome = CharField(max_length=200, blank=True)
contact_sinistro_phone = CharField(max_length=20, blank=True)
contact_sinistro_email = CharField(max_length=200, blank=True)
contact_financeiro_nome = CharField(max_length=200, blank=True)
contact_financeiro_phone = CharField(max_length=20, blank=True)
contact_financeiro_email = CharField(max_length=200, blank=True)
contact_comercial_nome = CharField(max_length=200, blank=True)
contact_comercial_phone = CharField(max_length=20, blank=True)
contact_comercial_email = CharField(max_length=200, blank=True)
portal_url = URLField(blank=True)
sla_dias_uteis = IntegerField(null=True)
observacoes_operacionais = TextField(blank=True)
```

### Employee — ajustes

- `Employee.person` FK preenchida automaticamente na admissão via `EmployeeAdmissionService`
- `rg`, `rg_issuer`, `mother_name`, `father_name`, `marital_status`, `education_level`, `nationality` → `CharField` simples (sem `EncryptedCharField`)
- Mantêm criptografia: `cpf`, `pix_key`, `personal_email`, `personal_phone`
- Campos removidos de `Person` (`job_title`, `department`) já existem em `Employee` — sem perda

### Criptografia revisada

| Campo | Antes | Depois | Motivo |
|-------|-------|--------|--------|
| `Employee.cpf` | encrypted | encrypted | Dado fiscal crítico |
| `Employee.pix_key` | encrypted | encrypted | Dado financeiro |
| `Employee.personal_email` | encrypted | encrypted | Contato direto |
| `Employee.personal_phone` | encrypted | encrypted | Contato direto |
| `Employee.rg` | encrypted | CharField | RBAC suficiente |
| `Employee.mother_name` | encrypted | CharField | RBAC suficiente |
| `Employee.father_name` | encrypted | CharField | RBAC suficiente |
| `PersonContact.value` | encrypted | encrypted | Dado de cliente externo |
| `UnifiedCustomer.cpf/email/phone` | encrypted | encrypted | Dado de cliente externo |

---

## API

### Endpoints

```
GET    /api/v1/persons/                        lista com filtro ?role=&kind=&search=
POST   /api/v1/persons/                        cria Person + profiles
GET    /api/v1/persons/{id}/                   detalhe com profiles embutidos
PATCH  /api/v1/persons/{id}/                   atualiza Person + profiles
DELETE /api/v1/persons/{id}/                   soft delete
GET    /api/v1/persons/{id}/orders/            OS vinculadas

GET    /api/v1/insurers/{id}/tenant-profile/   perfil operacional da seguradora
PUT    /api/v1/insurers/{id}/tenant-profile/   cria ou atualiza (upsert)

GET    /api/v1/experts/                        lista peritos
POST   /api/v1/experts/                        cria (cria Person internamente)
PATCH  /api/v1/experts/{id}/                   atualiza
```

### Padrão de response

```json
{
  "id": 1,
  "person_kind": "PF",
  "full_name": "João Silva",
  "roles": ["CLIENT"],
  "documents": [{ "doc_type": "CPF", "value": "***.***.***-**", "is_primary": true }],
  "contacts": [{ "contact_type": "CELULAR", "value": "(92) 9****-1234" }],
  "addresses": [...],
  "client_profile": { "lgpd_consent_date": "2026-04-24", "group_sharing_consent": false }
}
```

### RBAC por campo

| Dado | CONSULTANT | MANAGER | ADMIN |
|------|-----------|---------|-------|
| Dados de cliente (CPF, telefone, email, endereço) | ✅ completo | ✅ | ✅ |
| Documentos do cliente | ✅ completo | ✅ | ✅ |
| LGPD / group_sharing | ✅ leitura | ✅ edição | ✅ |
| Dados de colaborador — contatos pessoais | ❌ | ✅ | ✅ |
| Dados de colaborador — CPF / documentos | ❌ | ✅ | ✅ |
| Dados de colaborador — salário / PIX / banco | ❌ | mascarado | ✅ |
| Perfil operacional seguradora | ✅ leitura | ✅ edição | ✅ |

---

## Frontend

### Páginas

```
app/(app)/cadastros/
├── page.tsx                    lista unificada — filtro por role
├── novo/page.tsx               formulário de criação
├── [id]/page.tsx               detalhe + edição
├── seguradoras/
│   ├── page.tsx                lista (já existe)
│   └── [id]/page.tsx           detalhe + InsurerTenantProfile (novo)
├── corretores/
│   └── page.tsx                painel escritórios + corretores vinculados
└── especialistas/
    └── page.tsx                lista simples de peritos
```

### Formulário unificado — seções colapsáveis

```
① Tipo + Categoria
② Dados de identidade       (condicional PF/PJ)
③ Endereço                  CEP → auto-fill
④ Contatos                  array dinâmico
⑤ Documentos                array dinâmico (substitui campo document)
⑥ Profile específico        renderiza seção por role
⑦ Observações + Status
```

### `/cadastros/seguradoras/[id]` — tabs

```
Tab 1: Dados Gerais          CNPJ, nome, logo, cor, abreviação, Cilia
Tab 2: Perfil Operacional    Contatos, portal URL, SLA, observações
```

### `/cadastros/corretores`

```
Painel esquerdo:  lista de Escritórios (BrokerOffice — PJ)
Painel direito:   corretores PF vinculados ao escritório selecionado
```

---

## Migração

### Ordem de execução

```
1. Backend: remover campos Person (document, logo_url, insurer_code, job_title, department)
2. Backend: criar ClientProfile, BrokerOffice, BrokerPerson, InsurerTenantProfile
3. Backend: ajustar Employee (descriptografar campos, preencher person FK na admissão)
4. Backend: atualizar serializers e services
5. Frontend: atualizar PersonFormModal → seção Documentos (array)
6. Frontend: atualizar /cadastros/[id] → leitura de documents[]
7. Frontend: criar /seguradoras/[id] com InsurerTenantProfile
8. Frontend: criar /corretores e /especialistas
9. Frontend: ajustar RBAC por contexto
```

### O que NÃO quebra

- OS existentes — não referenciam `Person.document` diretamente
- `UnifiedCustomer` — entidade separada, não afetada
- `Insurer` público — não afetado, só ganha `InsurerTenantProfile` ao lado
- `/rh` — formulário de admissão não muda visivelmente

### O que checar antes da migration destrutiva

- Buscar todo código que lê `person.document` → migrar para `person.documents.filter(is_primary=True)`
- `PersonFormModal` usa `document` → substituído pela seção Documentos
- Serializers que incluem `document` no response → remover campo

---

## Fora do escopo deste ciclo

- Vínculo `Insurer` ↔ `Person [INSURER]` (relação entre público e tenant)
- Corretores vinculados a seguradoras específicas
- Honorários e tabelas comerciais por seguradora
- Ingest do CSV de 8k clientes
- `UnifiedCustomer` ↔ `Person` link (próximo ciclo)
