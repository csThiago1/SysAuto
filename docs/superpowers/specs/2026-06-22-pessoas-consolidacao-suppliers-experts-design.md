# Spec: Consolidação de Pessoas — Suppliers, Experts e Unificação de FKs

**Data:** 2026-06-22
**Status:** Aprovado — aguardando plano de implementação
**Escopo:** Eliminação de `accounts_payable.Supplier`, `experts.Expert` e `pricing_catalog.Fornecedor` em favor de `persons.Person` + perfis OneToOne. Refactor de 9 FKs nos módulos consumidores. UX de cadastro com campos obrigatórios visíveis e masks padronizadas.
**Continuação de:** [2026-04-24-cadastros-unificados-design.md](./2026-04-24-cadastros-unificados-design.md) (Ciclo 07 — Person + Employee + Insurer + Broker + ClientProfile, já implementado).

---

## 1. Contexto e Problema

Apesar do Ciclo 07 ter estabelecido `persons.Person` como entidade raiz para cadastros, **três tabelas paralelas continuam existindo** e ainda são referenciadas por módulos críticos. Isso causa quatro sintomas concretos em produção (DS Car, 30 usuários ativos desde 2026-06-10):

1. **Fornecedor cadastrado em `/cadastros` (role=SUPPLIER) não aparece na aba "Fornecedores"** — autocompletes de Pedido de Compra, OC, Cotação e NF-e de Entrada leem de `accounts_payable.Supplier`, não de `Person`.
2. **8k+ cadastros do seed (126 com role=SUPPLIER) invisíveis** em fluxos de compras.
3. **Tela de Peritos isolada** — `experts.Expert` não compartilha contatos/documentos com Person.
4. **Cliente aparece duplicado** em alguns relatórios — `customers.UnifiedCustomer` e `Person` são consultados separadamente (FORA DO ESCOPO desta sprint — ver §10).

### Estado atual do banco (tenant `tenant_dscar`, 2026-06-22)

| Tabela | Linhas | Destino |
|---|---|---|
| `persons.Person` | 7756 | Mantida (raiz) |
| `persons.PersonRole` role=CLIENT | 7628 | Mantida |
| `persons.PersonRole` role=SUPPLIER | 126 | Mantida (fonte única) |
| `accounts_payable.Supplier` | 6 | **Deletada após migração** |
| `accounts_payable.SupplierContact` | (poucas) | **Deletada — vira `PersonContact`** |
| `experts.Expert` | 0 | **Deletada — app inteiro removido** |
| `pricing_catalog.Fornecedor` | 0 | **Deletada — tabela vazia, nunca usada** |

---

## 2. Decisões de Design (Resumo)

| # | Decisão | Justificativa |
|---|---|---|
| D1 | `Person` é raiz única — perfis OneToOne para dados especializados | Continuidade do Ciclo 07; evita o terceiro nível de duplicação |
| D2 | Sem feature flag — cutover em 1 PR/deploy | Volume baixo (6 linhas reais), risco gerenciável; flag adicionaria complexidade desproporcional |
| D3 | Janela curta de manutenção (~10 min) em produção | Migrations rodam em segundos; impacto aceitável com aviso prévio |
| D4 | Neon branch snapshot obrigatório antes do PR | Único caminho de rollback total se as migrations de drop falharem |
| D5 | UnifiedCustomer fica fora de escopo | Mexer no schema `public` requer planejamento de RLS/multi-tenant separado |
| D6 | CPF/CNPJ sai de "Documentos" e vai pro topo do formulário | Feedback de UX — é o documento primário, obrigatório em 100% dos cadastros |
| D7 | Todos os campos obrigatórios visíveis na criação (sem "expandir mais") | UX — eliminar fricção de descoberta |
| D8 | Masks padronizadas via componentes `<PhoneInput>`, `<CpfCnpjInput>`, `<DateInput>`, `<CepInput>` | Consistência; placeholders em formato de exemplo real |

---

## 3. Modelos

### 3.1 Mantidos sem alteração

- `persons.Person` (raiz)
- `persons.PersonRole` (M:M)
- `persons.PersonDocument` (CPF/CNPJ/RG/IE/IM/CNH com criptografia)
- `persons.PersonContact` (telefone/email com criptografia)
- `persons.PersonAddress` (com `municipio_ibge` pra NFS-e)
- `persons.ClientProfile` (já existe — LGPD)
- `persons.BrokerOffice`, `persons.BrokerPerson` (já existem)
- `hr.Employee` (FK Person — perfil de funcionário; mantido no app `hr/` por coesão com folha/ponto)
- `insurers.Insurer` (schema público — compartilhado entre empresas do grupo)

