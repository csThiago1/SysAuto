# Backlog — Sprint 02 (Kanban & Dashboard)

**Projeto:** DS Car ERP
**Sprint:** 02
**Última atualização:** 2026-03-29
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## Frontend

### US-01 — Kanban de OS

- [ ] Instalar dependências: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [ ] Criar store Zustand `useKanbanStore` em `src/store/kanban.ts` (ordem local dos cards por coluna)
- [ ] Criar hook `useKanbanData` em `src/hooks/useKanbanData.ts` — fetcha OS com `page_size=200`, agrupa por status
- [ ] Criar componente `<KanbanColumn>` em `src/components/kanban/KanbanColumn.tsx` — recebe status, lista de OS, exibe header com contagem
- [ ] Criar componente `<KanbanCard>` em `src/components/kanban/KanbanCard.tsx` — número OS, cliente mascarado, placa, consultor, tempo decorrido
- [ ] Criar componente `<KanbanBoard>` em `src/components/kanban/KanbanBoard.tsx` — `<DndContext>` + `<SortableContext>` por coluna
- [ ] Implementar `DragOverlay` com preview do card durante arrasto
- [ ] Implementar rollback otimista: `onMutate` salva estado anterior, `onError` restaura via `queryClient.setQueryData`
- [ ] Criar página `src/app/os/kanban/page.tsx`
- [ ] Adicionar skeleton de 3 cards por coluna (loading state)
- [ ] Adicionar suporte a teclado (`KeyboardSensor`) no `<DndContext>`
- [ ] Adicionar `aria-label` nos cards com número da OS e status
- [ ] Adicionar item "Kanban" na `Sidebar` com ícone `LayoutKanban`

### US-02 — Dashboard Home

- [ ] Criar hook `useDashboardStats` em `src/hooks/useDashboardStats.ts` com `staleTime: 60_000`
- [ ] Criar componente `<StatCard>` em `src/components/dashboard/StatCard.tsx` — ícone, label, valor, variação
- [ ] Criar componente `<RecentOrdersTable>` em `src/components/dashboard/RecentOrdersTable.tsx` — 10 OS mais recentes
- [ ] Implementar skeleton loader para os cards de stats
- [ ] Implementar botão "Atualizar" com `queryClient.invalidateQueries(["dashboard", "stats"])`
- [ ] Criar/atualizar página `src/app/page.tsx` com grid responsivo (`grid-cols-2 md:grid-cols-4`)
- [ ] Adicionar badges de status coloridos na tabela de OS recentes
- [ ] Tratar estado de erro nos cards (exibir `"—"` quando API falha)

### US-03 — Tratamento Global de Erros

