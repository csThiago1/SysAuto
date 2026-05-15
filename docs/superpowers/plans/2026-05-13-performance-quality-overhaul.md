# Performance & Quality Overhaul — Plano de Sprints

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar 93 issues de seguranca, performance, qualidade e infraestrutura identificados na auditoria completa do monorepo Paddock Solutions.

**Architecture:** Execucao em 7 sprints sequenciais com agentes especializados (PM, Backend, Frontend, Mobile, Performance, QA, Code Reviewer, DevOps). Cada sprint tem criterios de validacao cruzada entre agentes. O QA valida TUDO antes de marcar como concluido.

**Tech Stack:** Django 5 + DRF, Next.js 15, React Native + Expo 52, Redis 7, PostgreSQL 16, Celery 5

---

## Equipe de Agentes

| Agente | Tipo (`subagent_type`) | Responsabilidade |
|--------|----------------------|------------------|
| **PM** | `project-manager` | Coordena sprints, valida escopo, garante que nenhuma task fique para tras |
| **Backend** | `django-developer` | Django/DRF: cache, queries, serializers, views, models |
| **Frontend** | `nextjs-developer` | Next.js: QueryClient, proxy, lazy loading, React Query, memoization |
| **Mobile** | `expo-react-native-expert` | React Native/Expo: FlatList, expo-image, memoization, stores |
| **Performance** | `performance-engineer` | Redis cache strategy, DB indexes, query profiling, benchmarks |
| **QA** | `test-automator` | Testes automatizados, validacao de cada fix, regressao |
| **Code Reviewer** | `code-reviewer` | Review de TODOS os PRs, code quality, security audit |
| **DevOps** | `devops-engineer` | GZip, rate limiting, health checks, Sentry, logging |

### Protocolo de Validacao

```
1. Agente implementa a task
2. QA roda testes relevantes + valida manualmente
3. Code Reviewer faz review do diff
4. PM valida que a task cumpre o objetivo
5. So entao marca checkbox como [x]
```

---

## Sprint 1: Seguranca & Bugs Criticos (Fase 0)

**Agentes:** Backend, Frontend, Mobile, Code Reviewer, QA
**Objetivo:** Eliminar todas as vulnerabilidades criticas antes de qualquer outra mudanca.
**Branch:** `fix/security-critical`

---

### Task 1.1: Corrigir `str(e)` vazando em API responses (CRITICAL)

**Agente:** Backend
**Validador:** Code Reviewer + QA

**Files:**
- Modify: `backend/core/apps/cilia/views.py:47`
- Modify: `backend/core/apps/service_orders/views/orders.py:1237`
- Modify: `backend/core/apps/documents/views.py:74`
- Modify: `backend/core/apps/inventory/views_movement.py:164`
- Modify: `backend/core/apps/inventory/views_counting.py:116,141`
- Modify: `backend/core/apps/pricing_engine/views.py:208`
- Modify: `backend/core/apps/quotes/views.py:198`

- [ ] **Step 1: Fix cilia/views.py:47 — broad Exception catch (CRITICAL)**

```python
# ANTES:
except Exception as e:
    return Response({"erro": str(e)}, status=500)

# DEPOIS:
except Exception as e:
    logger.exception("Erro na integracao Cilia: %s", e)
    return Response({"detail": "Erro interno na integracao."}, status=500)
```

- [ ] **Step 2: Fix service_orders/views/orders.py:1237 — broad Exception catch (CRITICAL)**

```python
# ANTES:
except Exception as exc:
    logger.exception("Cilia parse error")
    return Response(
        {"error": f"Erro ao processar orcamento: {exc}", "error_type": "ParseError"},
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )

# DEPOIS:
except Exception as exc:
    logger.exception("Cilia parse error: %s", exc)
    return Response(
        {"detail": "Erro ao processar orcamento.", "error_type": "ParseError"},
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )
```

- [ ] **Step 3: Fix documents/views.py:74 — ValueError**

```python
# ANTES:
except ValueError as exc:
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

# DEPOIS:
except ValueError as exc:
    logger.warning("Documento invalido: %s", exc)
    return Response({"detail": "Dados invalidos para geracao do documento."}, status=status.HTTP_400_BAD_REQUEST)
```

- [ ] **Step 4: Fix inventory/views_movement.py:164 e views_counting.py:116,141**

Substituir `{"erro": str(e)}` por `{"detail": "Erro na operacao de estoque."}` + `logger.exception(...)`.

- [ ] **Step 5: Fix pricing_engine/views.py:208 e quotes/views.py:198 — ValueError**

Substituir `str(exc)` por mensagem generica + log.

- [ ] **Step 6: Padronizar chave de erro para "detail" em TODOS os arquivos**

Buscar e substituir `"erro":` por `"detail":` nos seguintes arquivos:
- `purchasing/views.py`
- `quotes/views.py`
- `inventory/views_movement.py`
- `inventory/views_counting.py`
- `cilia/views.py`

Run: `cd backend/core && grep -rn '"erro"' apps/ --include="*.py" | grep -i response`

- [ ] **Step 7: QA valida que nenhum `str(e)` / `str(exc)` aparece em Response para broad Exception**

Run: `cd backend/core && grep -rn 'except Exception' apps/ -A3 --include="*.py" | grep -E 'str\(e\)|str\(exc\)|f".*\{e\}|f".*\{exc\}'`
Expected: ZERO matches.

- [ ] **Step 8: Commit**

```bash
git add backend/core/apps/
git commit -m "fix(security): remove str(e) leakage from API responses — use generic messages + logger"
```

---

### Task 1.2: Fix QueryClient singleton SSR (CRITICAL)

**Agente:** Frontend
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/dscar-web/src/lib/query-client.ts:3-19`

- [ ] **Step 1: Reescrever query-client.ts para isolar server vs client**

```typescript
// apps/dscar-web/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query"

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
      },
    },
  })
}

let browserClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: instancia nova por request (isolamento SSR)
    return makeQueryClient()
  }
  // Browser: singleton estavel
  if (!browserClient) browserClient = makeQueryClient()
  return browserClient
}
```

- [ ] **Step 2: QA valida que a app carrega normalmente**

Run: `cd apps/dscar-web && npx next build`
Expected: Build sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/lib/query-client.ts
git commit -m "fix(web): isolate QueryClient per SSR request — prevent cross-user cache contamination"
```