### 3.2 Adicionado: `persons.SupplierProfile` (novo)

```python
class SupplierProfile(models.Model):
    """Dados contábeis/operacionais do fornecedor."""
    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="supplier_profile"
    )

    class Categoria(models.TextChoices):
        PARTS    = "PARTS",    "Peças"
        SERVICE  = "SERVICE",  "Serviços"
        MATERIAL = "MATERIAL", "Material"
        GENERAL  = "GENERAL",  "Geral"

    category = models.CharField(
        max_length=10, choices=Categoria.choices, default=Categoria.GENERAL
    )

    # Condição comercial padrão
    default_payment_days   = models.PositiveIntegerField(default=30)
    default_payment_method = models.CharField(
        max_length=20, blank=True, default="",
        choices=[  # mesmas choices de accounts_payable.PaymentMethod
            ("bank_transfer", "Transferência"), ("pix", "PIX"),
            ("boleto", "Boleto"), ("check", "Cheque"), ("cash", "Dinheiro"),
        ]
    )

    # Dados bancários (LGPD — criptografados)
    bank_name     = models.CharField(max_length=100, blank=True, default="")
    bank_agency   = models.CharField(max_length=20,  blank=True, default="")
    bank_account  = EncryptedCharField(max_length=50, blank=True, default="")
    pix_key       = EncryptedCharField(max_length=200, blank=True, default="")
    pix_key_type  = models.CharField(
        max_length=10, blank=True, default="",
        choices=[("CPF","CPF"),("CNPJ","CNPJ"),("EMAIL","E-mail"),
                 ("PHONE","Telefone"),("RANDOM","Aleatória")]
    )

    notes = models.TextField(blank=True, default="")

    # Tracking de migração
    legacy_supplier_id = models.IntegerField(null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "Perfil de Fornecedor"
        verbose_name_plural = "Perfis de Fornecedor"
```

### 3.3 Adicionado: `persons.ExpertProfile` (novo)

```python
class ExpertProfile(models.Model):
    """Perfil de perito — substitui experts.Expert."""
    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="expert_profile"
    )
    registration_number = models.CharField(
        max_length=50, blank=True, default="",
        help_text="CREA ou registro profissional"
    )
    insurers = models.ManyToManyField(
        "insurers.Insurer", related_name="experts",
        help_text="Seguradoras para as quais este perito atua"
    )

    legacy_expert_id = models.IntegerField(null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "Perfil de Perito"
        verbose_name_plural = "Perfis de Perito"
```

### 3.4 Adicionado a `RolePessoa`

```python
class RolePessoa(models.TextChoices):
    CLIENTE     = "CLIENT",   "Cliente"
    SEGURADORA  = "INSURER",  "Seguradora"
    CORRETOR    = "BROKER",   "Corretor"
    FUNCIONARIO = "EMPLOYEE", "Funcionário"
    FORNECEDOR  = "SUPPLIER", "Fornecedor"
    PERITO      = "EXPERT",   "Perito"   # NOVO
```

### 3.5 Removidos (após backfill)

- `accounts_payable.Supplier`
- `accounts_payable.SupplierContact`
- `experts.Expert` (app `experts/` removido inteiro)
- `pricing_catalog.Fornecedor` (tabela vazia)

### 3.6 Validação invariante

Adicionar `Person.clean()`:
- Se `person_kind=PF` → exige pelo menos 1 `PersonDocument` com `doc_type=CPF` e `is_primary=True`.
- Se `person_kind=PJ` → exige pelo menos 1 `PersonDocument` com `doc_type=CNPJ` e `is_primary=True`.
- Se `roles` contém `SUPPLIER` → garante criação automática de `SupplierProfile` vazio (signal `post_save` em `PersonRole`).
- Mesma regra para `EXPERT` → `ExpertProfile`, `CLIENT` → `ClientProfile`.

---

## 4. Refactor de Foreign Keys (9 mudanças)

### 4.1 Mapa completo

