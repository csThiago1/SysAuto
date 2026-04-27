# Plano de Implementação — Ciclo 06A: Person LGPD
**Data:** 2026-04-23
**Branch:** `feat/ciclo-06a-person-lgpd` (criada a partir de `feat/fiscal-docs`)
**Sprint:** 2 semanas
**Spec de referência:** `docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md` §3.1

---

## 1. Contexto

### O que já existe em `apps/persons`
| Modelo | Campos relevantes | Situação LGPD |
|--------|-------------------|---------------|
| `Person` | `document` (CPF/CNPJ plain), `secondary_document` (RG/IE plain), `municipal_registration` (IM plain) | ❌ PII em plain text |
| `PersonContact` | `value` (phone/email plain), `contact_type` | ❌ PII em plain text |
| `PersonAddress` | `zip_code`, `street`, `city`, `state` | ⚠️ Sem `municipio_ibge` (obrigatório para NFS-e Manaus) |
| `PersonRole` | `role` choices | ✅ OK |

### O que já existe no projeto
- `encrypted_model_fields` já instalado e usado em `customers`, `hr`, `accounts_payable`
- `EncryptedCharField`, `EncryptedEmailField` disponíveis via `encrypted_model_fields.fields`
- Limitação conhecida (CLAUDE.md): `EncryptedEmailField` não suporta `filter()` → usar `email_hash` SHA-256

### O que falta
1. `PersonDocument` model separado com campos criptografados (CPF, CNPJ, RG, IE, IM)
2. `municipio_ibge` em `PersonAddress` (código IBGE 7 dígitos — exigido pelo payload NFS-e Manaus)
3. Criptografia em `PersonContact.value` para tipos EMAIL e CELULAR/WHATSAPP
4. Admin Django com PII mascarada
5. Serializers com permissão `fiscal_admin` para plaintext
6. ETL `etl_persons_databox.py` (7.789 pessoas do Databox legacy)
7. Frontend: `PersonForm.tsx` com máscaras CPF/CNPJ e campo `municipio_ibge`
8. Smoke test `scripts/smoke_ciclo_06a.py`

---

## 2. Tarefas Atômicas

### T01 — `PersonDocument` model + migration 0005
**Commit:** `feat(persons): PersonDocument model com campos PII criptografados`

**Arquivos criados/modificados:**
- `backend/core/apps/persons/models.py` — adicionar `PersonDocument`
- `backend/core/apps/persons/migrations/0005_person_document.py`

**Definição do modelo:**
```python
class TipoDocumento(models.TextChoices):
    CPF = "CPF", "CPF"
    CNPJ = "CNPJ", "CNPJ"
    RG = "RG", "RG"
    IE = "IE", "Inscrição Estadual"
    IM = "IM", "Inscrição Municipal"
    CNH = "CNH", "CNH"

class PersonDocument(models.Model):
    person = ForeignKey(Person, on_delete=CASCADE, related_name="documents")
    doc_type = CharField(max_length=10, choices=TipoDocumento.choices, db_index=True)
    value = EncryptedCharField(max_length=200)          # plain armazenado criptografado
    value_hash = CharField(max_length=64, db_index=True, default="")  # SHA-256 para filter()
    is_primary = BooleanField(default=False)
    issued_by = CharField(max_length=100, blank=True, default="")
    issued_at = DateField(null=True, blank=True)
    expires_at = DateField(null=True, blank=True)

    class Meta:
        unique_together = [("person", "doc_type", "value_hash")]
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"
```

**Critérios de aceite:**
- `make migrate` sem erros
- `PersonDocument.objects.filter(value_hash=sha256(cpf))` funciona
- `person.documents.filter(doc_type="CPF").first().value` retorna CPF plain

**Testes:** `test_person_document_encryption` — cria, lê, filtra por hash

---

### T02 — `PersonAddress.municipio_ibge` + migration 0006
**Commit:** `feat(persons): adicionar municipio_ibge em PersonAddress`