---

### Task 1.3: Adicionar timeout ao proxy route (CRITICAL)

**Agente:** Frontend
**Validador:** QA

**Files:**
- Modify: `apps/dscar-web/src/app/api/proxy/[...path]/route.ts:45`

- [ ] **Step 1: Adicionar AbortController com timeout de 30s**

Na funcao que faz o `fetch` ao backend (linha 45), envolver com timeout:

```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30_000)

try {
  const response = await fetch(backendUrl, {
    method,
    headers,
    body,
    signal: controller.signal,
  })
  // ... resto do handler existente
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    return NextResponse.json(
      { detail: "Backend timeout" },
      { status: 504 }
    )
  }
  throw err
} finally {
  clearTimeout(timeoutId)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/api/proxy/
git commit -m "fix(proxy): add 30s timeout with AbortController — prevent infinite hangs"
```

---

### Task 1.4: Unificar query keys duplicados de OS parts/labor (CRITICAL)

**Agente:** Frontend
**Validador:** Code Reviewer + QA

**Files:**
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts:67-236` (remover duplicatas)
- Modify: importadores dos hooks removidos

- [ ] **Step 1: Identificar todos os imports dos hooks duplicados**

Run: `cd apps/dscar-web && grep -rn "useOSParts\|useOSLabor\|useAddPart\|useUpdatePart\|useDeletePart\|useAddLabor\|useUpdateLabor\|useDeleteLabor" src/ --include="*.ts" --include="*.tsx" | grep "from.*useServiceOrders"`

- [ ] **Step 2: Remover funcoes duplicadas de useServiceOrders.ts**

Remover `useOSParts` (linhas 67-75), `useOSLabor` (linhas ~184+), e todas as mutation hooks que duplicam `useOSItems.ts`. Manter apenas `useServiceOrders` e `useServiceOrder` (hooks de listagem/detalhe).

- [ ] **Step 3: Atualizar imports nos arquivos que usavam os hooks de useServiceOrders.ts**

Redirecionar para `@/app/(app)/os/[numero]/_hooks/useOSItems`.

- [ ] **Step 4: QA valida que nao ha imports quebrados**

Run: `cd apps/dscar-web && npx tsc --noEmit`
Expected: ZERO erros.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/
git commit -m "fix(web): unify OS parts/labor query keys — remove duplicate hooks from useServiceOrders"
```

---

### Task 1.5: Adicionar timeout ao mobile apiFetch (HIGH)

**Agente:** Mobile
**Validador:** QA

**Files:**
- Modify: `apps/mobile/src/lib/api.ts:36`

- [ ] **Step 1: Adicionar AbortController com timeout de 15s**

```typescript
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15_000
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    // ... resto do handler existente
  } finally {
    clearTimeout(timeoutId)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/api.ts
git commit -m "fix(mobile): add 15s timeout to apiFetch — prevent indefinite hangs on bad network"
```

---

### Task 1.6: Fix purchasing ViewSet permission pattern (MEDIUM)

**Agente:** Backend
**Validador:** Code Reviewer

**Files:**
- Modify: `backend/core/apps/purchasing/views.py:56,80,159,188,215`

- [ ] **Step 1: Substituir `self.permission_classes =` por `@action(permission_classes=...)`**

Em cada action que faz `self.permission_classes = [...]` seguido de `self.check_permissions(request)`, mover o `permission_classes` para o decorator `@action`:

```python
# ANTES (linha 56):
@action(detail=True, methods=["post"], url_path="iniciar-cotacao")
def iniciar_cotacao(self, request, pk=None):
    self.permission_classes = [IsAuthenticated, IsStorekeeperOrAbove]
    self.check_permissions(request)

# DEPOIS:
@action(
    detail=True,
    methods=["post"],
    url_path="iniciar-cotacao",
    permission_classes=[IsAuthenticated, IsStorekeeperOrAbove],
)
def iniciar_cotacao(self, request, pk=None):
```

Repetir para: `enviar` (linha 159), `aprovar` (linha 188), `rejeitar` (linha 215), e a outra ocorrencia na linha 80.

- [ ] **Step 2: Remover linhas `self.check_permissions(request)` redundantes**

O DRF chama `check_permissions` automaticamente quando `permission_classes` esta no decorator.

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/purchasing/views.py
git commit -m "fix(purchasing): move permission_classes to @action decorator — prevent race condition"
```

---

### Validacao Sprint 1

- [ ] **Code Reviewer:** Review de TODOS os diffs do sprint
- [ ] **QA:** `cd backend/core && python manage.py test` (todos os testes passam)
- [ ] **QA:** `cd apps/dscar-web && npx tsc --noEmit && npx next build` (build OK)
- [ ] **QA:** Grep final confirma zero `str(e)` em broad Exception + zero `"erro":` em responses
- [ ] **PM:** Todos os 6 tasks marcados como concluidos

---

## Sprint 2: Backend Performance — Cache Redis

**Agentes:** Performance, Backend, QA
**Objetivo:** Implementar cache Redis nos 9 endpoints de dados estaveis + otimizar dashboard.
**Branch:** `perf/redis-cache`

---

### Task 2.1: Cache Redis para ServiceCatalog

**Agente:** Performance
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/service_orders/views/catalog.py:37-46`

- [ ] **Step 1: Adicionar cache ao get_queryset**

```python
from django.core.cache import cache

def get_queryset(self) -> QuerySet:
    search = self.request.query_params.get("search", "")
    category = self.request.query_params.get("category", "")

    # Sem filtros = request de combobox (mais comum) → cachear
    if not search and not category:
        cached = cache.get("service_catalog:active")
        if cached is not None:
            return cached
        qs = ServiceCatalog.objects.filter(is_active=True)
        result = list(qs)
        cache.set("service_catalog:active", result, timeout=300)
        return result

    qs = ServiceCatalog.objects.filter(is_active=True)
    if search:
        qs = qs.filter(name__icontains=search)
    if category:
        qs = qs.filter(category=category)
    return qs
```

- [ ] **Step 2: Invalidar cache no save/delete**