| Arquivo:linha | Campo | FK Antes | FK Depois |
|---|---|---|---|
| `apps/accounting/models/despesa_recorrente.py:85` | `supplier` | `accounts_payable.Supplier` | `persons.Person` (filtrar role=SUPPLIER) |
| `apps/purchasing/models.py:191` | `fornecedor` (ItemOrdemCompra) | `pricing_catalog.Fornecedor` | `persons.Person` |
| `apps/purchasing/models.py:274` | `supplier` (CotacaoLog) | `accounts_payable.Supplier` | `persons.Person` |
| `apps/purchasing/models.py:279` | `supplier_contact` | `accounts_payable.SupplierContact` | `persons.PersonContact` |
| `apps/purchasing/models.py:314` | `supplier` (RespostaCotacao) | `accounts_payable.Supplier` | `persons.Person` |
| `apps/service_orders/models/service_order.py:168` | `expert` | `experts.Expert` | `persons.Person` (filtrar role=EXPERT) |
| `apps/pricing_catalog/models/supplier.py:77` | `fornecedor` (CodigoFornecedorPeca) | `pricing_catalog.Fornecedor` | `persons.Person` |
| `apps/accounts_payable/models.py:89` | `supplier` (PayableDocument) | `accounts_payable.Supplier` | `persons.Person` |
| `apps/accounts_payable/models.py:70` | `supplier` (SupplierContact) | — | tabela deletada |

### 4.2 FKs já corretas (não tocar)

- `apps/pricing_benchmark/models.py:39` → `fornecedor` aponta para `persons.Person` ✅
- `apps/inventory/models_physical.py:42` → `codigo_fornecedor` aponta para `pricing_catalog.CodigoFornecedorPeca` (intermediário que sobrevive)
- `apps/fiscal/models.py:283` → idem

### 4.3 Limit choices

Toda FK Person que representa um papel específico recebe `limit_choices_to`:
```python
expert = models.ForeignKey(
    "persons.Person", on_delete=models.SET_NULL, null=True, blank=True,
    limit_choices_to={"roles__role": "EXPERT"},
    related_name="service_orders_as_expert"
)
```

---

## 5. Migrations (ordem obrigatória)

### 5.1 Sequência (numeração baseada no estado em 2026-06-22)

```
persons/migrations/                             (último: 0011_add_submodels)
  0012_supplier_expert_profiles.py              — cria SupplierProfile, ExpertProfile, adiciona EXPERT em RolePessoa
  0013_backfill_persons_from_legacy.py          — RunPython: Supplier/Expert → Person + Profile, popula legacy_*_id

accounts_payable/migrations/                    (último: 0006_suppliercontact)
  0007_add_payable_person_fk.py                 — adiciona PayableDocument.person FK nullable + backfill
  0008_swap_payable_supplier_fk.py              — drop FK supplier; rename person → supplier (preserva nome)
  0009_drop_supplier_tables.py                  — drop Supplier, SupplierContact (depende de 0008 + purchasing 0007)

accounting/migrations/                          (último: 0004_despesarecorrente_supplier_dia)
  0005_swap_despesa_recorrente_fk.py            — DespesaRecorrente.supplier: Supplier → Person

purchasing/migrations/                          (último: 0004)
  0005_add_person_fks_nullable.py               — adiciona 3 person FKs nullable (Item, Cotacao, Resposta)
  0006_backfill_person_fks.py                   — RunPython popula via mapping
  0007_swap_purchasing_fks.py                   — drop FKs antigas; rename person → supplier/fornecedor

pricing_catalog/migrations/                     (último: 0002_pecacanonica_ncm)
  0003_swap_codigo_fornecedor.py                — CodigoFornecedorPeca.fornecedor: Fornecedor → Person
  0004_drop_fornecedor_table.py                 — tabela vazia, drop direto

service_orders/migrations/                      (último: 0031_add_external_invoice)
  0032_swap_expert_fk.py                        — ServiceOrder.expert: experts.Expert → persons.Person

experts/  (app inteiro removido)
  0NNN_drop_expert_table.py                     — migration final que dropa Expert
  Remover de INSTALLED_APPS em commit seguinte (após confirmar deploy estável)

Dependências críticas (definir em Migration.dependencies):
  - persons.0013 depende de persons.0012
  - accounts_payable.0007 depende de persons.0013
  - accounts_payable.0008 depende de accounts_payable.0007
  - accounts_payable.0009 depende de accounts_payable.0008 E purchasing.0007 E accounting.0005
  - purchasing.0006 depende de persons.0013 E pricing_catalog.0003
  - purchasing.0007 depende de purchasing.0006
  - service_orders.0032 depende de persons.0013
  - experts.0NNN_drop depende de service_orders.0032
```

