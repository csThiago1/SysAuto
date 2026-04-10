# Sprint 8 — HR Frontend: Ponto, Metas, Vales e Folha

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 08
**Última atualização:** 2026-04-06
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

**Pré-requisito:** Sprint 7 concluído (Dashboard + Colaboradores funcionando)

---

## Escopo — Sprint 8

### US-HR-FE-09 — Tabs Restantes do Colaborador

- [x] `TabBonificacoes.tsx` — lista bônus do colaborador + form inline de criação
- [x] `TabVales.tsx` — lista vales do colaborador com badges de status
- [x] `TabDescontos.tsx` — lista descontos + form inline de criação + running total

### US-HR-FE-10 — Página de Relógio de Ponto

- [x] `src/app/(app)/rh/ponto/page.tsx` — tela de registro de ponto para colaborador
  - `LiveClock` component: relógio ao vivo com `setInterval` 1s
  - Botão único contextual: "Registrar Entrada" / "Início Intervalo" / "Fim Intervalo" / "Registrar Saída"
  - Caso especial `break_start`: dois botões (break_end + clock_out em paralelo)
  - Após `clock_out`: mensagem "Expediente encerrado. Até amanhã!"
  - Hoje's entries com total de horas trabalhadas
  - Usa `useMyEmployee()`, `useDailySummary(today)`, `useRegisterClock()`

### US-HR-FE-11 — Espelho de Ponto (Gestor)

- [x] `src/app/(app)/rh/ponto/espelho/page.tsx`
  - Seletor de data + filtro por setor
  - Tabela de colaboradores ativos com `EspelhoRow` por colaborador
  - `EspelhoRow`: clock_in/clock_out + total horas com cores (verde≥8h, amber<8h)
  - Cada linha faz `useDailySummary(date)` independentemente
  - Permissão: MANAGER+

### US-HR-FE-12 — Painel de Metas

- [x] `src/app/(app)/rh/metas/page.tsx`
  - Lista de metas com progress bars (progress_pct do backend)
  - Filtros: status (GoalStatus) + setor (HRDepartment)
  - Botão "Nova Meta" com `CreateGoalForm` inline
  - `CreateGoalForm`: radio toggle employee|department (XOR), employees autocomplete
  - Botão "Marcar atingida" para metas `active` com employee
  - Bônus exibido quando > 0

### US-HR-FE-13 — Gestão de Vales

- [x] `src/app/(app)/rh/vales/page.tsx`
  - Tabs: Pendentes (requested) / Aprovados (approved) / Pagos (paid)
  - Cards com badge de status colorido
  - Botão "Aprovar" (requested → approved) / "Marcar pago" (approved → paid)
  - Data de pagamento exibida nos pagos
  - Vales recorrentes indicados visualmente

### US-HR-FE-14 — Folha de Pagamento

- [x] `src/app/(app)/rh/folha/page.tsx` — lista de meses com resumo
  - Agrupa payslips por `reference_month` com totais (gross, net, count, closed)
  - Link para detalhe `/rh/folha/${month}`
  - Form inline "Gerar contracheque" (employee + reference_month)
  - Badges "Fechados" (verde) vs "X/N fechados" (amber)
- [x] `src/app/(app)/rh/folha/[month]/page.tsx` — detalhe da folha
  - Summary cards: base / bônus / vales / descontos / total líquido
  - Tabela com tfoot de totais
  - Botão "Fechar" por linha + "Fechar Folha" com dupla confirmação
  - Estado imutável visual (ícone Lock) após fechamento
- [x] `src/app/(app)/rh/folha/contracheque/page.tsx` — contracheques do colaborador
  - Self-service: filtra pelos payslips do colaborador autenticado via `useMyEmployee()`
  - Card com mês, dias trabalhados, breakdown (base/bônus/vales/descontos), net/gross
  - Botão download PDF (quando `pdf_file_key` disponível)

### US-HR-FE-15 — Hooks (centralizados em useHR.ts)

- [x] `useMyEmployee` — GET /hr/employees/me/ (identifica colaborador autenticado)
- [x] `useDailySummary` — GET /hr/time-clock/daily/{date}/ (refetchInterval 60s)
- [x] `useRegisterClock` — POST /hr/time-clock/
- [x] `useEmployeeBonuses` / `useCreateBonus`
- [x] `useEmployeeDeductions` / `useCreateDeduction`
- [x] `useEmployeeSchedules`
- [x] `useGoals` / `useCreateGoal` / `useAchieveGoal`
- [x] `useAllowances` / `useApproveAllowance` / `usePayAllowance`
- [x] `usePayslips` / `usePayslip` / `useGeneratePayslip` / `useClosePayslip` / `useEmployeePayslips`

### US-HR-FE-16 — Types Package Extensão

- [x] `packages/types/src/hr.types.ts` — todos os tipos HR Sprint 8:
  - `DailySummaryEntry`, `DailySummary`
  - `RegisterClockPayload`, `CreateGoalPayload`
  - `CreateAllowancePayload`, `CreateBonusPayload`, `CreateDeductionPayload`
  - `GeneratePayslipPayload`
  - Configs: `CLOCK_ENTRY_LABELS`, `GOAL_STATUS_CONFIG`, `ALLOWANCE_STATUS_CONFIG`

---

## Estrutura de Arquivos Entregues

```
apps/dscar-web/src/
├── app/(app)/rh/
│   ├── ponto/
│   │   ├── page.tsx                 ✅ Relógio de ponto (colaborador)
│   │   └── espelho/
│   │       └── page.tsx             ✅ Espelho de ponto (gestor)
│   ├── metas/
│   │   └── page.tsx                 ✅ Painel de metas + CreateGoalForm
│   ├── vales/
│   │   └── page.tsx                 ✅ Gestão de vales (tabs status)
│   └── folha/
│       ├── page.tsx                 ✅ Lista de meses agrupados
│       ├── [month]/
│       │   └── page.tsx             ✅ Detalhe da folha + fechar
│       └── contracheque/
│           └── page.tsx             ✅ Self-service contracheques
│
└── colaboradores/[id]/_components/
    ├── TabBonificacoes.tsx           ✅ Bônus do colaborador
    ├── TabVales.tsx                  ✅ Vales do colaborador
    └── TabDescontos.tsx              ✅ Descontos + running total

packages/types/src/hr.types.ts       ✅ Todos os tipos HR (Sprint 7+8)
apps/dscar-web/src/hooks/useHR.ts    ✅ Todos os hooks HR (Sprint 7+8)
```

---

## Definição de Pronto (DoD)

- [x] `tsc --noEmit` passa — 0 erros (TypeScript strict)
- [x] Nenhum `any` no código
- [x] Relógio de ponto: sequência de botões contextual funciona
- [x] Folha: fechamento bloqueia edição (contracheque imutável visualmente)
- [x] Self-service contracheques filtrado por usuário autenticado
- [x] Downloads PDF linkados quando `pdf_file_key` disponível

## Notas de Implementação

- **Backend `/hr/employees/me/`**: action adicionada ao `EmployeeViewSet` no Sprint 8 para identificar o colaborador autenticado (necessário para o `useRegisterClock` que requer UUID explícito no POST)
- **GoalStatus**: `"active"` (não `"in_progress"`) — alinhado com o modelo Django
- **EspelhoRow**: cada linha faz query independente a `useDailySummary` — loading granular sem bloquear a página
- **break_start → bifurcação**: único caso onde dois botões são exibidos (break_end OU clock_out)
- **Folha fechamento**: "Fechar Folha" fecha todos os contracheques abertos do mês; irreversível após confirmação
