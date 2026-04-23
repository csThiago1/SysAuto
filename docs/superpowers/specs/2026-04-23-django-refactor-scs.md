# Spec: Refatoração Django — Boas Práticas (referência SCS)

> Originado da análise comparativa entre `ARCHITECTURE.md` (projeto SCS — corretora de seguros,
> Django 4.2 + templates) e o backend `grupo-dscar` (Django 5 + DRF + multitenancy).
>
> **Objetivo:** elevar a consistência e profissionalismo do código Django sem alterar comportamento.
> Nenhum endpoint muda de contrato. Todas as correções são backwards-compatible exceto onde indicado.

---

## Contexto

O documento SCS traz boas práticas de Django que, quando comparadas ao nosso código, revelam
inconsistências acumuladas ao longo de sprints rápidas. Nossa stack (DRF, multitenancy, JWT,
EncryptedField) é mais avançada que a do SCS, mas alguns padrões fundamentais ficaram para trás.

Os problemas estão divididos em dois grupos: **Models** (exigem migrations) e
**Views/Utils** (sem migrations, zero risco de breaking change).

---

## Grupo A — Models (requerem migrations)

### A1 — `Person.inscription_type` e `Person.gender` usam tuplas brutas em vez de `TextChoices`

**Arquivo:** `backend/core/apps/persons/models.py:102-120`

**Problema:**

```python
# ATUAL — violação do padrão TextChoices
inscription_type = models.CharField(
    choices=[
        ("CONTRIBUINTE", "Contribuinte"),
        ("NAO_CONTRIBUINTE", "Não Contribuinte"),
        ("ISENTO", "Isento"),
    ],
)
gender = models.CharField(
    choices=[("M", "Masculino"), ("F", "Feminino"), ("N", "Não informado")],
)
```

Tuplas brutas não são referenciáveis por código, não têm type safety, e violam o padrão
estabelecido em todo o restante do projeto.

**Solução:**

```python
class InscriptionType(models.TextChoices):
    CONTRIBUINTE     = "CONTRIBUINTE",     "Contribuinte"
    NAO_CONTRIBUINTE = "NAO_CONTRIBUINTE", "Não Contribuinte"
    ISENTO           = "ISENTO",           "Isento"

class Gender(models.TextChoices):
    MALE    = "M", "Masculino"
    FEMALE  = "F", "Feminino"
    OTHER   = "N", "Não informado"
```

Aplicar nos campos com `choices=InscriptionType.choices` e `choices=Gender.choices`.
**Migration necessária:** não (os valores armazenados não mudam, apenas os metadados do field).
Na prática o Django gera uma migration `AlterField` que é no-op para o banco — pode ser squashada.

---

### A2 — `Insurer`, `Person` e `KnowledgeChunk` não estendem `PaddockBaseModel`

**Arquivos:**
- `backend/core/apps/insurers/models.py:13`
- `backend/core/apps/persons/models.py:73`
- `backend/core/apps/ai/models.py:32`

**Problema:**

Todos definem manualmente campos que `PaddockBaseModel` já provê, gerando duplicação e
inconsistências:

| Recurso | PaddockBaseModel | Insurer | Person | KnowledgeChunk |
|---|:---:|:---:|:---:|:---:|
| UUID PK | ✅ | ✅ (manual) | ❌ (BigInt) | ✅ (manual) |
| `created_at` db_index | ✅ | ❌ (sem index) | ✅ | ❌ |
| `updated_at` | ✅ | ✅ | ✅ | ❌ |
| `created_by` FK | ✅ | ❌ | ❌ | ❌ |
| `is_active` db_index | ✅ | ❌ (sem index) | ✅ | ❌ |
| `soft_delete()` | ✅ | ❌ | ❌ | ❌ |
| ordering padrão `-created_at` | ✅ | ❌ (`name`) | ✅ | ❌ |

**Solução por model:**

**`Insurer`** — migrar para `PaddockBaseModel`. `Insurer` fica no schema público e
`PaddockBaseModel.created_by` aponta para `GlobalUser` (também público) — sem conflito.
Remover os campos manuais `id`, `created_at`, `updated_at`, `is_active`. Ajustar `Meta`.
**Migration:** `AlterField` (UUID PK não muda) + `AddField created_by` (nullable) +
`AddIndex created_at`.

**`Person`** — caso mais delicado: atualmente usa `BigAutoField` como PK.
Migrar para UUID PK é uma migration destrutiva (afeta todas as FKs de `PersonRole`,
`PersonContact`, `PersonAddress`, `ServiceOrder.customer`, `Employee.person`, etc.).
**Recomendação:** migrar apenas `created_by` + `soft_delete()` sem alterar PK por enquanto.
Criar issue separada para migração de PK no futuro.

**`KnowledgeChunk`** — model interno da IA, sem FKs externas. Migrar para
`PaddockBaseModel` completamente. UUID PK já é usado, então migração é só `AlterField` +
adição de campos.

---

### A3 — Nenhum validator de domínio em campos de texto críticos

**Arquivo:** `backend/core/apps/` — vários models

