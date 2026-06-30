# Sprint 04 — RBAC, Notificações de Prazo e Melhorias do Sprint 03

**Projeto:** DS Car ERP
**Sprint:** 04
**Período:** a definir
**Objetivo:** Implementar controle de acesso por papel (RBAC) no frontend, notificações de prazo de OS e entregar os débitos técnicos carregados do Sprint 03.
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## US-01 — RBAC no Frontend

### Contexto
O backend já emite um JWT Keycloak com o claim `role` contendo um dos valores:
`ADMIN | MANAGER | CONSULTANT | STOREKEEPER`. O frontend precisa ler esse claim
e bloquear rotas e componentes conforme o papel do usuário logado.

### Critérios de Aceitação

1. O hook `usePermission(role: PaddockRole): boolean` retorna `true` se o papel
   do usuário logado é igual ou superior ao papel exigido na hierarquia
   `ADMIN > MANAGER > CONSULTANT > STOREKEEPER`.
2. Um usuário com papel `STOREKEEPER` que tente acessar `/os/nova` é
   redirecionado para `/os` com um toast informativo.
3. Rotas de administração (`/admin/**`, `/configuracoes/**`) são inacessíveis
   para `CONSULTANT` e `STOREKEEPER`; tentativas redirecionam para `/`.
4. O componente `<PermissionGate role="MANAGER">` renderiza seus filhos apenas
   se o papel do usuário satisfaz o critério; caso contrário renderiza `null`
   (ou o `fallback` opcional).
5. A leitura do papel nunca depende de chamada HTTP — usa apenas o JWT já
   presente na sessão `next-auth`.

### Tasks Técnicas

- [x] Definir tipo `PaddockRole` em `packages/types/src/auth.ts`:
  ```ts
  export type PaddockRole = 'ADMIN' | 'MANAGER' | 'CONSULTANT' | 'STOREKEEPER';
  export const ROLE_HIERARCHY: Record<PaddockRole, number> = {
    ADMIN: 4, MANAGER: 3, CONSULTANT: 2, STOREKEEPER: 1,
  };
  ```
- [x] Criar hook `src/hooks/usePermission.ts`:
  - Lê `session.user.role` via `useSession()` do `next-auth`
  - Compara usando `ROLE_HIERARCHY`
  - Assinatura: `usePermission(required: PaddockRole): boolean`
- [x] Criar componente `src/components/PermissionGate.tsx`:
  - Props: `role: PaddockRole`, `fallback?: React.ReactNode`, `children: React.ReactNode`
  - Usa `usePermission` internamente
  - Não renderiza nada enquanto `status === "loading"` (evita flash)
- [x] Criar HOC / guard `src/lib/withRoleGuard.ts`:
  - Recebe o papel mínimo exigido e o redirect de destino
  - Usado nas rotas protegidas via `middleware.ts` ou no topo das páginas
- [x] Proteger rota `/os/nova`:
  - Redirecionar `STOREKEEPER` → `/os` com `toast.info("Sem permissão para criar OS")`
- [ ] Proteger rotas `/admin/**` e `/configuracoes/**`:
  - Redirecionar `CONSULTANT` e `STOREKEEPER` → `/` com toast informativo
- [x] Adicionar `role` ao tipo `Session` via `next-auth` module augmentation em
  `src/types/next-auth.d.ts`
- [x] Esconder botão "Nova OS" na lista `/os` para `STOREKEEPER` usando
  `<PermissionGate role="CONSULTANT">`
- [ ] Escrever testes unitários (Vitest) para `usePermission`:
  - ADMIN satisfaz qualquer papel exigido
  - STOREKEEPER não satisfaz CONSULTANT nem acima
  - MANAGER satisfaz MANAGER e CONSULTANT, não satisfaz ADMIN

---

## US-02 — Notificações de Prazo de OS

### Contexto
OS com `estimated_delivery` igual a hoje ou já vencidas precisam de visibilidade
imediata no header, sem forçar o usuário a abrir o Kanban.

### Critérios de Aceitação

1. O ícone de sino no header exibe um badge vermelho com a contagem de OS
   vencidas ou com entrega prevista para hoje.
2. Ao clicar no sino, um dropdown lista essas OS com: número, placa, status e
   data prevista formatada.
3. Cada item do dropdown é um link para `/os/[id]`.
4. O dropdown distingue visualmente OS vencidas (entrega no passado) de OS com
   entrega hoje.