**Arquivos modificados:**
- `backend/core/apps/persons/models.py` — campo `municipio_ibge`
- `backend/core/apps/persons/migrations/0006_personaddress_municipio_ibge.py`

**Definição:**
```python
# PersonAddress
municipio_ibge = CharField(
    max_length=7, blank=True, default="",
    verbose_name="Código IBGE do município",
    help_text="7 dígitos IBGE. Obrigatório para NFS-e Manaus (1302603)."
)
```

**Critérios de aceite:**
- `PersonAddress(city="Manaus", municipio_ibge="1302603")` salva corretamente
- Campo blank/default → retrocompatível com registros existentes

---

### T03 — Criptografia `PersonContact.value` + migration 0007
**Commit:** `feat(persons): criptografar PersonContact.value + hash para filtro`

**Arquivos modificados:**
- `backend/core/apps/persons/models.py` — `PersonContact` com `value` → `EncryptedCharField` + `value_hash`
- `backend/core/apps/persons/migrations/0007_personcontact_value_encrypt.py`

**Atenção:** migration em duas etapas (SeparateDatabaseAndState):
1. Adicionar `value_hash` (varchar, nullable)
2. `RunPython(atomic=False)` — batch 200 para popular hash dos existentes
3. Tornar `value` → `EncryptedCharField` via `SeparateDatabaseAndState`

**Critérios de aceite:**
- `PersonContact.objects.filter(value_hash=sha256(phone))` retorna registro correto
- Registros existentes têm `value_hash` preenchido

**Testes:** `test_personcontact_encryption`, `test_personcontact_filter_by_hash`

---

### T04 — Data migration: `Person.document` → `PersonDocument` + migration 0008
**Commit:** `feat(persons): data migration backfill Person.document → PersonDocument`

**Arquivos criados:**
- `backend/core/apps/persons/migrations/0008_backfill_person_document.py`

**Lógica:**
```python
def backfill_documents(apps, schema_editor):
    Person = apps.get_model("persons", "Person")
    PersonDocument = apps.get_model("persons", "PersonDocument")
    batch = []
    for p in Person.objects.exclude(document="").iterator(chunk_size=500):
        doc_type = "CPF" if len(p.document.replace(".", "").replace("-", "")) == 11 else "CNPJ"
        batch.append(PersonDocument(
            person=p, doc_type=doc_type, value=p.document,
            value_hash=sha256(p.document), is_primary=True
        ))
        if len(batch) >= 500:
            PersonDocument.objects.bulk_create(batch, ignore_conflicts=True)
            batch = []
    if batch:
        PersonDocument.objects.bulk_create(batch, ignore_conflicts=True)
```

**Critérios de aceite:**
- Toda `Person` com `document != ""` tem `PersonDocument` correspondente
- `is_reversible=False` documentado no migration (dados não se perdem no rollback pois `Person.document` persiste)

---

### T05 — Admin Django com PII mascarada
**Commit:** `feat(persons): admin com PII mascarada + permissão fiscal_admin`

**Arquivos modificados:**
- `backend/core/apps/persons/admin.py`

**Comportamento:**
```python
class PersonDocumentInline(admin.TabularInline):
    model = PersonDocument
    readonly_fields = ["masked_value", "doc_type", "is_primary"]
    fields = ["doc_type", "masked_value", "is_primary"]

    def masked_value(self, obj):
        v = obj.value or ""
        return f"{'*' * max(0, len(v) - 4)}{v[-4:]}" if len(v) > 4 else "****"
```

**Critérios de aceite:**
- `PersonDocument.value` nunca exibido em plain no admin
- Apenas usuários com flag `is_superuser` veem campo `value` diretamente (via `fiscal_admin` permission no futuro)

---

### T06 — DRF serializers com camada de permissão
**Commit:** `feat(persons): serializers LGPD — masked default + plaintext para fiscal_admin`

**Arquivos modificados:**
- `backend/core/apps/persons/serializers.py`

