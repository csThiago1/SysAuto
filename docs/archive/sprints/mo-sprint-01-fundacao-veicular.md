# MO-Sprint 01 — Fundação Veicular

**Duração:** 2 semanas | **Equipe:** Solo + Claude Code | **Prioridade:** P0 (bloqueante)
**Pré-requisitos:** nenhum · **Desbloqueia:** todas as próximas MO-sprints

---

## Objetivo

Construir a base estrutural em que todo o motor se apoia: representar os 2 CNPJs
DS Car como `Empresa`, integrar a API FIPE, migrar o cadastro de veículo para
selects obrigatórios, e introduzir o perfil veicular (segmento de responsabilidade,
categoria de tamanho, tipo de pintura, enquadramento). Sem essa fundação, nenhuma
ficha técnica é calculável e nenhum preço é defensável.

---

## Referências obrigatórias (leia antes de codar)

1. `/CLAUDE.md` inteiro — foco em armadilhas **Docker dev**, **DRF routers**, **`is_active=True` em APIView**, **multitenancy**.
2. `docs/mo-roadmap.md` — seções "Arquitetura de apps", "Armadilhas específicas do motor" (A1–A10), decisões em aberto.
3. Spec v3.0 do motor — §2 (princípios), §3 (arquitetura), §8 (perfil veicular), §22 (modelo de dados).
4. `backend/core/apps/vehicle_catalog/` — ler models e admin antes de estender.

---

## Escopo

### 1. Novo app: `apps.pricing_profile` (TENANT_APP)

Responsabilidade: **perfil veicular + entidade Empresa**.

Não criar no `vehicle_catalog` (SHARED_APP) porque segmento e fator de
responsabilidade são **decisão comercial do tenant** — outro cliente Paddock
pode querer escala diferente.

#### Models (`backend/core/apps/pricing_profile/models.py`)

```python
class Empresa(PaddockBaseModel):
    """Representa CNPJ operante dentro do tenant.
    DS Car tenant hoje contém 2 Empresas compartilhando ficha técnica."""
    cnpj = models.CharField(max_length=14, unique=True, db_index=True)
    nome_fantasia = models.CharField(max_length=120)
    razao_social = models.CharField(max_length=200)
    inscricao_estadual = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    # NÃO colocar endereço aqui — reutilizar apps.persons.Pessoa via OneToOne
    # quando virar faturador. Por ora só identidade.


class SegmentoVeicular(PaddockBaseModel):
    """Captura responsabilidade/risco: Popular, Médio, Premium, Luxo, Exótico."""
    codigo = models.SlugField(unique=True)
    nome = models.CharField(max_length=60)
    ordem = models.PositiveSmallIntegerField()  # ordena na UI
    fator_responsabilidade = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.5")),
                    MaxValueValidator(Decimal("5.0"))]
    )
    descricao = models.TextField(blank=True)


class CategoriaTamanho(PaddockBaseModel):
    """Captura porte físico: Compacto, Médio, SUV/Grande, Extra grande."""
    codigo = models.SlugField(unique=True)
    nome = models.CharField(max_length=60)
    ordem = models.PositiveSmallIntegerField()
    multiplicador_insumos = models.DecimalField(max_digits=4, decimal_places=2)
    multiplicador_horas = models.DecimalField(max_digits=4, decimal_places=2)


class TipoPintura(PaddockBaseModel):
    """Sólida, Metálica, Perolizada, Tricoat."""
    codigo = models.SlugField(unique=True)
    nome = models.CharField(max_length=60)
    complexidade = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )


class EnquadramentoVeiculo(PaddockBaseModel):
    """Mapa marca/modelo/ano → perfil veicular."""
    marca = models.CharField(max_length=60, db_index=True)
    modelo = models.CharField(max_length=100, blank=True, db_index=True)
    ano_inicio = models.IntegerField(null=True, blank=True)
    ano_fim = models.IntegerField(null=True, blank=True)
    segmento = models.ForeignKey(SegmentoVeicular, on_delete=models.PROTECT)
    tamanho = models.ForeignKey(CategoriaTamanho, on_delete=models.PROTECT)
    tipo_pintura_default = models.ForeignKey(
        TipoPintura, null=True, blank=True, on_delete=models.PROTECT
    )
    prioridade = models.PositiveSmallIntegerField(default=100)
    # quanto menor, mais específico. Match exato prioridade 10,
    # só marca prioridade 50, fallback genérico prioridade 100.

    class Meta:
        indexes = [
            models.Index(fields=["marca", "modelo", "ano_inicio", "ano_fim"]),
        ]
```