### 5.2 Validador (executar antes do deploy)

`backend/core/apps/persons/management/commands/validate_persons_migration.py`:

```python
class Command(BaseCommand):
    def handle(self, *args, **opts):
        for tenant_schema in get_tenant_schemas():
            with schema_context(tenant_schema):
                # BLOCKERs — exit 1 se houver
                self._check_orphan_supplier_fks()
                self._check_orphan_expert_fks()
                self._check_missing_primary_doc()
                self._check_duplicate_cpf_in_tenant()
                self._check_payable_person_backfilled()
                # WARNINGs — log mas não bloqueia
                self._check_persons_supplier_without_profile()
```

Executado:
- Pre-PR (manual)
- CI no PR (job dedicado)
- Pre-deploy em produção (manual, com Neon branch snapshot)
- Post-deploy (smoke test)

---

## 6. UI (Frontend)

### 6.1 Tela de listagem `/cadastros` — existente, mínima alteração

`apps/dscar-web/src/components/Cadastros/index.tsx`:
- Adicionar tab `"EXPERT" → "Peritos"` no array `TABS`.
- Sem mudança estrutural.

### 6.2 Tela de detalhe `/cadastros/[id]` — nova página

Substitui `PersonFormModal` (modal trava em telas menores; ruim pra editar perfis específicos).

Estrutura:
```
/cadastros/[id]/page.tsx
  └─ <PersonDetail person={...} />
       ├─ <PersonHeader> nome + CPF/CNPJ + badges de roles + botão "+ Papel"
       └─ <Tabs>
            ├─ "Geral"       (sempre)   → dados fiscais, person_kind, fantasy
            ├─ "Documentos"  (sempre)   → secundários (RG, IE, IM, CNH)
            ├─ "Contatos"    (sempre)
            ├─ "Endereços"   (sempre)
            ├─ "Cliente"     (se CLIENT) → ClientProfile (LGPD)
            ├─ "Fornecedor"  (se SUPPLIER) → SupplierProfile
            ├─ "Funcionário" (se EMPLOYEE) → link pro app /rh
            ├─ "Perito"      (se EXPERT) → ExpertProfile
            └─ "Corretor"    (se BROKER) → BrokerOffice/BrokerPerson
```

### 6.3 Formulário de criação — `PersonForm.tsx`

Todos os campos obrigatórios visíveis:

| Campo | Obrigatório | Componente | Placeholder |
|---|---|---|---|
| Tipo (PF/PJ) | ✅ | `<RadioGroup>` | — |
| Nome / Razão social | ✅ | `<Input>` | "Fulano da Silva" |
| CPF (PF) ou CNPJ (PJ) | ✅ | `<CpfCnpjInput>` | "000.000.000-00" |
| Celular | ✅ | `<PhoneInput>` | "(00) 00000-0000" |
| E-mail | ⚪ | `<EmailInput>` | "nome@exemplo.com.br" |
| Data de nascimento (PF) | ⚪ | `<DateInput>` | "DD/MM/AAAA" |
| Sexo (PF) | ⚪ | `<Select>` | — |
| Papéis | ✅ (≥1) | `<CheckboxGroup>` | — |
| CEP | ⚪ | `<CepInput>` + autopreenchimento ViaCEP | "00000-000" |
| Endereço completo | ⚪ | grupo `<Input>` | — |

Validação via Zod schema em `packages/types/persons.ts`.

### 6.4 Componentes de máscara

`apps/dscar-web/src/components/ui/masked-input.tsx` — adicionar:

```tsx
export const DateInput        // máscara 99/99/9999, placeholder "DD/MM/AAAA"
export const CepInput         // máscara 99999-999, placeholder "00000-000"
export const EmailInput       // type=email, placeholder "nome@exemplo.com.br"
export const PixKeyInput      // adapta máscara conforme pix_key_type
```

Já existem: `PhoneInput`, `CpfCnpjInput`.

Todos com:
- `placeholder` em formato de exemplo real
- `onValueChange` retorna valor limpo (sem máscara)
- Asterisco vermelho visual ao lado do label quando `required` prop

