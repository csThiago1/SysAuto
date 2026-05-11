# Apontamento de Horas — Spec

**Data:** 2026-05-11
**Escopo:** Backend (API + seed) + Mobile (tela + hook)
**Dependencias:** Modelo ApontamentoHoras ja existe. Employee com department/position ja existe.

---

## Problema

Tecnicos e consultores nao conseguem registrar apontamento de horas pelo mobile. O modelo `ApontamentoHoras` existe no backend mas nao tem endpoint API. A validacao `TIMESHEET_CLOSED` bloqueia avancos de status sem que o usuario tenha como resolver pelo app. Alem disso, nao existem colaboradores seed para testar.

## Solucao

1. Endpoint API para CRUD de apontamentos vinculados a uma OS
2. Filtro de staff por department no endpoint existente
3. Tela mobile com dois modos: timer real-time e registro manual
4. Seed de 3 colaboradores por setor produtivo

---

## Backend

### 1. Seed Command: `seed_employees`

Management command em `apps/hr/management/commands/seed_employees.py`.

Cria 3 colaboradores por setor produtivo (18 total). Idempotente via `get_or_create` no `username`.

| Setor (department) | Cargo (position) | Colaboradores |
|--------------------|--------------------|---------------|
| bodywork | bodyworker | Carlos Funileiro, Roberto Funileiro, Andre Funileiro |
| painting | painter | Marcos Pintor, Paulo Pintor, Lucas Pintor |
| mechanical | mechanic | Jose Mecanico, Rafael Mecanico, Fernando Mecanico |
| polishing | polisher | Diego Polidor, Bruno Polidor, Leandro Polidor |
| washing | washer | Mateus Lavador, Gustavo Lavador, Felipe Lavador |
| reception | consultant | Marina Consultora, Juliana Consultora, Amanda Consultora |

Cada colaborador:
- GlobalUser com `username` = `primeiro.sobrenome` (ex: `carlos.funileiro`)
- Senha: `paddock123` (via `set_password`)
- Employee com `department`, `position`, `role=STOREKEEPER` (tecnicos) ou `role=CONSULTANT`
- `status=active`, `contract_type=clt`, `hire_date=2025-01-01`

### 2. ViewSet: `ApontamentoViewSet`

Nested sob a OS: `/api/v1/service-orders/{os_id}/apontamentos/`

**Acoes:**
- `GET /` — lista apontamentos da OS (ordenados por `-iniciado_em`)
- `POST /` — cria apontamento
  - Modo timer: body `{ "tecnico_id": "uuid" }` — preenche `iniciado_em=now()`, `status=iniciado`
  - Modo manual: body `{ "tecnico_id": "uuid", "iniciado_em": "ISO", "encerrado_em": "ISO", "observacao": "..." }` — calcula `horas_apontadas`, `status=encerrado`
- `PATCH /{id}/encerrar/` — custom action que preenche `encerrado_em=now()`, calcula `horas_apontadas`, muda `status=encerrado`

**Permissoes:** `IsConsultantOrAbove` (tecnicos com STOREKEEPER+ podem apontar pra si mesmos)

**Serializer:** `ApontamentoSerializer` com campos: `id`, `tecnico` (nested: id, name), `iniciado_em`, `encerrado_em`, `horas_apontadas`, `observacao`, `status`, `created_at`

### 3. Filtro de Staff por Department

O `StaffListView` em `apps/authentication/views.py` ja filtra por `positions`. Adicionar filtro por `departments`:

`GET /api/v1/auth/staff/?departments=painting,bodywork`

Cross-query com `Employee.objects.filter(department__in=departments, is_active=True)` — mesmo padrao do filtro `positions` existente.

---

## Mobile

### 1. Tela `app/(app)/os/apontamento/[osId].tsx`

Nova rota full-screen no Stack do OS.

**Recebe via search params:** `osId`