```python
# No mesmo arquivo ou em signals.py:
def perform_create(self, serializer):
    serializer.save()
    cache.delete("service_catalog:active")

def perform_update(self, serializer):
    serializer.save()
    cache.delete("service_catalog:active")

def perform_destroy(self, instance):
    instance.is_active = False
    instance.save(update_fields=["is_active"])
    cache.delete("service_catalog:active")
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/views/catalog.py
git commit -m "perf(catalog): cache service catalog list in Redis (TTL 5min)"
```

---

### Task 2.2: Cache Redis para Vehicle Catalog (FIPE)

**Agente:** Performance
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/vehicle_catalog/views.py:35-36` (VehicleColorViewSet)
- Modify: `backend/core/apps/vehicle_catalog/views.py:388+` (VehicleMakeViewSet)

- [ ] **Step 1: Cache VehicleColor (TTL 1 hora)**

```python
from django.core.cache import cache

class VehicleColorViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleColorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def list(self, request, *args, **kwargs):
        search = request.query_params.get("search", "")
        if not search:
            cached = cache.get("vehicle_colors:all")
            if cached is not None:
                return Response(cached)
            response = super().list(request, *args, **kwargs)
            cache.set("vehicle_colors:all", response.data, timeout=3600)
            return response
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        return VehicleColor.objects.all()
```

- [ ] **Step 2: Cache VehicleMake models action (TTL 1 hora)**

No `VehicleMakeViewSet.models()` action, adicionar cache com key `f"vehicle_models:make:{pk}"`.

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/vehicle_catalog/views.py
git commit -m "perf(vehicle-catalog): cache FIPE colors and models in Redis (TTL 1h)"
```

---

### Task 2.3: Cache Redis para Insurers

**Agente:** Performance
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/insurers/views.py:70-73`

- [ ] **Step 1: Cache insurer list (TTL 5 min)**

```python
from django.core.cache import cache

def get_queryset(self):
    if self.action == "list":
        cached = cache.get("insurers:active")
        if cached is not None:
            return cached
        qs = list(Insurer.objects.filter(is_active=True))
        cache.set("insurers:active", qs, timeout=300)
        return qs
    return Insurer.objects.all()
```

- [ ] **Step 2: Invalidar no create/update/destroy/upload_logo**

Adicionar `cache.delete("insurers:active")` em `perform_create`, `perform_update`, `perform_destroy`, e no final da action `upload_logo`.

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/insurers/views.py
git commit -m "perf(insurers): cache insurer list in Redis (TTL 5min) with invalidation"
```

---

### Task 2.4: Cache Redis para Dashboard Manager

**Agente:** Performance
**Validador:** QA + Code Reviewer

**Files:**
- Modify: `backend/core/apps/service_orders/views/dashboard.py:181-340`

- [ ] **Step 1: Wrapping _manager_stats com cache (TTL 2 min)**

```python
from django.core.cache import cache

def _manager_stats(self) -> dict:
    cached = cache.get("dashboard:manager")
    if cached is not None:
        return cached

    # ... todo o codigo existente ...

    result = {
        "role": "manager",
        "total_open": total_open,
        # ... resto ...
    }

    cache.set("dashboard:manager", result, timeout=120)
    return result
```

- [ ] **Step 2: Otimizar billing loop — 6 queries para 1 com TruncMonth**

```python
from django.db.models.functions import TruncMonth

# Substituir o loop nas linhas 223-237 por:
billing_raw = (
    ReceivableDocument.objects
    .filter(competence_date__gte=month_start - timedelta(days=180))
    .annotate(month=TruncMonth("competence_date"))
    .values("month")
    .annotate(total=Sum("amount"))
    .order_by("month")
)
billing_last_6 = [
    {"month": row["month"].strftime("%b/%y"), "amount": str(row["total"] or 0)}
    for row in billing_raw
][-6:]
```

- [ ] **Step 3: Cache consultant stats per user (TTL 1 min)**

```python
def _consultant_stats(self, request) -> dict:
    cache_key = f"dashboard:consultant:{request.user.pk}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    # ... codigo existente ...
    cache.set(cache_key, result, timeout=60)
    return result
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/views/dashboard.py
git commit -m "perf(dashboard): cache stats in Redis + optimize billing to single TruncMonth query"
```

---

### Task 2.5: Cache para CEP lookup e employee_options

**Agente:** Backend
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/persons/views.py:107-129` (cep_lookup)
- Modify: `backend/core/apps/persons/views.py:131-143` (employee_options)

- [ ] **Step 1: Cache CEP (TTL 24h) + migrar para httpx**

```python
from django.core.cache import cache
import httpx

@action(detail=False, methods=["get"], url_path=r"cep/(?P<cep>\d{8})")
def cep_lookup(self, request, cep=""):
    cache_key = f"cep:{cep}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"https://viacep.com.br/ws/{cep}/json/")
        data = resp.json()
        if data.get("erro"):
            return Response({"detail": "CEP nao encontrado."}, status=404)
        result = {
            "cep": data.get("cep", ""),
            "logradouro": data.get("logradouro", ""),
            "complemento": data.get("complemento", ""),
            "bairro": data.get("bairro", ""),
            "localidade": data.get("localidade", ""),
            "uf": data.get("uf", ""),
        }
        cache.set(cache_key, result, timeout=86400)
        return Response(result)
    except httpx.TimeoutException:
        return Response({"detail": "Timeout na consulta de CEP."}, status=504)
```

- [ ] **Step 2: Cache employee_options (TTL 10 min)**

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/persons/views.py
git commit -m "perf(persons): cache CEP lookup (24h) + employee options (10min) in Redis"
```

---

### Task 2.6: Cache DashboardCompras — 4 queries para 2

**Agente:** Backend
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/purchasing/views.py:333+` (DashboardComprasView)

- [ ] **Step 1: Colapsar 4 COUNT queries em 2 + cache (TTL 1 min)**

```python
from django.core.cache import cache
from django.db.models import Count, Q

