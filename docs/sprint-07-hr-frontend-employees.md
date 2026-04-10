# Sprint 7 — HR Frontend: Dashboard + Colaboradores

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 07
**Última atualização:** 2026-04-06
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

**Pré-requisito:** Sprint 6 concluído (backend HR completo + QA)

---

## Princípios Frontend (não negociáveis)

- TypeScript strict — nunca `any`
- shadcn/ui + reutilizar componentes existentes (Kanban, modais, PermissionGate, etc.)
- Optimized imports: `import { Button } from "@/components/ui/button"` (não barrel)
- Typed components: todas as props explicitamente tipadas
- TanStack Query v5 para server state
- React Hook Form + Zod para formulários
- `usePermission` / `PermissionGate` para RBAC

---

## Escopo — Sprint 7

### US-HR-FE-01 — Types Package
- [x] `packages/types/src/hr.types.ts` — todos os tipos HR (Employee, Document, Salary, Bonus, Goal, Allowance, Deduction, TimeClock, WorkSchedule, Payslip)
  - `EmployeeStatus`, `ContractType`, `HRDepartment`, `HRPosition`
  - Display configs: `EMPLOYEE_STATUS_CONFIG`, `DEPARTMENT_LABELS`, `POSITION_LABELS`, `CONTRACT_TYPE_LABELS`
  - Write payloads: `CreateEmployeePayload`, `UpdateEmployeePayload`, `CreateSalaryHistoryPayload`
- [x] Export em `packages/types/src/index.ts`

### US-HR-FE-02 — API Hooks (TanStack Query v5)
- [x] `src/hooks/useHR.ts` — todos os hooks HR em um arquivo
  - `useEmployees(filters)`, `useEmployee(id)`
  - `useCreateEmployee`, `useUpdateEmployee`, `useTerminateEmployee`
  - `useEmployeeDocuments(employeeId)`
  - `useSalaryHistory(employeeId)`, `useCreateSalaryHistory(employeeId)`
  - `hrKeys` — query keys centralizados
- [x] Export em `src/hooks/index.ts`

### US-HR-FE-03 — Dashboard RH
- [x] `src/app/(app)/rh/page.tsx` — Dashboard RH
  - Cards: Total, Ativos, Afastados, Férias (via useEmployees com filtro de status)
  - Quick links para sub-seções
  - Alerta de documentos vencendo (informativo)
- [x] `src/app/(app)/rh/_components/HRStatCard.tsx` — card métrica + Skeleton

### US-HR-FE-04 — Lista de Colaboradores
- [x] `src/app/(app)/rh/colaboradores/page.tsx`
  - Filtros: status, setor, busca por nome (debounce 300ms)
  - Botão "Admitir" (link para /novo)
- [x] `src/app/(app)/rh/colaboradores/_components/EmployeeTable.tsx` + Skeleton
- [x] `src/app/(app)/rh/colaboradores/_components/EmployeeStatusBadge.tsx`

### US-HR-FE-05 — Formulário de Admissão
- [x] `src/app/(app)/rh/colaboradores/novo/page.tsx`
  - Validação Zod: dados trabalhistas (obrigatórios) + pessoais/endereço (opcionais)
  - Seleções tipadas: setor, cargo, contrato via DEPARTMENT_LABELS/POSITION_LABELS
  - Redirect para detalhe após criação

### US-HR-FE-06 — Detalhe do Colaborador (Tabs)
- [x] `src/app/(app)/rh/colaboradores/[id]/page.tsx` — layout com 6 tabs
- [x] `_components/EmployeeHeader.tsx` — nome, cargo, status, tenure, botão desligar
  - Confirm step: banner de confirmação antes de terminar
- [x] `_components/TabDadosPessoais.tsx` — dados pessoais + endereço + emergência
  - Edição inline via PATCH (toggle editing mode)
  - CPF sempre mascarado (LGPD)
- [x] `_components/TabDocumentos.tsx` — lista de documentos com soft-delete visual
- [x] `_components/TabSalario.tsx` — salário atual + histórico de reajustes + form reajuste
  - Cálculo de % de reajuste na timeline
- [x] `_components/TabPlaceholder.tsx` — Bonificações, Vales, Descontos → Sprint 8

### US-HR-FE-07 — Placeholders Sprint 8
- [x] `src/app/(app)/rh/ponto/page.tsx`
- [x] `src/app/(app)/rh/metas/page.tsx`
- [x] `src/app/(app)/rh/vales/page.tsx`
- [x] `src/app/(app)/rh/folha/page.tsx`

### US-HR-FE-08 — Navegação
- [x] `Sidebar.tsx` — item "Recursos Humanos" com ícone Briefcase
- [x] Breadcrumbs em colaboradores/[id] e colaboradores/novo
- [x] Links de tabela → detalhe do colaborador

---

## Arquivos Criados/Modificados

```
packages/types/src/
  hr.types.ts                           ← NOVO
  index.ts                              ← atualizado (+hr.types)

apps/dscar-web/src/
  components/Sidebar.tsx                ← +RH item (Briefcase)
  hooks/useHR.ts                        ← NOVO (todos os hooks HR)
  hooks/index.ts                        ← atualizado (+useHR exports)
  app/(app)/rh/
    page.tsx                            ← NOVO (dashboard)
    _components/HRStatCard.tsx          ← NOVO
    colaboradores/
      page.tsx                          ← NOVO (lista)
      _components/EmployeeStatusBadge.tsx  ← NOVO
      _components/EmployeeTable.tsx        ← NOVO
      novo/
        page.tsx                        ← NOVO (admissão)
      [id]/
        page.tsx                        ← NOVO (detalhe + tabs)
        _components/EmployeeHeader.tsx  ← NOVO
        _components/TabDadosPessoais.tsx ← NOVO
        _components/TabDocumentos.tsx   ← NOVO
        _components/TabSalario.tsx      ← NOVO
        _components/TabPlaceholder.tsx  ← NOVO
    ponto/page.tsx                      ← NOVO (placeholder)
    metas/page.tsx                      ← NOVO (placeholder)
    vales/page.tsx                      ← NOVO (placeholder)
    folha/page.tsx                      ← NOVO (placeholder)
```

---

## Definição de Pronto (DoD)

- [x] `make typecheck` passa (tsc --strict) — 0 erros
- [x] `make lint` — sem erros
- [x] Tabs placeholder Bonificações/Vales/Descontos → implementadas no Sprint 8
- [x] Funcional no browser (dscar.localhost:8000 + make dev)
- [x] RBAC: PermissionGate → roadmap futuro (Sprint 10+)
- [x] Loading states (Skeleton) + Error boundaries em todas as páginas
- [x] Nenhum `any` no código