**Comportamento:**
- Busca OS via `useServiceOrder(osId)` para obter status atual
- Mapeia status → department (tabela acima)
- Busca tecnicos via `GET /auth/staff/?departments={dept}`
- Busca apontamentos via `GET /service-orders/{osId}/apontamentos/`

**Layout:**
```
[Header: ← Apontamento de Horas]
[OS #5 · NOR0C42 · Pintura]

TECNICO
  [Picker: seleciona entre pintores filtrados]

[SegmentedControl: Timer | Manual]

--- Timer ---
  [Iniciar Trabalho]  ou  [Encerrar] + cronometro

--- Manual ---
  Inicio: [DateTimePicker]  Fim: [DateTimePicker]
  Observacao: [TextInput]
  [Salvar]

APONTAMENTOS
  Marcos Pintor · 09:00–11:30 · 2h30 · Encerrado ✓
  Paulo Pintor · 14:00–... · Em andamento ⏱
```

### 2. Mapeamento Status → Department

```typescript
const STATUS_TO_DEPARTMENT: Record<string, string> = {
  mechanic: 'mechanical',
  bodywork: 'bodywork',
  painting: 'painting',
  polishing: 'polishing',
  washing: 'washing',
  assembly: 'bodywork',
  repair: 'mechanical',
};
```

Para status sem mapeamento (reception, budget, etc.), mostra todos os tecnicos.

### 3. Hook `useApontamentos`

```typescript
// Lista apontamentos da OS
useApontamentos(osId: string)

// Cria apontamento (timer ou manual)
useCreateApontamento(osId: string)

// Encerra timer
useEncerrarApontamento(osId: string)
```

### 4. Componente `TimerCard`

Cronometro visual que mostra tempo decorrido desde `iniciado_em` do apontamento ativo.
- Atualiza a cada segundo via `setInterval`
- Formato: `HH:MM:SS`
- Botao "Encerrar" em destaque

### 5. Integracao

- **GeneralTab:** Adicionar botao "Apontar Horas" ao lado de "Avancar Status" e "Checklist"
- **Wizard Resolver:** No `TIMESHEET_CLOSED`, botao de acao navega para tela de apontamento
- **OS Stack:** Registrar rota `apontamento/[osId]`
- **FrostedNavBar:** Adicionar `/os/apontamento` ao `HIDDEN_SUBPATHS`

---

## Estrutura de arquivos

### Backend (novos)
```
apps/hr/management/commands/seed_employees.py                  ← Seed 18 colaboradores
apps/service_orders/serializers/apontamento.py                 ← Serializer
apps/service_orders/views/apontamento.py                       ← ViewSet
```

### Backend (modificados)
```
apps/service_orders/urls.py                                    ← Registrar router nested
apps/authentication/views.py                                   ← Filtro departments no StaffListView
```

### Mobile (novos)
```
app/(app)/os/apontamento/[osId].tsx                            ← Tela principal
src/components/os/TimerCard.tsx                                ← Cronometro visual
src/hooks/useApontamentos.ts                                   ← CRUD hooks
```

### Mobile (modificados)
```
app/(app)/os/_layout.tsx                                       ← Registrar rota
src/components/os/GeneralTab.tsx                               ← Botao "Apontar Horas"
src/components/os/TransitionRequirementsSheet.tsx               ← TIMESHEET_CLOSED → navegar
src/components/navigation/FrostedNavBar.tsx                    ← Esconder navbar
```

---

## Casos de borda

1. **OS sem status produtivo** (reception, budget) — mostra todos os tecnicos sem filtro
2. **Dois timers abertos no mesmo tecnico** — backend rejeita (constraint: max 1 apontamento com status=iniciado por tecnico)
3. **Timer aberto ao avançar status** — soft block TIMESHEET_CLOSED continua bloqueando
4. **Offline** — timer nao funciona offline (depende de API); registro manual pode ser cacheado
5. **Tecnico se auto-aponta** — se o user logado e tecnico, pre-seleciona ele mesmo
6. **Seed idempotente** — roda multiplas vezes sem duplicar