#### Seeds (`apps/pricing_profile/seeds/`)

Criar management command `setup_perfil_veicular`:

- 5 segmentos (popular / médio / premium / luxo / exótico) com fatores
  1.00 / 1.25 / 1.55 / 1.90 / 2.50 (ajustáveis no admin).
- 4 tamanhos (compacto 0.75/0.85, médio 1.00/1.00, SUV/grande 1.25/1.10,
  extra grande 1.45/1.20).
- 4 tipos de pintura (solida, metalica, perolizada, tricoat).
- ~500 `EnquadramentoVeiculo` iniciais — json estruturado em
  `seeds/enquadramentos.json` cobrindo top marcas/modelos BR.

#### Decisão: valores em aberto

Valores **default** propostos vão no seed, mas `SegmentoVeicular` e
`CategoriaTamanho` são editáveis no admin. Thiago ajusta antes de MO-4.

### 2. Extensão de `apps.vehicle_catalog` (SHARED_APP)

Adicionar lookup FIPE estruturado e cache.

#### Modelos adicionais

```python
# apps/vehicle_catalog/models.py — estender, não recriar

class VehicleMake(models.Model):
    """Marca FIPE — ex: Honda, Ford."""
    fipe_id = models.CharField(max_length=10, unique=True)
    nome = models.CharField(max_length=80, unique=True, db_index=True)
    nome_normalizado = models.CharField(max_length=80, db_index=True)
    # usar para fuzzy/alias — ver §13 do spec


class VehicleModel(models.Model):
    marca = models.ForeignKey(VehicleMake, on_delete=models.CASCADE, related_name="modelos")
    fipe_id = models.CharField(max_length=10)
    nome = models.CharField(max_length=120, db_index=True)
    nome_normalizado = models.CharField(max_length=120, db_index=True)

    class Meta:
        unique_together = [("marca", "fipe_id")]


class VehicleYearVersion(models.Model):
    """Ano + combustível + versão (ex: '2022 Gasolina EX CVT')."""
    modelo = models.ForeignKey(VehicleModel, on_delete=models.CASCADE, related_name="versoes")
    fipe_id = models.CharField(max_length=20)
    ano = models.IntegerField()
    combustivel = models.CharField(max_length=20)  # gasolina | flex | diesel | eletrico
    descricao = models.CharField(max_length=200)
    codigo_fipe = models.CharField(max_length=20, blank=True, db_index=True)
    valor_referencia = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("modelo", "fipe_id")]
```

Sincronização FIPE em Celery task:

- `task_sync_fipe_makes()` — roda semanal.
- `task_sync_fipe_models(make_id)` — disparado on-demand (usuário abre select).
- `task_sync_fipe_years(model_id)` — on-demand.

TTL do cache: 7 dias (configurável em `FIPE_CACHE_TTL_DAYS`).

### 3. Integração `ServiceOrder` com perfil veicular

Sem quebrar o que existe (CLAUDE.md já diz `ServiceOrder.customer_uuid` é desnormalizado —
pattern).

```python
# apps/service_orders/models.py — adicionar campos desnormalizados

class ServiceOrder(models.Model):
    # ... existente ...
    vehicle_make_id = models.CharField(max_length=10, blank=True)
    vehicle_model_id = models.CharField(max_length=10, blank=True)
    vehicle_year_version_id = models.CharField(max_length=20, blank=True)
    vehicle_fipe_value_snapshot = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )  # congela valor FIPE no momento de criação da OS

    segmento_codigo = models.CharField(max_length=40, blank=True, db_index=True)
    tamanho_codigo = models.CharField(max_length=40, blank=True, db_index=True)
    tipo_pintura_codigo = models.CharField(max_length=40, blank=True)
    empresa_id = models.UUIDField(null=True, blank=True)
    # ^ referência solta a pricing_profile.Empresa (TENANT_APP),
    # igual ao customer_uuid do Sprint 14.
```

Migration: `service_orders/0016_vehicle_profile_snapshot.py`.

### 4. Service de resolução

```python
# apps/pricing_profile/services.py

class EnquadramentoService:
    @staticmethod
    def resolver(marca: str, modelo: str, ano: int) -> dict:
        """Retorna perfil veicular via fallback progressivo.
        1. Match exato marca + modelo + ano in range
        2. Match marca + modelo (qualquer ano)
        3. Match só marca
        4. Fallback: médio/médio/nenhum + log para curadoria
        """
        # implementar com Q() + order_by("prioridade")
        # em caso de fallback, registrar em EnquadramentoFaltante
        ...
```