def get(self, request: Request) -> Response:
    cached = cache.get("dashboard:compras")
    if cached:
        return Response(cached)

    pedido_counts = PedidoCompra.objects.filter(is_active=True).aggregate(
        solicitados=Count("id", filter=Q(status="solicitado")),
        em_cotacao=Count("id", filter=Q(status="em_cotacao")),
    )
    oc_counts = OrdemCompra.objects.filter(is_active=True).aggregate(
        aguardando_aprovacao=Count("id", filter=Q(status="pendente_aprovacao")),
        aprovadas_hoje=Count("id", filter=Q(
            status="aprovada",
            aprovado_em__date=timezone.now().date()
        )),
    )
    data = {**pedido_counts, **oc_counts}
    cache.set("dashboard:compras", data, timeout=60)
    return Response(DashboardComprasSerializer(data).data)
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/purchasing/views.py
git commit -m "perf(purchasing): collapse 4 dashboard queries to 2 + cache 1min"
```

---

### Validacao Sprint 2

- [ ] **QA:** Testar cada endpoint cacheado — 1a request popula cache, 2a sai do Redis
- [ ] **QA:** Verificar invalidacao — editar insurer, confirmar que cache limpa
- [ ] **Performance:** Medir tempo de resposta antes/depois (dashboard deve cair de ~200ms para ~5ms no cache hit)
- [ ] **Code Reviewer:** Review de todos os cache keys — nao pode ter colisao
- [ ] **PM:** Todos os 6 tasks concluidos

---

## Sprint 3: Backend Performance — N+1 & Queries

**Agentes:** Backend, Performance, QA
**Objetivo:** Eliminar N+1 queries e otimizar querysets pesados.
**Branch:** `perf/query-optimization`

---

### Task 3.1: Remover has_transition_blocks do ListSerializer (CRITICAL N+1)

**Agente:** Backend
**Validador:** QA + Performance

**Files:**
- Modify: `backend/core/apps/service_orders/serializers/core.py:514-523`

- [ ] **Step 1: Remover `get_has_transition_blocks` do `ServiceOrderListSerializer`**

Remover o metodo `get_has_transition_blocks` (linhas 514-523) e remover `has_transition_blocks` do `fields` na Meta class. O frontend ja tem `allowed_transitions` para saber se pode transicionar — a validacao detalhada acontece no detalhe.

- [ ] **Step 2: QA valida que o Kanban carrega sem erros**

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/serializers/core.py
git commit -m "perf(os): remove has_transition_blocks from list serializer — eliminates N+1 TransitionValidator calls"
```

---

### Task 3.2: Cache transition_requirements no DetailSerializer

**Agente:** Backend
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/service_orders/serializers/core.py:620-624`

- [ ] **Step 1: Cache com key baseada em updated_at**

```python
def get_transition_requirements(self, obj: ServiceOrder) -> dict[str, dict]:
    from django.core.cache import cache
    cache_key = f"transition_reqs:{obj.pk}:{obj.updated_at.timestamp()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    from apps.service_orders.transition_validator import TransitionValidator
    result = TransitionValidator.validate_all_targets(obj)
    cache.set(cache_key, result, timeout=60)
    return result
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/service_orders/serializers/core.py
git commit -m "perf(os): cache transition_requirements per OS (TTL 1min, keyed by updated_at)"
```

---

### Task 3.3: Condicionar prefetches por action no ServiceOrderViewSet

**Agente:** Backend
**Validador:** Performance + QA

**Files:**
- Modify: `backend/core/apps/service_orders/views/orders.py:168-188`

- [ ] **Step 1: Prefetch apenas no detail/update, nao no list**

```python
def get_queryset(self) -> QuerySet[ServiceOrder]:
    qs = (
        ServiceOrder.objects.filter(is_active=True)
        .select_related("consultant", "insurer", "expert", "customer", "created_by")
        .order_by("-opened_at")
    )
    # Relacoes pesadas somente para detail/update
    if self.action in ("retrieve", "update", "partial_update", "transition",
                       "deliver", "billing", "financial_summary"):
        qs = qs.prefetch_related(
            Prefetch(
                "transition_logs",
                queryset=ServiceOrderTransitionLog.objects.select_related("changed_by").order_by("-created_at"),
            ),
            "photos",
            "parts",
            "labor_items",
            "budget_snapshots",
            Prefetch(
                "activities",
                queryset=ServiceOrderActivityLog.objects.select_related("user").order_by("-created_at")[:50],
            ),
        )
    # ... resto dos filtros existentes ...
    return qs
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/service_orders/views/orders.py
git commit -m "perf(os): conditionalize prefetch_related by action — skip heavy joins on list"
```

---

### Task 3.4: Fix N+1 em ActivityLog, FiscalDocument, PersonViewSet

**Agente:** Backend
**Validador:** QA

**Files:**
- Modify: `backend/core/apps/service_orders/views/orders.py:450-485` (activity history)
- Modify: `backend/core/apps/fiscal/views.py:651-666` (FiscalDocumentViewSet)
- Modify: `backend/core/apps/persons/views.py:38-40` (PersonViewSet)

- [ ] **Step 1: ActivityLog — adicionar select_related("user")**

```python
logs = (
    ServiceOrderActivityLog.objects
    .filter(service_order=service_order)
    .select_related("user")
    .order_by("-created_at")
)
```

- [ ] **Step 2: FiscalDocumentViewSet — adicionar select_related**

```python
def get_queryset(self):
    return (
        FiscalDocument.objects.filter(is_active=True)
        .select_related("config", "service_order", "created_by", "destinatario")
        .order_by("-created_at")
    )
```

- [ ] **Step 3: PersonViewSet — condicionar prefetch por action**

```python
def get_queryset(self):
    base = Person.objects.filter(is_active=True)
    if self.action in ("retrieve", "update", "partial_update"):
        base = base.prefetch_related("roles", "contacts", "addresses", "documents")
    elif self.action == "list":
        base = base.prefetch_related("roles")
    # ... filtros existentes ...
    return base.distinct().order_by("-created_at")
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/
git commit -m "perf(backend): fix N+1 queries in ActivityLog, FiscalDocument, PersonViewSet"
```

---

### Task 3.5: Adicionar indices compostos faltando

**Agente:** Backend
**Validador:** Performance

**Files:**
- Create: migration em `accounts_receivable/migrations/`
- Create: migration em `fiscal/migrations/`

- [ ] **Step 1: Indice composto em ReceivableDocument**

```python
# Na model Meta de ReceivableDocument:
class Meta:
    indexes = [
        models.Index(
            fields=["service_order", "is_active", "status"],
            name="receivable_os_active_status_idx",
        ),
    ]