**Novos serializers:**
- `PersonDocumentMaskedSerializer` — exibe `value` mascarado (padrão)
- `PersonDocumentPlainSerializer` — exibe `value` em plain (requer `fiscal_admin`)
- `PersonDetailSerializer` — inclui `documents` (masked) e `contacts` (masked)

**Novo endpoint:**
- `GET /api/v1/persons/{id}/documents/` — retorna plain se `request.user.has_perm("persons.view_document_plain")`
- Permissão `persons.view_document_plain` definida via `Permission` Django

**Critérios de aceite:**
- Usuário sem `fiscal_admin` recebe CPF mascarado (`***.456.789-**`)
- Usuário com `fiscal_admin` recebe CPF completo
- 0 erros `mypy`

---

### T07 — ETL `etl_persons_databox.py`
**Commit:** `feat(persons): ETL Databox — importa 7.789 pessoas com PII criptografada`

**Arquivos criados:**
- `backend/core/scripts/etl_persons_databox.py`

**Interface:**
```bash
python etl_persons_databox.py \
  --input data/exports/databox_persons.csv \
  --tenant dscar \
  --batch 500 \
  --dry-run          # valida sem gravar
```

**Lógica:**
1. Parse CSV/JSON Databox
2. `get_or_create` Person por `legacy_code`
3. Cria `PersonDocument` (CPF/CNPJ) com `EncryptedCharField` + hash
4. Cria `PersonContact` (email, telefone) criptografados
5. Cria `PersonAddress` com `municipio_ibge="1302603"` quando cidade == "manaus" (case-insensitive)
6. Batch `bulk_create` de 500 registros por vez
7. Log: `N criados, M atualizados, K erros`

**Fixture de teste:** `data/fixtures/persons_databox_sample.json` (20 registros sintéticos)

**Critérios de aceite:**
- `--dry-run` não grava nada
- Duplicatas tratadas via `ignore_conflicts=True`
- Erros por linha logados sem abortar batch inteiro

---

### T08 — Testes unitários e de integração
**Commit:** `test(persons): cobertura ≥ 80% nos novos módulos`

**Arquivos criados:**
- `backend/core/apps/persons/tests/test_models_lgpd.py`
- `backend/core/apps/persons/tests/test_serializers_lgpd.py`
- `backend/core/apps/persons/tests/test_etl_persons.py`

**Testes obrigatórios (≥ 30):**
- Criptografia round-trip (create → read)
- Filtro por hash (não por valor)
- Mascaramento no serializer
- Acesso plaintext com/sem permissão `fiscal_admin`
- Migration 0008 backfill com fixtures
- ETL: `--dry-run`, duplicatas, batch com erro parcial

---

### T09 — Frontend `PersonForm.tsx` com máscaras
**Commit:** `feat(persons): PersonForm com CPF/CNPJ mask + municipio_ibge`

**Arquivos modificados:**
- `apps/dscar-web/src/components/persons/PersonForm.tsx` (se existir) ou novo em `src/features/persons/`

**Mudanças:**
- Máscara CPF: `000.000.000-00`
- Máscara CNPJ: `00.000.000/0000-00`
- Campo `municipio_ibge` (7 dígitos, opcional, com helper "Código IBGE da cidade")
- Exibir documentos da lista `person.documents[]` com tipo e valor mascarado

---

### T10 — Smoke test `scripts/smoke_ciclo_06a.py`
**Commit:** `test(persons): smoke ciclo 06A`

**Arquivo criado:** `scripts/smoke_ciclo_06a.py`

**Validações:**
```
[1] Cria Person (PF) com CPF criptografado
[2] Filtra PersonDocument por hash — encontra registro
[3] Cria PersonContact (email) criptografado — filtra por hash
[4] Cria PersonAddress com municipio_ibge="1302603"
[5] Serializer masked retorna CPF mascarado
[6] Serializer plain (fiscal_admin) retorna CPF completo
[7] ETL --dry-run com fixture sintética (20 registros) — 0 erros, 0 gravações
[8] ETL real com fixture sintética — 20 criados, 0 duplicatas
```

---