- [ ] Instalar dependências: `sonner`, `react-error-boundary`
- [ ] Adicionar `<Toaster />` ao layout raiz `src/app/layout.tsx` com tema DS Car
- [ ] Atualizar `apiFetch` em `src/lib/api.ts`: integrar `toast.error()` para erros HTTP
- [ ] Tratar erro 401 em `apiFetch`: chamar `signOut()` + toast `"Sessão expirada"` + redirect `/login`
- [ ] Tratar erro de rede (catch de fetch): toast `"Sem conexão com o servidor"`
- [ ] Criar componente `<ErrorBoundary>` em `src/components/error-boundary.tsx` usando `react-error-boundary`
- [ ] Criar componente `<PageSkeleton>` em `src/components/page-skeleton.tsx`
- [ ] Envolver página `/os` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/os/kanban` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/` (dashboard) em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/clientes` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Configurar fallback da `<ErrorBoundary>` com botão "Tentar novamente" (`resetErrorBoundary`)
- [ ] Adicionar `Sentry.captureException` no `<ErrorBoundary>` com degradação silenciosa se `SENTRY_DSN` ausente

### US-05 — Paginação na Lista de OS

- [ ] Criar componente `<Pagination>` em `src/components/ui/pagination.tsx`
- [ ] Atualizar `useServiceOrders` para ler `page` de `searchParams` e passar `?page=<n>&page_size=20`
- [ ] Atualizar `QueryKey` para `["service-orders", { page, status, search }]`
- [ ] Implementar `router.push` para atualizar URL ao mudar de página
- [ ] Implementar reset para página 1 ao aplicar novo filtro
- [ ] Adicionar scroll automático ao topo da tabela ao mudar de página
- [ ] Adicionar skeleton de 20 linhas durante fetch de nova página
- [ ] Exibir texto auxiliar `"Exibindo X–Y de Z ordens de serviço"`
- [ ] Desabilitar botão "Anterior" na página 1 e "Próximo" na última página

---

## Backend

### US-04 — PUT/DELETE no Proxy (Next.js route handler)

- [ ] Implementar `export async function PUT` em `src/app/api/proxy/[...path]/route.ts`
  - Injeta headers `Host`, `Authorization`, `Content-Type`
  - Repassa body JSON do request
  - Retorna status code + body originais do Django
- [ ] Implementar `export async function DELETE` em `src/app/api/proxy/[...path]/route.ts`
  - Injeta headers `Host`, `Authorization`
  - Sem body
  - Retorna 204 para DELETE bem-sucedido
- [ ] Garantir que ambos os métodos retornam 401 se `getServerSession()` retornar null
- [ ] Validar manualmente: `PUT /api/proxy/service-orders/1/` → 200
- [ ] Validar manualmente: `DELETE /api/proxy/service-orders/1/` → 204
- [ ] Validar manualmente: requisição sem token → 401 (sem chegar ao Django)

### Débito Técnico DT-01 — Keycloak Dev Credentials

- [ ] Adicionar verificação em `src/auth.config.ts`: se `NEXTAUTH_DEV_PROVIDERS !== "true"`, não registrar provider `Credentials`
- [ ] Documentar variável `NEXTAUTH_DEV_PROVIDERS` no `CLAUDE.md` e `.env.example`

---

## Infra

- [ ] Adicionar `NEXTAUTH_DEV_PROVIDERS` ao `.env.local.example` com valor `true`
- [ ] Adicionar `SENTRY_DSN` ao `.env.local.example` com valor vazio e comentário explicativo
- [ ] Verificar que `@dnd-kit/*`, `sonner` e `react-error-boundary` estão no `package.json` de `apps/dscar-web`
- [ ] Confirmar que `turbo.json` inclui `build` de `apps/dscar-web` sem cache stale após novas dependências

---

## QA

- [ ] Testar Kanban drag-and-drop em Chrome, Safari e Firefox (desktop)
- [ ] Testar Kanban com teclado (Tab para focar card, Space para iniciar arrasto, setas para mover, Enter para soltar)
- [ ] Testar rollback otimista: simular falha de rede durante drag (DevTools → Network → Offline)
- [ ] Testar Dashboard com backend retornando erro 500 (verificar que cards exibem `"—"` e toast aparece)
- [ ] Testar paginação: navegar para página 2, aplicar filtro, confirmar reset para página 1
- [ ] Testar `apiFetch` com token expirado: confirmar redirect para `/login` com toast
- [ ] Testar `<ErrorBoundary>`: lançar erro manual em componente e verificar fallback
- [ ] Verificar que `make lint` passa sem erros após todas as alterações
- [ ] Verificar que `make typecheck` passa (tsc sem erros, nenhum `any` novo)

---

## Progresso do Sprint

| Área | Total | Concluído | Em Progresso | Bloqueado |
|------|-------|-----------|--------------|-----------|
| Frontend | 38 | 0 | 0 | 0 |
| Backend | 6 | 0 | 0 | 0 |
| Infra | 4 | 0 | 0 | 0 |
| QA | 9 | 0 | 0 | 0 |
| **Total** | **57** | **0** | **0** | **0** |

---

*Atualizado por: PM Agent · Paddock Solutions · 2026-03-29*