```

- [ ] **Step 2: db_index em NFeEntrada.estoque_gerado**

- [ ] **Step 3: Gerar e aplicar migrations**

Run: `cd backend/core && python manage.py makemigrations accounts_receivable fiscal && python manage.py migrate_schemas`

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/accounts_receivable/migrations/ backend/core/apps/fiscal/migrations/
git commit -m "perf(db): add composite index on ReceivableDocument + db_index on estoque_gerado"
```

---

### Task 3.6: GZip middleware + Rate limiting

**Agente:** DevOps
**Validador:** QA

**Files:**
- Modify: `backend/core/config/settings/base.py:92-102` (MIDDLEWARE)
- Modify: `backend/core/config/settings/base.py:185-203` (REST_FRAMEWORK)

- [ ] **Step 1: Adicionar GZipMiddleware**

```python
MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",
    "django.middleware.gzip.GZipMiddleware",  # NOVO — comprimir respostas
    "corsheaders.middleware.CorsMiddleware",
    # ... resto ...
]
```

- [ ] **Step 2: Adicionar throttle rates ao REST_FRAMEWORK**

```python
REST_FRAMEWORK = {
    # ... existente ...
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",
        "user": "200/minute",
    },
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/config/settings/base.py
git commit -m "infra(backend): add GZip compression + DRF rate limiting"
```

---

### Validacao Sprint 3

- [ ] **Performance:** Kanban list query count ANTES vs DEPOIS (target: -60% queries)
- [ ] **QA:** Todos os testes existentes passam
- [ ] **QA:** `python manage.py migrate_schemas --check` (migrations aplicadas)
- [ ] **Code Reviewer:** Review de todas as mudancas em serializers e views
- [ ] **PM:** Todos os 6 tasks concluidos

---

## Sprint 4: Frontend Performance

**Agentes:** Frontend, Code Reviewer, QA
**Objetivo:** Lazy loading, memoization, query optimization no Next.js.
**Branch:** `perf/frontend-optimization`

---

### Task 4.1: Lazy load tabs do OS detail