5. A query tem `staleTime: 60_000` ms e `refetchOnWindowFocus: true`.
6. Quando não há OS pendentes, o dropdown exibe "Nenhuma OS com prazo hoje ou vencida."

### Tasks Técnicas

- [x] Criar hook `src/hooks/useOverdueOrders.ts`:
  - Parâmetro de query: `estimated_delivery__lte=<hoje>` + `status__in=OPEN,IN_PROGRESS`
  - `QueryKey: ["service-orders", "overdue"]`
  - `staleTime: 60_000`, `refetchOnWindowFocus: true`
  - Retorna `{ orders: ServiceOrder[]; count: number; isLoading: boolean }`
- [x] Criar componente `src/components/header/NotificationBell.tsx`:
  - Usa `useOverdueOrders`
  - Badge: `<span>` absoluto sobre o ícone, vermelho, oculto quando `count === 0`
  - Badge trunca em `99+` para contagens altas
- [x] Criar componente `src/components/header/OverdueDropdown.tsx`:
  - `<Popover>` ou `<DropdownMenu>` do shadcn/ui
  - Lista OS com chip de status (reutilizar `SERVICE_ORDER_STATUS_CONFIG`)
  - Destacar itens vencidos com texto vermelho; itens de hoje com texto âmbar
  - Formatação da data: `dd/MM/yyyy` usando `date-fns/ptBR`
- [x] Integrar `<NotificationBell>` no `src/components/Header.tsx` (ou equivalente)
- [x] Garantir que a query não bloqueia a renderização do header (dados chegam de forma assíncrona, skeleton ou badge zerado enquanto carrega)
- [ ] Escrever testes de componente (Vitest + Testing Library):
  - Badge exibe `3` quando hook retorna 3 OS
  - Badge oculto quando `count === 0`
  - Dropdown lista OS e links navegam corretamente

---

## US-03 — Melhorias Pendentes do Sprint 03

### Contexto
Itens que ficaram de fora do Sprint 03 por dependência ou tempo.

### Critérios de Aceitação

1. A página `/clientes/[id]` exibe breadcrumb `Clientes / <Nome do cliente>` no topo.
2. A página `/clientes/[id]` está envolvida em `<ErrorBoundary>` + `<Suspense>` da mesma forma que as demais páginas.
3. Os cards do Kanban (`<KanbanCard>`) exibem o nome do cliente como link para `/clientes/[id]`.
4. Não há ocorrências de `href as never` no codebase — toda navegação usa o tipo correto.
5. O hook `useClientOrders` existe como módulo isolado e a página `/clientes/[id]` o consome.
6. O `ErrorBoundary` captura exceções via `Sentry.captureException` com degradação silenciosa quando `SENTRY_DSN` não está configurado.

### Tasks Técnicas

#### Breadcrumb em `/clientes/[id]`
- [x] Verificar se existe componente `<Breadcrumb>` em `packages/ui` ou `src/components/ui`
- [x] Se não existir, criar `src/components/ui/breadcrumb.tsx` usando shadcn/ui (`npx shadcn@latest add breadcrumb`) ou implementação manual com `<nav aria-label="breadcrumb">`
- [x] Adicionar breadcrumb no topo de `src/app/(app)/clientes/[id]/page.tsx`:
  `Clientes` (link para `/clientes`) → `<Nome do cliente>` (texto atual, sem link)
- [x] O breadcrumb só renderiza o nome do cliente após `useCustomer` resolver (exibir placeholder "..." enquanto carrega)

#### ErrorBoundary + Suspense em `/clientes/[id]`
- [x] Criar (ou atualizar) `src/app/(app)/clientes/[id]/layout.tsx` (ou envolver diretamente na página) com `<ErrorBoundary>` + `<Suspense fallback={<ClienteDetailSkeleton />}>`
- [x] Extrair o skeleton de carregamento atual para componente `<ClienteDetailSkeleton>` reutilizável

#### Sentry no ErrorBoundary
- [x] Instalar `@sentry/nextjs` (se ainda não instalado): `pnpm add @sentry/nextjs`
- [x] Atualizar `src/components/ErrorBoundary.tsx`:
  ```ts
  import * as Sentry from '@sentry/nextjs';
  // No onError / componentDidCatch:
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error);
  }
  ```
- [x] Adicionar `NEXT_PUBLIC_SENTRY_DSN` ao `.env.example` com valor em branco

