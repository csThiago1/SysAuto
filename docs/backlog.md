# Backlog — Sprint 04 (RBAC, Notificações de Prazo e Melhorias Sprint 03)

**Projeto:** DS Car ERP
**Sprint:** 04
**Última atualização:** 2026-03-30
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## Frontend

### US-01 — RBAC no Frontend

- [ ] Definir tipo `PaddockRole` e `ROLE_HIERARCHY` em `packages/types/src/auth.ts`
- [ ] Criar hook `src/hooks/usePermission.ts` lendo `session.user.role` via `useSession()`
- [ ] Criar componente `src/components/PermissionGate.tsx` com props `role`, `fallback?` e `children`
- [ ] Criar guard `src/lib/withRoleGuard.ts` para uso nas páginas protegidas
- [ ] Proteger `/os/nova`: redirecionar `STOREKEEPER` → `/os` com `toast.info`
- [ ] Proteger `/admin/**` e `/configuracoes/**`: redirecionar `CONSULTANT` e `STOREKEEPER` → `/`
- [ ] Esconder botão "Nova OS" em `/os` para `STOREKEEPER` via `<PermissionGate role="CONSULTANT">`
- [ ] Adicionar module augmentation de `role` no tipo `Session` em `src/types/next-auth.d.ts`
- [ ] Escrever testes unitários Vitest para `usePermission` (hierarquia de papéis)

### US-02 — Notificações de Prazo de OS

- [ ] Criar hook `src/hooks/useOverdueOrders.ts` com `staleTime: 60_000` e `refetchOnWindowFocus: true`
- [ ] Criar componente `src/components/header/NotificationBell.tsx` com badge de contagem
- [ ] Badge exibe `99+` para contagens maiores que 99; oculto quando `count === 0`
- [ ] Criar componente `src/components/header/OverdueDropdown.tsx` com lista de OS vencidas/hoje
- [ ] Diferenciar visualmente OS vencidas (vermelho) de OS com entrega hoje (âmbar)
- [ ] Cada item do dropdown é link para `/os/[id]`
- [ ] Integrar `<NotificationBell>` no `src/components/Header.tsx`
- [ ] Escrever testes de componente (Vitest + Testing Library) para badge e dropdown

### US-03 — Melhorias Pendentes do Sprint 03

- [ ] Criar `src/hooks/useClientOrders.ts` com `QueryKey: ["service-orders", "by-client", customerId]`
- [ ] Atualizar `/clientes/[id]/page.tsx` para usar `useClientOrders` em vez de `useServiceOrders` direto
- [ ] Criar componente `<Breadcrumb>` em `src/components/ui/breadcrumb.tsx` (se não existir via shadcn)
- [ ] Adicionar breadcrumb `Clientes / <Nome do cliente>` no topo de `/clientes/[id]/page.tsx`
- [ ] Extrair skeleton de `/clientes/[id]` para `<ClienteDetailSkeleton>` reutilizável
- [ ] Envolver `/clientes/[id]` em `<ErrorBoundary>` + `<Suspense fallback={<ClienteDetailSkeleton />}>`
- [ ] Instalar `@sentry/nextjs` e adicionar `Sentry.captureException` no `ErrorBoundary` com degradação silenciosa
- [ ] Adicionar `NEXT_PUBLIC_SENTRY_DSN` ao `.env.example`
- [ ] Adicionar link `<Link href={`/clientes/${order.customer_id}`}>` no nome do cliente em `<KanbanCard>`
- [ ] Garantir que o link no KanbanCard não interfere no drag do DnD Kit (`e.stopPropagation()`)
- [ ] Listar e corrigir todas as ocorrências de `href as never` no codebase (DT-04)

---

## QA

- [ ] Testar US-01: `STOREKEEPER` tenta `/os/nova` → redirect `/os` + toast
- [ ] Testar US-01: `CONSULTANT` tenta `/admin` → redirect `/`
- [ ] Testar US-01: `<PermissionGate role="MANAGER">` oculta para `CONSULTANT`, exibe para `MANAGER`/`ADMIN`
- [ ] Testar US-01: sem flash de conteúdo restrito durante carregamento de sessão
- [ ] Testar US-02: badge exibe contagem correta de OS vencidas + hoje
- [ ] Testar US-02: badge oculto quando não há OS pendentes
- [ ] Testar US-02: item do dropdown navega para `/os/[id]` correto
- [ ] Testar US-02: refetch dispara ao recuperar foco da janela
- [ ] Testar US-03: breadcrumb aparece em `/clientes/[id]` com link funcional para `/clientes`
- [ ] Testar US-03: erro em `ClienteDetailPage` → fallback `<ErrorBoundary>` com "Tentar novamente"
- [ ] Testar US-03: clique no nome do cliente no KanbanCard navega para `/clientes/[id]`
- [ ] Testar US-03: drag de card no Kanban não é interrompido pelo link do cliente
- [ ] Verificar que `make typecheck` passa sem `href as never` (DT-04 resolvido)
- [ ] Verificar que `make lint` passa sem erros
- [ ] Verificar que `make typecheck` passa (tsc sem erros, nenhum `any` novo)

---

## Progresso do Sprint

| Área | Total | Concluído | Em Progresso | Bloqueado |
|------|-------|-----------|--------------|-----------|
| Frontend (US-01) | 9 | 0 | 0 | 0 |
| Frontend (US-02) | 8 | 0 | 0 | 0 |
| Frontend (US-03) | 11 | 0 | 0 | 0 |
| QA | 15 | 0 | 0 | 0 |
| **Total** | **43** | **0** | **0** | **0** |

**Taxa de conclusão do Sprint 04:** 0/43 (0%)

---

*Atualizado por: PM Agent · Paddock Solutions · 2026-03-30*