### 6.5 Consumidores de Supplier (caminhos verificados em 2026-06-22)

Trocar fonte de `useSuppliers` → `usePersons({ role: 'SUPPLIER' })`:

**Hooks (origem):**
- `apps/dscar-web/src/hooks/usePurchasing.ts`
- `apps/dscar-web/src/hooks/useFinanceiro.ts`
- `apps/dscar-web/src/hooks/index.ts` (barrel)

**Telas que consomem Supplier:**
- `apps/dscar-web/src/app/(app)/financeiro/contas-pagar/novo/page.tsx` — criação de PayableDocument
- `apps/dscar-web/src/components/purchasing/QuotationBuilder.tsx` — montagem de cotação
- `apps/dscar-web/src/components/purchasing/RespostaForm.tsx` — resposta de fornecedor
- `apps/dscar-web/src/components/purchasing/MontarOCModal.tsx` — geração de OC
- `apps/dscar-web/src/components/purchasing/OrdemCompraDetail.tsx` — detalhe de OC
- `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx` — peças na OS
- `apps/dscar-web/src/app/(app)/estoque/nfe-recebida/[id]/page.tsx` — NF-e de entrada

Hook `useSuppliers` (em `usePurchasing.ts`) vira alias que delega para `usePersons({ role: 'SUPPLIER' })` e emite `console.warn` de depreciação. Removido em deploy posterior.

### 6.6 Rotas que somem

`/cadastros/catalogo/fornecedores` e `/cadastros/especialistas`:
- Deletar páginas
- Adicionar redirects em `next.config.js`:
  ```ts
  redirects: [
    { source: '/cadastros/catalogo/fornecedores', destination: '/cadastros?role=SUPPLIER', permanent: true },
    { source: '/cadastros/especialistas', destination: '/cadastros?role=EXPERT', permanent: true },
  ]
  ```

---

## 7. API / Serializers

### 7.1 Novos endpoints

```
GET    /api/v1/persons/?role=SUPPLIER   → existente, sem mudança
GET    /api/v1/persons/?role=EXPERT     → habilitar EXPERT
GET    /api/v1/persons/{id}/            → expande supplier_profile, expert_profile, client_profile conforme roles
PATCH  /api/v1/persons/{id}/profiles/supplier/  → atualiza SupplierProfile
PATCH  /api/v1/persons/{id}/profiles/expert/    → atualiza ExpertProfile
```

### 7.2 Removidos

```
GET/POST/PATCH/DELETE /api/v1/accounts-payable/suppliers/  → 410 Gone
GET/POST/PATCH/DELETE /api/v1/experts/                     → 410 Gone
GET/POST/PATCH/DELETE /api/v1/pricing-catalog/fornecedores/ → 410 Gone
```

Manter os endpoints por 1 deploy retornando `410 Gone` com `Link` header apontando pra `/persons?role=...`.

### 7.3 Serializer ajustado

`PersonSerializer` deve retornar:
```json
{
  "id": 42,
  "person_kind": "PJ",
  "full_name": "Auto Peças Manaus LTDA",
  "primary_document": { "doc_type": "CNPJ", "value_masked": "12.***.***/0001-90" },
  "primary_contact":  { "contact_type": "CELULAR", "value_masked": "(92) ****-9999" },
  "roles": ["SUPPLIER", "CLIENT"],
  "supplier_profile": { "category": "PARTS", "default_payment_days": 30, ... },
  "client_profile":   { "lgpd_consent_date": "..." }
}
```

---

## 8. Testes

### 8.1 Backend (pytest)

- `apps/persons/tests/test_supplier_profile.py`
  - Criar Person com role=SUPPLIER → SupplierProfile criado automaticamente
  - Validação invariante (PF→CPF, PJ→CNPJ)
  - Encryption nos campos bancários
- `apps/persons/tests/test_expert_profile.py` (mesmo padrão)
- `apps/persons/tests/test_migration_backfill.py`
  - Setup: cria Supplier legacy + PayableDocument
  - Roda migration 0013
  - Asserta: Person criada, SupplierProfile populado, PayableDocument.person preenchido
- `apps/persons/tests/test_validate_command.py` — todos os blockers detectados

### 8.2 Frontend (vitest + playwright)