#### Hook `useClientOrders`
- [x] Criar `src/hooks/useClientOrders.ts`:
  ```ts
  export function useClientOrders(customerId: string) {
    return useQuery({
      queryKey: ['service-orders', 'by-client', customerId],
      queryFn: () => apiFetch<PaginatedResponse<ServiceOrder>>(
        `/service-orders/?customer=${customerId}&ordering=-opened_at&page_size=10`
      ),
      enabled: !!customerId,
    });
  }
  ```
- [x] Atualizar `src/app/(app)/clientes/[id]/page.tsx` para importar e usar `useClientOrders` em vez de `useServiceOrders` diretamente

#### Link para `/clientes/[id]` no KanbanCard
- [x] Ler `src/components/kanban/KanbanCard.tsx` e identificar onde o nome do cliente é exibido
- [x] Envolver o nome do cliente em `<Link href={`/clientes/${order.customer_id}`}>` usando `next/link`
- [x] Evitar que o clique no link propague o evento de drag-and-drop do DnD Kit (`e.stopPropagation()` se necessário)

#### Resolver DT-04 — tipagem `href as never`
- [x] Fazer `grep -r "as never" apps/dscar-web/src` para listar todas as ocorrências
- [x] Para cada ocorrência relacionada a `href`, substituir por tipagem correta usando as rotas do App Router (considerar `Route` do `next/navigation` ou type assertion correta)
- [x] Garantir que `make typecheck` passa sem erros após as correções

---

## QA

- [ ] Testar US-01: logar como STOREKEEPER → acessar `/os/nova` → confirmar redirect + toast
- [ ] Testar US-01: logar como CONSULTANT → acessar `/admin` → confirmar redirect para `/`
- [ ] Testar US-01: `<PermissionGate role="MANAGER">` oculta botão para CONSULTANT e exibe para MANAGER/ADMIN
- [ ] Testar US-01: sem flash de conteúdo restrito durante carregamento de sessão
- [ ] Testar US-02: badge exibe contagem correta de OS vencidas + hoje
- [ ] Testar US-02: badge some quando não há OS pendentes
- [ ] Testar US-02: clicar em item do dropdown navega para `/os/[id]`
- [ ] Testar US-02: fechar e reabrir janela dispara refetch (refetchOnWindowFocus)
- [ ] Testar US-03: breadcrumb aparece em `/clientes/[id]` com link funcional para `/clientes`
- [ ] Testar US-03: lançar erro em `ClienteDetailPage` → fallback ErrorBoundary exibido com botão "Tentar novamente"
- [ ] Testar US-03: link no KanbanCard navega para `/clientes/[id]` sem interferir no drag
- [ ] Testar US-03: `make typecheck` sem ocorrências de `href as never`
- [ ] Verificar que `make lint` passa sem erros
- [ ] Verificar que `make typecheck` passa (tsc sem erros, nenhum `any` novo)

---

## Progresso do Sprint

| Área | Total | Concluído | Pendente |
|------|-------|-----------|----------|
| Frontend (US-01 RBAC) | 9 | 7 | 2 |
| Frontend (US-02 Notificações) | 7 | 5 | 2 |
| Frontend (US-03 Melhorias) | 13 | 13 | 0 |
| QA | 14 | 0 | 14 |
| **Total** | **43** | **25** | **18** |

**Taxa de conclusão do Sprint 04:** 25/43 (58%)

### Pendente
- **US-01:** Proteger rotas `/admin/**` e `/configuracoes/**` no middleware (outro agente) · Testes unitários usePermission (outro agente)
- **US-02:** Testes de componente NotificationBell/OverdueDropdown (outro agente)
- **QA:** Todos os itens de QA pendentes de execução manual/automatizada

---

## Dependências e Riscos

| Item | Dependência | Risco |
|------|-------------|-------|
| `usePermission` | claim `role` no JWT Keycloak | Baixo — já documentado no CLAUDE.md |
| `NotificationBell` | endpoint `/service-orders/?estimated_delivery__lte=` | Médio — verificar se o filtro existe no backend |
| Sentry | `@sentry/nextjs` instalado | Baixo — degradação silenciosa implementada |
| Drag no KanbanCard | DnD Kit event propagation | Médio — testar com cuidado |

---

*Criado por: PM Agent · Paddock Solutions · 2026-03-30*