**Agente:** Frontend
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/ServiceOrderForm.tsx:34-42`

- [ ] **Step 1: Converter imports estaticos para React.lazy**

```typescript
import { lazy, Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

// Manter estaticos (usados no load inicial):
import { OpeningTab } from "./tabs/OpeningTab"
import { PartsTab } from "./tabs/PartsTab"
import { ServicesTab } from "./tabs/ServicesTab"

// Lazy load (usados sob demanda):
const ClosingTab = lazy(() => import("./tabs/ClosingTab").then(m => ({ default: m.ClosingTab })))
const FilesTab = lazy(() => import("./tabs/FilesTab").then(m => ({ default: m.FilesTab })))
const HistoryTab = lazy(() => import("./tabs/HistoryTab").then(m => ({ default: m.HistoryTab })))
const NotesTab = lazy(() => import("./tabs/NotesTab").then(m => ({ default: m.NotesTab })))
const RemindersTab = lazy(() => import("./tabs/RemindersTab").then(m => ({ default: m.RemindersTab })))
```

- [ ] **Step 2: Envolver area de tabs com Suspense**

```tsx
<Suspense fallback={<Skeleton className="h-64 w-full" />}>
  {activeTab === "closing" && <ClosingTab ... />}
  {activeTab === "files" && <FilesTab ... />}
  {activeTab === "history" && <HistoryTab ... />}
  {activeTab === "notes" && <NotesTab ... />}
  {activeTab === "reminders" && <RemindersTab ... />}
</Suspense>
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/os/
git commit -m "perf(web): lazy load 5 secondary OS tabs — reduce initial parse time"
```

---

### Task 4.2: Lazy load recharts no dashboard

**Agente:** Frontend
**Validador:** QA

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx` (ou equivalente)

- [ ] **Step 1: Dynamic import do BillingByTypeChart**

```typescript
import dynamic from "next/dynamic"

const BillingByTypeChart = dynamic(
  () => import("./BillingByTypeChart").then(m => ({ default: m.BillingByTypeChart })),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/(app)/dashboard/
git commit -m "perf(web): lazy load recharts (~230KB) — only loaded for manager role"
```

---

### Task 4.3: useWatch + useMemo + conditional queries

**Agente:** Frontend
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/OpeningTab.tsx:21`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/page.tsx:36`
- Modify: `apps/dscar-web/src/components/Sidebar.tsx:409-418`
- Modify: `apps/dscar-web/src/hooks/useFinanceiro.ts:159` (staleTime)
- Modify: `apps/dscar-web/src/hooks/useAccounting.ts:67` (staleTime)

- [ ] **Step 1: OpeningTab — form.watch para useWatch**

```typescript
import { useWatch } from "react-hook-form"
const customerType = useWatch({ control: form.control, name: "customer_type" }) ?? "private"
```

- [ ] **Step 2: Dashboard — condicionar useServiceOrders**

Adicionar `enabled` ao hook para nao buscar quando role != STOREKEEPER:

```typescript
const { data: ordersData, isLoading: ordersLoading } = useServiceOrders(
  { ordering: "-opened_at", page: "1", page_size: "5" },
  { enabled: !roleParam }
)
```

- [ ] **Step 3: Sidebar — memoizar visibleSections**

```typescript
const visibleSections = useMemo(
  () => NAV_SECTIONS.filter((s) => {
    if (s.minRole && userRoleLevel < (ROLE_HIERARCHY[s.minRole] ?? 0)) return false
    if (s.requiredPermission) {
      if (userRoleLevel >= ROLE_HIERARCHY.MANAGER) return true
      return userPerms.includes(s.requiredPermission)
    }
    return true
  }),
  [userRoleLevel, userPerms]
)
```

- [ ] **Step 4: Aumentar staleTime para dados de referencia**

```typescript
// useFinanceiro.ts — useSuppliers:
staleTime: 10 * 60_000, // 10 min

// useAccounting.ts — useAnalyticalAccounts:
staleTime: 30 * 60_000, // 30 min
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/
git commit -m "perf(web): useWatch, conditional queries, memoize Sidebar, increase staleTime for reference data"
```

---

### Task 4.4: Migrar logos para next/image

**Agente:** Frontend
**Validador:** QA

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx` (logo)
- Modify: `apps/dscar-web/src/components/MobileSidebar.tsx` (logo)

- [ ] **Step 1: Substituir `<img>` por `<Image>` nos logos**

```tsx
import Image from "next/image"

<Image
  src="/dscar-logo.png"
  alt="DS Car"
  width={36}
  height={36}
  className="object-contain logo-themed"
  priority
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/
git commit -m "perf(web): migrate logos to next/image — WebP, priority hints, CLS prevention"
```

---

### Validacao Sprint 4

- [ ] **QA:** `npx next build` sem erros + bundle analyzer confirma reducao
- [ ] **QA:** Navegar por OS detail, dashboard, sidebar — sem regressao visual
- [ ] **Code Reviewer:** Review de lazy loading, memoization
- [ ] **PM:** Todos os 4 tasks concluidos

---

## Sprint 5: Mobile Performance

**Agentes:** Mobile, Code Reviewer, QA
**Objetivo:** expo-image, React.memo, FlatList, lazy tabs, upload paralelo.
**Branch:** `perf/mobile-optimization`

---

### Task 5.1: Migrar Image para expo-image

**Agente:** Mobile
**Validador:** QA

**Files:**
- Modify: `apps/mobile/src/components/os/PhotosTab.tsx:4`
- Modify: `apps/mobile/src/components/os/PhotoGroup.tsx:5`
- Modify: `apps/mobile/src/components/checklist/PhotoSlotGrid.tsx:10`

- [ ] **Step 1: Instalar expo-image se necessario**

Run: `cd apps/mobile && npx expo install expo-image`

- [ ] **Step 2: Substituir imports em PhotosTab, PhotoGroup, PhotoSlotGrid**

```typescript
// ANTES:
import { Image } from 'react-native'
<Image source={{ uri: photo.url }} style={styles.thumb} resizeMode="cover" />

// DEPOIS:
import { Image } from 'expo-image'
<Image source={{ uri: photo.url }} style={styles.thumb} contentFit="cover" cachePolicy="disk" transition={150} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "perf(mobile): migrate to expo-image — disk caching, blurhash, no re-downloads"
```

---

### Task 5.2: React.memo + useCallback no Kanban

**Agente:** Mobile
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/mobile/src/components/kanban/KanbanCard.tsx:19`
- Modify: `apps/mobile/src/components/kanban/KanbanColumn.tsx:30-40`
- Modify: `apps/mobile/app/(app)/kanban/index.tsx` (onCardPress)

- [ ] **Step 1: Wrap KanbanCard com React.memo**

```typescript
export const KanbanCard = React.memo(function KanbanCard({
  number, plate, model, customerName, daysInShop, hasTransitionBlocks, onPress,
}: KanbanCardProps): React.JSX.Element {
  // ... corpo existente ...
})
```

- [ ] **Step 2: Wrap KanbanColumn com React.memo + extrair callbacks**

```typescript
export const KanbanColumn = React.memo(function KanbanColumn({ ... }) {
  const renderItem = useCallback(({ item }: { item: KanbanOS }) => (
    <KanbanCard ... onPress={() => onCardPress(item.id)} />
  ), [onCardPress])

  const keyExtractor = useCallback((item: KanbanOS) => item.id, [])

  return (
    <FlatList
      data={column.items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={8}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews
      ...
    />
  )
})
```

- [ ] **Step 3: Estabilizar onCardPress no parent**

```typescript
const handleCardPress = useCallback(
  (osId: string) => router.push(`/(app)/os/${osId}`),
  [router]
)
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/kanban/ apps/mobile/app/(app)/kanban/
git commit -m "perf(mobile): memoize KanbanCard/Column + FlatList optimization props"
```

---

### Task 5.3: FlatList props na OS List + lazy tabs

**Agente:** Mobile
**Validador:** QA

**Files:**
- Modify: `apps/mobile/app/(app)/os/index.tsx:306-327`
- Modify: `apps/mobile/app/(app)/_layout.tsx:13-15`

- [ ] **Step 1: Adicionar props de performance ao FlatList**

```typescript
<FlatList<ServiceOrder>
  // ... props existentes ...
  initialNumToRender={12}
  maxToRenderPerBatch={8}
  windowSize={7}
  removeClippedSubviews
/>
```

- [ ] **Step 2: Adicionar lazy: true nas Tabs**

```typescript
<Tabs
  tabBar={(props) => <FrostedNavBar {...props} />}
  screenOptions={{ headerShown: false, lazy: true }}
>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/
git commit -m "perf(mobile): FlatList optimization props + lazy tab loading"
```

---

### Task 5.4: Remover OfflineBanner duplicado + singleton NetInfo

**Agente:** Mobile
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx:12` (remover OfflineBanner)
- Modify: `apps/mobile/src/hooks/useConnectivity.ts` (simplificar para leitura de store)

- [ ] **Step 1: Remover OfflineBanner de (app)/_layout.tsx**

Manter apenas em `app/_layout.tsx:74` (root). Remover a linha 12 de `app/(app)/_layout.tsx`.

- [ ] **Step 2: Mover NetInfo listener para inicializacao do store**

```typescript
// Em sync.store.ts ou no bootstrap do app:
import NetInfo from '@react-native-community/netinfo'

// Singleton — registrado uma vez na inicializacao
NetInfo.addEventListener((state) => {
  useSyncStore.getState().setIsOnline(state.isConnected ?? false)
})

// useConnectivity.ts simplificado:
export function useConnectivity(): boolean {
  return useSyncStore((s) => s.isOnline)
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "fix(mobile): remove duplicate OfflineBanner + singleton NetInfo listener"
```

---

### Task 5.5: Upload de fotos em paralelo (concurrency 3)

**Agente:** Mobile
**Validador:** QA

**Files:**
- Modify: `apps/mobile/src/stores/photo.store.ts:192-238`

- [ ] **Step 1: Substituir loop sequencial por batches paralelos**

```typescript
const UPLOAD_CONCURRENCY = 3

// Substituir o for...of por:
for (let i = 0; i < pending.length; i += UPLOAD_CONCURRENCY) {
  const batch = pending.slice(i, i + UPLOAD_CONCURRENCY)
  const results = await Promise.allSettled(
    batch.map((item) => uploadSinglePhoto(item))
  )
  // Processar resultados (log falhas, continuar)
  for (const result of results) {
    if (result.status === "rejected") {
      logger.warn("Upload failed:", result.reason)
    }
  }
}
```

Extrair a logica de upload individual para uma funcao `uploadSinglePhoto(item)`.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/stores/photo.store.ts
git commit -m "perf(mobile): parallel photo uploads (concurrency 3) — ~3x faster upload"
```

---

### Task 5.6: FloatingFAB actions como constante de modulo

**Agente:** Mobile
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/mobile/src/components/navigation/FloatingFAB.tsx:65-71`

- [ ] **Step 1: Extrair array para constante de modulo**

```typescript
const QUICK_ACTIONS = [
  { icon: 'add-circle-outline' as const, label: 'Nova OS', route: '/(app)/nova-os' as const },
  { icon: 'person-add-outline' as const, label: 'Novo Cliente', route: '/(app)/cadastro/cliente' as const },
  { icon: 'car-outline' as const, label: 'Novo Veiculo', route: '/(app)/cadastro/veiculo' as const },
  { icon: 'calendar-outline' as const, label: 'Agendar Entrada', route: '/(app)/agenda' as const },
  { icon: 'checkbox-outline' as const, label: 'Checklist', route: '/(app)/checklist' as const },
] as const
```

Dentro do componente, construir o array com `onPress` usando `useMemo`.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/navigation/FloatingFAB.tsx
git commit -m "perf(mobile): extract FAB actions to module constant — prevent re-render cascade"
```

---

### Validacao Sprint 5

- [ ] **QA:** App mobile inicia sem crash, Kanban rola suave, fotos carregam do cache
- [ ] **QA:** Upload de 6 fotos — confirmar que sobe em batches de 3
- [ ] **Code Reviewer:** Review de React.memo, useCallback, FlatList props
- [ ] **PM:** Todos os 6 tasks concluidos

---

## Sprint 6: Arquitetura & Qualidade de Codigo

**Agentes:** Code Reviewer, Backend, Frontend, QA
**Objetivo:** Eliminar codigo morto, padronizar patterns, compartilhar utils.
**Branch:** `refactor/code-quality`

---

### Task 6.1: Padronizar error response key para "detail"

**Agente:** Backend
**Validador:** Code Reviewer

**Files:**
- Modify: `backend/core/apps/purchasing/views.py` (trocar `"erro"` por `"detail"`)
- Modify: `backend/core/apps/quotes/views.py`
- Modify: `backend/core/apps/inventory/views_movement.py`
- Modify: `backend/core/apps/inventory/views_counting.py`
- Modify: `backend/core/apps/cilia/views.py`

- [ ] **Step 1: Find & replace `"erro"` por `"detail"` em todos os Response()**

Run: `cd backend/core && grep -rn '"erro"' apps/ --include="*.py" -l`

Substituir em cada arquivo.

- [ ] **Step 2: Atualizar frontend apiFetch para remover fallback "erro"**

Em `apps/dscar-web/src/lib/api.ts`, remover o fallback `e.erro`:

```typescript
const message = (e.detail as string | undefined) ?? "Erro inesperado."
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/ apps/dscar-web/src/lib/api.ts
git commit -m "refactor: standardize API error responses to DRF 'detail' key everywhere"
```

---

### Task 6.2: Resolver conflito de versao React no root package.json

**Agente:** Frontend
**Validador:** DevOps

**Files:**
- Modify: `/package.json` (root)

- [ ] **Step 1: Remover react/react-dom de dependencies root**

Manter apenas em `devDependencies` (para tipos) e `overrides` (para pinning). Alinhar todas as versoes para `19.2.5`.

- [ ] **Step 2: npm install para regenerar lockfile**

Run: `npm install`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix: resolve React version conflict — align all to 19.2.5, remove from root dependencies"
```

---

### Task 6.3: Mobile compartilhar @paddock/utils

**Agente:** Mobile
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/mobile/package.json` (adicionar dependencia)
- Modify: `apps/mobile/src/components/os/os-detail-utils.ts` (remover duplicatas)

- [ ] **Step 1: Adicionar @paddock/utils ao mobile**

```json
"dependencies": {
  "@paddock/utils": "*",
}
```

- [ ] **Step 2: Substituir formatCurrency/formatDateTime locais por imports do pacote**

```typescript
import { formatCurrency, formatDateTime } from "@paddock/utils"
```

Remover as funcoes duplicadas de `os-detail-utils.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "refactor(mobile): use @paddock/utils instead of duplicated formatters"
```

---

### Task 6.4: Extrair business logic de HR views para services

**Agente:** Backend
**Validador:** Code Reviewer

**Files:**
- Modify: `backend/core/apps/hr/views.py:177-240` (_calculate_termination)
- Modify: `backend/core/apps/hr/views.py:659-698` (_calculate_vacation)
- Modify: `backend/core/apps/hr/services.py` (destino)

- [ ] **Step 1: Mover _calculate_termination e _calculate_vacation para services.py**

Criar metodos `calculate_termination(employee)` e `calculate_vacation(employee, period)` em `hr/services.py`.

- [ ] **Step 2: Chamar services nos ViewSets**

```python
from apps.hr.services import PayslipService

# No ViewSet:
result = PayslipService.calculate_termination(employee)
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/hr/
git commit -m "refactor(hr): extract termination/vacation calculations from views to services"
```

---

### Task 6.5: Fix handleApiFormError any type

**Agente:** Frontend
**Validador:** Code Reviewer

**Files:**
- Modify: `apps/dscar-web/src/lib/api.ts:70`

- [ ] **Step 1: Tipar corretamente**

```typescript
import type { UseFormSetError, FieldValues } from "react-hook-form"

export function handleApiFormError<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>
): void {
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/lib/api.ts
git commit -m "fix(web): type handleApiFormError properly — remove last 'any' in codebase"
```

---

### Task 6.6: Remover dead code e limpar imports

**Agente:** Code Reviewer
**Validador:** QA

- [ ] **Step 1: Remover formatMonth morto em BillingByTypeChart.tsx**
- [ ] **Step 2: Comentar URL includes de apps inativos em config/urls.py**

```python
# Post-MVP:
# path("api/v1/crm/", include("apps.crm.urls")),
# path("api/v1/store/", include("apps.store.urls")),
# path("api/v1/ai/", include("apps.ai.urls")),
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: remove dead code — unused formatMonth, inactive URL includes"
```

---

### Validacao Sprint 6

- [ ] **QA:** `npx tsc --noEmit` (web) — zero erros
- [ ] **QA:** `python manage.py test` — todos passam
- [ ] **QA:** `grep -rn '"erro"' backend/core/apps/ --include="*.py" | grep Response` — zero matches
- [ ] **Code Reviewer:** Review final de todos os diffs
- [ ] **PM:** Todos os 6 tasks concluidos

---

## Sprint 7: Testes & Hardening

**Agentes:** QA, Backend, Frontend, DevOps
**Objetivo:** Cobrir gaps de testes, health checks, monitoramento.
**Branch:** `quality/testing-hardening`

---

### Task 7.1: Health check endpoint

**Agente:** DevOps
**Validador:** QA

**Files:**
- Create: `backend/core/apps/authentication/views_health.py`
- Modify: `backend/core/config/urls.py`

- [ ] **Step 1: Criar endpoint /healthz**

```python
from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([AllowAny])
def healthz(request):
    """Health check para load balancer / ECS."""
    checks = {}
    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
    try:
        cache.set("_healthz", "1", timeout=5)
        checks["redis"] = "ok" if cache.get("_healthz") == "1" else "error"
    except Exception:
        checks["redis"] = "error"

    healthy = all(v == "ok" for v in checks.values())
    return Response(checks, status=200 if healthy else 503)
```

- [ ] **Step 2: Registrar em urls.py**

```python
from apps.authentication.views_health import healthz
urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    # ... resto ...
]
```

- [ ] **Step 3: Commit**

```bash
git add backend/core/
git commit -m "infra: add /healthz endpoint — checks DB + Redis for ECS/load balancer"
```

---

### Task 7.2: Testes para purchasing (zero coverage)

**Agente:** QA
**Validador:** Code Reviewer

**Files:**
- Create: `backend/core/apps/purchasing/tests/test_pedido_compra.py`
- Create: `backend/core/apps/purchasing/tests/test_ordem_compra.py`

- [ ] **Step 1: Criar testes para PedidoCompra — CRUD + status transitions**
- [ ] **Step 2: Criar testes para OrdemCompra — approval workflow**
- [ ] **Step 3: Rodar testes**

Run: `cd backend/core && python -m pytest apps/purchasing/tests/ -v`
Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/purchasing/tests/
git commit -m "test(purchasing): add tests for PedidoCompra + OrdemCompra approval workflow"
```

---

### Task 7.3: Testes para hooks frontend criticos

**Agente:** QA
**Validador:** Frontend

**Files:**
- Create: `apps/dscar-web/src/hooks/__tests__/useServiceOrders.test.ts`
- Create: `apps/dscar-web/src/lib/__tests__/query-client.test.ts`

- [ ] **Step 1: Testar que getQueryClient retorna instancias distintas no server**
- [ ] **Step 2: Testar que getQueryClient retorna mesma instancia no browser**
- [ ] **Step 3: Testar que useServiceOrders monta com filtros corretos**
- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/
git commit -m "test(web): add tests for QueryClient isolation + useServiceOrders"
```

---

### Validacao Sprint 7 (FINAL)

- [ ] **QA:** Suite completa de testes — backend + frontend — ZERO falhas
- [ ] **QA:** `/healthz` retorna 200 com DB + Redis OK
- [ ] **DevOps:** GZip ativo (verificar headers Content-Encoding)
- [ ] **DevOps:** Rate limiting ativo (429 apos 200 requests/min)
- [ ] **Performance:** Benchmark antes/depois:
  - Dashboard response time: target < 50ms (cached)
  - Kanban list query count: target < 5 queries
  - OS detail response time: target < 100ms
- [ ] **Code Reviewer:** Auditoria final — zero `any`, zero `str(e)`, zero `"erro":` em responses
- [ ] **PM:** TODOS os 38 tasks dos 7 sprints marcados como concluidos

---

## Metricas de Sucesso

| Metrica | Antes | Target |
|---------|-------|--------|
| Dashboard queries | 15 | 0 (cache hit) / 3 (cache miss) |
| Kanban list queries | 50+ (N+1) | 3-5 |
| OS detail queries | 20+ | 8-10 |
| Dashboard response (cache hit) | ~200ms | < 10ms |
| Kanban response | ~500ms | < 100ms |
| Frontend JS bundle (OS page) | 100% | -30% (lazy tabs) |
| Mobile photo load | re-download | disk cache |
| Mobile photo upload (12 fotos) | ~24s sequencial | ~8s paralelo |
| `str(e)` em responses | 28 | 0 |
| `"erro":` em responses | 15+ | 0 |
| Test files purchasing | 0 | 2+ |
| Health check endpoint | inexistente | /healthz 200 |

---

## Cronograma

| Sprint | Duracao | Agentes Primarios |
|--------|---------|-------------------|
| 1 — Seguranca | 1 dia | Backend, Frontend, Mobile |
| 2 — Cache Redis | 1 dia | Performance, Backend |
| 3 — N+1 & Queries | 1 dia | Backend, Performance |
| 4 — Frontend Perf | 1 dia | Frontend |
| 5 — Mobile Perf | 1 dia | Mobile |
| 6 — Arquitetura | 1 dia | Code Reviewer, Backend, Frontend |
| 7 — Testes | 1 dia | QA, DevOps |
| **Total** | **7 dias** | **8 agentes** |

---

*Plano gerado em 2026-05-13 pela auditoria completa do monorepo Paddock Solutions.*
*93 issues → 38 tasks → 7 sprints → 8 agentes especializados.*