### 5. Endpoints novos

Seguir padrão do monorepo (CLAUDE.md — DRF com `get_permissions()` separando leitura/escrita):

```
GET  /api/v1/vehicle-catalog/makes/                    → list (cache FIPE)
GET  /api/v1/vehicle-catalog/makes/{id}/models/        → list modelos da marca
GET  /api/v1/vehicle-catalog/models/{id}/years/        → list anos/versões

GET  /api/v1/pricing/empresas/                         → list (MANAGER+)
POST /api/v1/pricing/empresas/                         → create (ADMIN+)
PATCH/api/v1/pricing/empresas/{id}/                    → update (ADMIN+)

GET  /api/v1/pricing/segmentos/                        → list (CONSULTANT+)
POST /api/v1/pricing/segmentos/                        → create (ADMIN+)
PATCH/api/v1/pricing/segmentos/{id}/                   → update (ADMIN+, isso MEXE EM PRECIFICAÇÃO)

GET  /api/v1/pricing/tamanhos/                         → idem segmentos
GET  /api/v1/pricing/tipos-pintura/                    → idem

GET  /api/v1/pricing/enquadramentos/                   → list paginado
POST /api/v1/pricing/enquadramentos/                   → create (MANAGER+)

POST /api/v1/pricing/enquadramentos/resolver/          → resolver por marca+modelo+ano
     body: {marca, modelo, ano}
     response: {segmento, tamanho, tipo_pintura_default, origem: "exato|marca_modelo|marca|fallback"}
```

### 6. Frontend (`apps/dscar-web`)

#### Types

```typescript
// packages/types/src/pricing.types.ts

export interface Empresa {
  id: string
  cnpj: string
  nome_fantasia: string
  razao_social: string
  is_active: boolean
}

export interface SegmentoVeicular { /* espelha model */ }
export interface CategoriaTamanho { /* espelha model */ }
export interface TipoPintura { /* espelha model */ }

export interface EnquadramentoResolve {
  segmento: SegmentoVeicular
  tamanho: CategoriaTamanho
  tipo_pintura_default: TipoPintura | null
  origem: 'exato' | 'marca_modelo' | 'marca' | 'fallback'
}
```

#### Hooks

```typescript
// apps/dscar-web/src/hooks/useVehicleFipe.ts
useFipeMakes()
useFipeModels(makeId)
useFipeYears(modelId)

// apps/dscar-web/src/hooks/useEnquadramento.ts
useResolverEnquadramento(marca, modelo, ano)   // lazy, chama ao ter os 3
```

**Armadilha crítica:** FIPE responde lento em picos (até 2s). Colocar
`staleTime: 24h` no TanStack Query por make/model/ano.

#### Páginas novas

- `/cadastros/empresas` — CRUD listar + Sheet lateral (mesmo padrão `/cadastros/seguradoras`).
- `/cadastros/perfil-veicular/segmentos` — lista + edição.
- `/cadastros/perfil-veicular/tamanhos` — lista + edição.
- `/cadastros/perfil-veicular/tipos-pintura` — lista.
- `/cadastros/perfil-veicular/enquadramentos` — lista paginada com busca +
  form para criar nova regra.

Sidebar: novo grupo "Configuração do motor" com ícone `Settings2` acima de "Cadastros".

#### Mudança em formulário de OS

No `VehicleSection` (já existe após Sprint 14), substituir placa+modelo livres por:

```tsx
<FipeSelectGroup
  onResolve={({ make, model, year }) => {
    // chama /enquadramentos/resolver/
    // exibe badge "Segmento: Médio · Tamanho: Médio · Pintura: Metálica"
    // gravável em override manual
  }}
/>
```

Se placa estiver preenchida, mantém integração `placa-fipe` existente e
**apenas complementa** com selects quando usuário quiser ajustar.

---

## Testes

Backend (pytest):

```
apps/pricing_profile/tests/
  test_models.py       — constraints, validators de decimal
  test_services.py     — EnquadramentoService cobre os 4 fallbacks
  test_views.py        — RBAC, filtros, paginação

apps/vehicle_catalog/tests/
  test_fipe_sync.py    — mock httpx, testa retry + parse
  test_fipe_cache.py   — TTL expirando dispara nova sync
```

Frontend (Vitest):

```
apps/dscar-web/src/hooks/__tests__/useEnquadramento.test.ts
apps/dscar-web/src/components/vehicle/__tests__/FipeSelectGroup.test.tsx
```

---

## Critérios de aceite