**Problema:**

O SCS centraliza validators em `utils/validators.py` e os aplica nos fields dos models.
Nós não temos nenhum arquivo de validators e campos críticos aceitam qualquer string:

| Campo | Model | Validator ausente |
|---|---|---|
| `plate` | `ServiceOrder` | Formato de placa BR (ABC-1234 / ABC1D23) |
| `cnpj` | `Insurer` | Formato e dígito verificador CNPJ |
| `document` | `Person` | Formato CPF (11 dígitos) ou CNPJ (14 dígitos) |
| `cpf` | `Employee` / `UnifiedCustomer` | Formato CPF antes de criptografar |
| `nfe_key` | `ServiceOrder` | 44 dígitos exatos |
| `brand_color` | `Insurer` | Hex `#RRGGBB` |

**Solução:**

Criar `backend/core/apps/utils/` com:

```
backend/core/apps/utils/
├── __init__.py
├── validators.py      ← validate_cpf, validate_cnpj, validate_cpf_cnpj,
│                        validate_plate, validate_hex_color, validate_nfe_key
└── formatters.py      ← normalize_cpf, normalize_plate (remove máscara)
```

Exemplo de aplicação:

```python
# validators.py
import re
from django.core.exceptions import ValidationError

def validate_plate(value: str) -> None:
    """Aceita formato Mercosul (ABC1D23) e padrão antigo (ABC-1234)."""
    clean = value.replace("-", "").upper()
    if not re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", clean):
        raise ValidationError(f"Placa inválida: {value!r}. Formatos aceitos: ABC1234 ou ABC1D23.")

def validate_hex_color(value: str) -> None:
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        raise ValidationError(f"Cor hex inválida: {value!r}. Use o formato #RRGGBB.")

def validate_nfe_key(value: str) -> None:
    if value and not re.fullmatch(r"\d{44}", value):
        raise ValidationError("Chave NF-e deve ter exatamente 44 dígitos numéricos.")
```

Aplicar nos fields:

```python
# service_orders/models.py
from apps.utils.validators import validate_plate, validate_nfe_key

plate = models.CharField(max_length=10, db_index=True, validators=[validate_plate])
nfe_key = models.CharField(max_length=44, blank=True, default="", validators=[validate_nfe_key])

# insurers/models.py
from apps.utils.validators import validate_hex_color

brand_color = models.CharField(max_length=7, default="#000000", validators=[validate_hex_color])
```

> **Nota LGPD:** `Employee.cpf` e `UnifiedCustomer.cpf` são `EncryptedCharField`.
> O validator deve ser aplicado via `clean()` do serializer (antes de criptografar),
> não no field do model, pois validators de model não recebem o valor decriptado.

---

## Grupo B — Views / Utils (sem migrations)

### B1 — Lógica de negócio no `EmployeeViewSet.terminate()` em vez do service layer

**Arquivo:** `backend/core/apps/hr/views.py:126-140`

**Problema:**

O próprio arquivo documenta: *"Regras de negócio ficam em services.py — nunca aqui."*
Mas `terminate()` viola essa regra:

```python
# ATUAL — lógica de negócio na view
def terminate(self, request, pk=None):
    employee.status = Employee.Status.TERMINATED
    employee.termination_date = date.today()
    employee.save(update_fields=["status", "termination_date", "updated_at"])
```

**Solução:**

```python
# hr/services.py
class EmployeeService:
    @classmethod
    @transaction.atomic
    def terminate(cls, employee_id: str, terminated_by_id: str) -> "Employee":
        """Desliga colaborador — registra data e altera status."""
        employee = Employee.objects.select_for_update().get(pk=employee_id, is_active=True)
        if employee.status == Employee.Status.TERMINATED:
            raise ValidationError("Colaborador já está desligado.")
        employee.status = Employee.Status.TERMINATED
        employee.termination_date = date.today()
        employee.save(update_fields=["status", "termination_date", "updated_at"])
        logger.info("Employee %s terminated by %s", employee_id, terminated_by_id)
        return employee

# hr/views.py — ação vira thin wrapper
@action(detail=True, methods=["post"], url_path="terminate")
def terminate(self, request, pk=None):
    employee = EmployeeService.terminate(
        employee_id=str(pk),
        terminated_by_id=str(request.user.id),
    )
    return Response(EmployeeDetailSerializer(employee, context={"request": request}).data)
```

---

### B2 — `_generate_presigned_url()` em `hr/views.py` em vez de `hr/services.py`

**Arquivo:** `backend/core/apps/hr/views.py:12-22`

**Problema:**

Função utilitária de infraestrutura (acesso ao S3) definida no topo do arquivo de views,
antes dos imports do DRF. Além de violar a separação de responsabilidades, o `import boto3`
é lazy dentro da função — padrão inconsistente com o restante do projeto.

**Solução:** mover para `hr/services.py` ou para um módulo `utils/storage.py` compartilhado
(se outros apps também gerarem URLs presignadas).

---

### B3 — Imports lazy dentro de action methods