- Unit: máscaras (DateInput, CepInput, EmailInput)
- Component: PersonForm valida CPF/CNPJ obrigatório, mostra erros
- E2E (Playwright):
  - Criar fornecedor em `/cadastros` → aparece no autocomplete de Pedido de Compra
  - Editar SupplierProfile em `/cadastros/[id]` → reflete em OC
  - Redirect `/cadastros/catalogo/fornecedores` → `/cadastros?role=SUPPLIER`

---

## 9. Deploy e Rollback

### 9.1 Ordem de execução

```
1. CI roda validate_persons_migration → bloqueia se houver inconsistência
2. Code review do PR (humano)
3. Aviso aos usuários (Slack/WhatsApp): "Manutenção 22h-22h15"
4. Backup: criar Neon branch snapshot `pre-pessoas-unificacao-2026-06-XX`
5. Merge PR → CI/CD roda migrations
6. Smoke test pós-deploy (validate_persons_migration novamente)
7. Monitorar Sentry por 24h
```

### 9.2 Matriz de rollback

| Ponto de falha | Estratégia | Tempo |
|---|---|---|
| Validador pré-deploy bloqueia | Investigar inconsistência localmente, ajustar data migration | — |
| Migrations falham antes do drop | `migrate <app> <previous>` → reverte; dados preservados | ~2 min |
| Migrations 5.1.swap_* falham após drop | Restore Neon branch + redeploy versão anterior | ~10 min |
| Drop tables falha (5.1.drop) | Idempotente — re-roda. Se persiste, manual SQL | ~5 min |
| Frontend novo com bug pós-deploy | Redeploy versão anterior do frontend; backend continua compatível (FKs antigas removidas mas API `/persons` funciona) | ~3 min |
| Bug descoberto após 24h+ | Hotfix dedicado — sem rollback (estrutural) | — |

### 9.3 Janela de manutenção

- Estimada: 10-15 min
- Comunicação: 1 dia de antecedência via WhatsApp grupo DS Car
- Horário: fora de pico (22h-22h15)

---

## 10. Out of Scope

Itens identificados mas explicitamente excluídos desta sprint:

1. **`customers.UnifiedCustomer`** — consolidação com `Person` requer mexer em schema `public` e RLS multi-tenant; planejar em sprint dedicada.
2. **App `hr/Employee`** — já funciona, não vai mudar de lugar.
3. **Renomeação de apps** — manter `experts/` removido mas não consolidar `accounts_payable` em `accounting`.
4. **Mudança de criptografia** — `Person.full_name` e similares continuam não-criptografados (decisão do Ciclo 07).
5. **CPF único por tenant globalmente** — `PersonDocument.value_hash` já é unique por (person, doc_type); não adiciona unique tenant-wide nesta sprint.
6. **Importação de UnifiedCustomer pra Person** — fora de escopo (mesma razão do item 1).

---

## 11. Métricas de Sucesso

Pós-deploy, validar:

| Métrica | Como medir | Critério |
|---|---|---|
| Fornecedor cadastrado aparece em OC | Manual: criar Person+SUPPLIER, abrir OC, verificar autocomplete | ✅ aparece imediatamente |
| Zero Supplier órfão | `validate_persons_migration` | `0 BLOCKERs` |
| Todos os PayableDocument com `person` | SQL: `SELECT COUNT(*) WHERE person_id IS NULL` | `= 0` |
| Tab "Peritos" funcional | Manual: navegar `/cadastros` → tab Peritos | Lista vazia mas funcional |
| Redirects funcionam | `curl /cadastros/catalogo/fornecedores -I` | `301 → /cadastros?role=SUPPLIER` |
| Masks aplicadas | Manual: criar Person, validar placeholders | Todos os campos obrigatórios mostram exemplo |
| Performance lista | `/cadastros` carrega 7756 Person | <1.5s (com paginação) |

---

## 12. Referências

- [2026-04-24-cadastros-unificados-design.md](./2026-04-24-cadastros-unificados-design.md) — spec pai (Ciclo 07)
- [CLAUDE.md](../../../CLAUDE.md) — convenções do monorepo (multitenancy, RBAC, LGPD)
- Arquivos-chave:
  - `backend/core/apps/persons/models.py`
  - `backend/core/apps/accounts_payable/models.py`
  - `backend/core/apps/experts/models.py`
  - `apps/dscar-web/src/components/Cadastros/index.tsx`
  - `apps/dscar-web/src/components/ui/masked-input.tsx`