- [ ] `make migrate` sem erros em tenant_dscar.
- [ ] `setup_perfil_veicular` popula 5 + 4 + 4 + 500 registros.
- [ ] `POST /pricing/enquadramentos/resolver/` retorna perfil em ≤ 50ms
      (com cache) para 10 veículos conhecidos.
- [ ] `GET /vehicle-catalog/makes/` responde em ≤ 100ms com cache quente.
- [ ] Cadastro de OS novo passa a capturar `segmento_codigo`, `tamanho_codigo`,
      `tipo_pintura_codigo` no momento da criação.
- [ ] `/cadastros/empresas` exibe 2 empresas DS Car (seed).
- [ ] `/cadastros/perfil-veicular/enquadramentos` permite criar novo enquadramento.
- [ ] `make lint`, `make typecheck`, `make test-backend` 100% passando.
- [ ] CLAUDE.md atualizado com: apps novos, variáveis FIPE, sidebar, padrão
      `empresa_id` desnormalizado.

---

## Armadilhas específicas desta sprint

### P1 · Migrations em paralelo com outras sprints
Se MO-2 começar antes de MO-1 fechar, gerar `makemigrations --merge` antes
de mergear. Ver CLAUDE.md: "Django — Migrações com número duplicado".

### P2 · FIPE retorna lista paginada implícita
A API `deividfortuna/fipe` (v2) devolve 200+ marcas em uma chamada, mas nem
todo endpoint faz paging. `task_sync_fipe_models` pode demorar; **rodar em
Celery, nunca no request do usuário**.

### P3 · Normalização antes de match
Nome FIPE: "Volkswagen" · Pessoas escrevem: "VW", "Volks". Popular
`VehicleMake.nome_normalizado` no sync com função `normalizar_texto()` e
tabela de abreviações conhecidas. Colocar no `apps.pricing_catalog.utils`
— servirá para todo o motor de aliases em MO-2.

### P4 · `empresa_id` em `ServiceOrder` precisa de default durante migration
OSs existentes não têm empresa. Migration popular com a `Empresa` "DS Car
Centro Automotivo" via `RunPython` — `PyMigrate` simples.

### P5 · Placa continua sendo campo principal em OS
`placa-fipe.apibrasil.com.br` preenche marca/modelo/ano automaticamente.
FipeSelectGroup é **fallback + override** quando placa não existe ou está
errada. Não forçar usuário a selecionar manualmente se placa resolveu.

### P6 · Alterar valores de `SegmentoVeicular.fator_responsabilidade` afeta
cálculos futuros — mas nunca snapshots antigos. Documentar no admin com
banner: "Alterações afetam apenas orçamentos criados a partir de agora."

---

## Handoff para MO-2

Ao final de MO-1, o próximo sprint pode assumir que:

- Existe `Empresa` com pelo menos 2 registros.
- `ServiceOrder.empresa_id` é preenchido em toda criação.
- `EnquadramentoService.resolver()` está pronto para consumo.
- FIPE está cacheada no Postgres.
- Sidebar frontend tem grupo "Configuração do motor".

MO-2 vai criar `apps.pricing_catalog` que referenciará `Empresa` apenas
onde fizer sentido (fornecedor é global; aliases são globais).

---

## Checklist pós-sprint

Atualizar CLAUDE.md seção "Sprints Entregues" com:

```markdown
### MO-1 — Fundação Veicular — Abril/Maio 2026 ✅
**FIPE + Empresa + Perfil Veicular**

Backend:
- App novo `apps.pricing_profile` (TENANT_APP): Empresa, SegmentoVeicular,
  CategoriaTamanho, TipoPintura, EnquadramentoVeiculo
- App estendido `apps.vehicle_catalog`: VehicleMake, VehicleModel,
  VehicleYearVersion + tasks Celery de sync FIPE
- Migration 0016_vehicle_profile_snapshot em service_orders
- EnquadramentoService com fallback progressivo
- Endpoints /pricing/empresas, /pricing/segmentos, /pricing/tamanhos,
  /pricing/tipos-pintura, /pricing/enquadramentos + /resolver

Frontend:
- `packages/types/src/pricing.types.ts` criado
- Hooks useFipeMakes, useFipeModels, useFipeYears, useResolverEnquadramento
- Páginas /cadastros/empresas, /cadastros/perfil-veicular/*
- Sidebar grupo "Configuração do motor"
- FipeSelectGroup integrado em VehicleSection

Variáveis:
- FIPE_API_URL, FIPE_CACHE_TTL_DAYS
```