**Arquivo:** `backend/core/apps/service_orders/views.py:241-243`

**Problema:**

```python
# ATUAL — imports no meio do código (dentro de action)
def transition(self, request, pk=None):
    ...
    from apps.authentication.models import GlobalUser
    from django_tenants.utils import get_tenant
    from .tasks import task_notify_status_change
```

Imports lazy dentro de métodos são um code smell. O motivo histórico para esse padrão
(evitar circular imports) deve ser resolvido na raiz, não com lazy imports em runtime.

**Solução:** mover os imports para o topo do arquivo. Se houver circular import,
resolver com string reference no model (`"authentication.GlobalUser"`) ou reestruturar
a dependência.

---

### B4 — `BonusViewSet.get_queryset()` sem `select_related`

**Arquivo:** `backend/core/apps/hr/views.py:237-241`

**Problema:**

```python
# ATUAL — N+1 queries ao serializar employee.user.name
def get_queryset(self):
    return Bonus.objects.filter(employee_id=self.kwargs["employee_pk"], is_active=True)
```

O serializer de `Bonus` quase certamente acessa `employee.user` para exibir nome — sem
`select_related`, isso gera uma query extra por registro.

**Solução:**

```python
def get_queryset(self):
    return (
        Bonus.objects
        .filter(employee_id=self.kwargs["employee_pk"], is_active=True)
        .select_related("employee__user")
        .order_by("-reference_month")
    )
```

Verificar os demais ViewSets nested do HR (`DeductionViewSet`, `AllowanceViewSet`,
`TimeClockViewSet`) com o mesmo critério.

---

### B5 — `@extend_schema` ausente nos ViewSets do app HR

**Arquivo:** `backend/core/apps/hr/views.py` — todos os ViewSets

**Problema:**

`ServiceOrderViewSet` e `UnifiedCustomerViewSet` têm `@extend_schema_view` com summaries
e parâmetros documentados. Os ViewSets do HR (`EmployeeViewSet`, `BonusViewSet`,
`GoalTargetViewSet`, etc.) não têm nenhuma anotação, gerando docs Swagger genéricas e
pouco úteis.

**Solução:** adicionar `@extend_schema_view` mínimo com `summary` em cada ViewSet,
e `@extend_schema(summary=...)` nas actions customizadas (`terminate`, `me`, `achieve`, etc.).

---

## Resumo e prioridades

| # | Problema | Grupo | Migration | Risco | Prioridade |
|---|---|---|:---:|:---:|:---:|
| A1 | TextChoices em `Person` | Models | AlterField (no-op) | Baixo | Alta |
| A2 | `Insurer`/`KnowledgeChunk` → PaddockBaseModel | Models | AddField | Médio | Média |
| A2b | `Person` → PaddockBaseModel (sem mudar PK) | Models | AddField | Baixo | Média |
| A3 | Criar `utils/validators.py` + aplicar nos fields | Models | AlterField | Baixo | Alta |
| B1 | `terminate()` → `EmployeeService` | Views | — | Baixo | Alta |
| B2 | `_generate_presigned_url()` → `services.py` | Views | — | Baixo | Média |
| B3 | Imports lazy → topo do arquivo | Views | — | Baixo | Alta |
| B4 | `select_related` no `BonusViewSet` + similares | Views | — | Zero | Alta |
| B5 | `@extend_schema` nos ViewSets de HR | Views | — | Zero | Baixa |

---

## O que NÃO mudar

Os seguintes padrões do SCS **não se aplicam** à nossa stack e não devem ser adotados:

- **CBVs com Django Templates** — somos DRF, ViewSets são o padrão correto
- **`pre_save` signal para numeração automática** — nossa abordagem com `select_for_update`
  no service layer é superior para evitar race conditions
- **`utils/mixins.py` com `BrokerFilterMixin`** — usamos `get_permissions()` no ViewSet,
  mais granular e testável
- **`slug` auto-generation no `save()`** — não usamos slugs (usamos UUIDs)
- **SQLite em dev** — usamos PostgreSQL em todos os ambientes (multitenancy exige)

---

## Arquivos que serão modificados

**Grupo A (models + migrations):**
```
backend/core/apps/utils/__init__.py          ← novo
backend/core/apps/utils/validators.py        ← novo
backend/core/apps/persons/models.py          ← TextChoices + created_by
backend/core/apps/insurers/models.py         ← herdar PaddockBaseModel
backend/core/apps/ai/models.py               ← KnowledgeChunk herdar PaddockBaseModel
backend/core/apps/service_orders/models.py   ← validate_plate, validate_nfe_key
backend/core/apps/persons/migrations/        ← 0003_textchoices_created_by
backend/core/apps/insurers/migrations/       ← nova migration
backend/core/apps/ai/migrations/             ← nova migration
```

**Grupo B (views + services):**
```
backend/core/apps/hr/views.py                ← remover lógica de negócio, lazy imports
backend/core/apps/hr/services.py             ← EmployeeService.terminate()
backend/core/apps/service_orders/views.py    ← mover lazy imports para o topo
```