## 3. Dependências entre Tarefas

```
T01 (PersonDocument model)
  └─→ T04 (data migration backfill)
  └─→ T06 (serializers)
  └─→ T08 (testes)

T02 (municipio_ibge)
  └─→ T07 (ETL preenche campo)
  └─→ T09 (frontend)

T03 (PersonContact encrypt)
  └─→ T07 (ETL cria contacts criptografados)
  └─→ T08 (testes)

T05 (Admin)     — independente, pode ser feita após T01
T06 (Serializers) — depende T01 + T03
T07 (ETL)       — depende T01 + T02 + T03
T08 (Testes)    — depende T01 + T03 + T06 + T07
T09 (Frontend)  — depende T02, pode ser paralela ao backend
T10 (Smoke)     — depende T01 + T02 + T03 + T06 + T07
```

**Caminho crítico:** T01 → T04 → T06 → T08 → T10

**Pode ser paralelo:** T02 + T03 podem ser feitos em paralelo com T01 (modelos independentes)

---

## 4. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|--------------|---------|-----------|
| R1 | Migration T03 lenta em tabela grande (PersonContact) | Média | Médio | `atomic=False` + batch 200 em `RunPython`; executar em horário de baixo uso |
| R2 | `FIELD_ENCRYPTION_KEY` ausente em dev | Alta (nova variável) | Baixo | Reutilizar a chave já usada por `customers`/`hr` — verificar `settings.py` e `.env.example` |
| R3 | Formato do export Databox desconhecido | Alta | Médio | ETL com `--dry-run` + fixture sintética de 20 registros para testes |
| R4 | `Person.document` (plain) e `PersonDocument.value` (criptografado) duplicados | Alta | Médio | `Person.document` marcado como deprecated (comentário) — remoção planejada para 06B |
| R5 | Código IBGE incorreto para cidades fora de Manaus | Baixa | Alto | ETL preenche só quando `cidade.lower() == "manaus"`; demais ficam blank |
| R6 | `unique_together` em `PersonDocument` bloqueia bulk_create com duplicatas | Média | Baixo | `bulk_create(ignore_conflicts=True)` + log de skipped |

---

## 5. Critérios de Fechamento do Ciclo

- [ ] `make migrate` — 0 erros em todos os tenants
- [ ] `make test-backend` — todos os testes passam (incluindo pré-existentes)
- [ ] Cobertura ≥ 80% em `apps/persons/` (`pytest --cov=apps.persons`)
- [ ] `make typecheck` — 0 erros mypy em `apps/persons/`
- [ ] `make lint` — black + isort clean
- [ ] ETL `--dry-run` com fixture de 20 registros: 0 erros
- [ ] Smoke `scripts/smoke_ciclo_06a.py` — 8/8 verificações passando
- [ ] `Person.document` não aparece em plain em nenhuma resposta de API (verificado via teste)
- [ ] `.env.example` atualizado com `FIELD_ENCRYPTION_KEY` (se variável nova)
- [ ] PR com: §resumo, §testes, §riscos, §rollback (remoção `PersonDocument` via migration reversa)
- [ ] MVP_CHECKLIST.md atualizado com "Entregue no Ciclo 06A"

---

## 6. Notas Técnicas

### EncryptedCharField
Usar `from encrypted_model_fields.fields import EncryptedCharField` — já instalado.
Chave via `FIELD_ENCRYPTION_KEY` em settings. Verificar se já configurada (`customers/models.py` usa).

### hash helper
```python
import hashlib

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
```
Centralizar em `apps/persons/utils.py`.

### Filter pattern (padrão do projeto)
```python
# ERRADO — EncryptedCharField não suporta filter()
PersonDocument.objects.filter(value=cpf)

# CORRETO
PersonDocument.objects.filter(value_hash=sha256_hex(cpf))
```

### Databox export esperado
O ETL deve aceitar os dois formatos mais comuns do Databox (CSV e JSON).
Se o formato for diferente, criar issue + usar `--format csv|json|auto`.
