# Backlog — Sprint 03 (Robustez, Filtros e Detalhe de Cliente)

**Projeto:** DS Car ERP
**Sprint:** 03
**Última atualização:** 2026-03-30
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## Frontend

### US-01 — Robustez Global

- [ ] Criar `src/hooks/useDebounce.ts` com hook genérico `useDebounce<T>(value: T, delay: number): T`
- [ ] Remover todas as definições locais de `useDebounce` e substituir pela importação de `src/hooks/useDebounce.ts`
- [ ] Criar/atualizar `src/lib/api.ts` com função `apiFetch(path, init?)` exportada como default
- [ ] Integrar `toast.error()` via `sonner` no `apiFetch` para erros HTTP (mensagem do campo `detail` DRF; fallback genérico)
- [ ] Tratar erro 401 em `apiFetch`: `signOut()` + toast `"Sessão expirada"` + redirect `/login`
- [ ] Tratar erro de rede (fetch throws) em `apiFetch`: toast `"Sem conexão com o servidor"`
- [ ] Migrar todos os hooks (`useServiceOrders`, `useClients`, `useDashboardStats`, etc.) para usar `apiFetch` — eliminar `fetch()` direto nos hooks
- [ ] Criar componente `src/components/ErrorBoundary.tsx` usando `react-error-boundary`
- [ ] Implementar fallback da `<ErrorBoundary>`: mensagem de erro + botão "Tentar novamente" (`resetErrorBoundary`) + stack oculto em produção
- [ ] Adicionar `Sentry.captureException` no `componentDidCatch` com degradação silenciosa se `SENTRY_DSN` ausente
- [ ] Envolver página `/` (dashboard) em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/os` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/os/kanban` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/clientes` em `<ErrorBoundary>` + `<Suspense>`
- [ ] Envolver página `/clientes/[id]` (nova) em `<ErrorBoundary>` + `<Suspense>`

### US-02 — Filtros na Lista de OS

- [ ] Criar componente `<OSFilterBar>` em `src/components/os/OSFilterBar.tsx` com campo de busca por texto e select de status múltiplo
- [ ] Implementar debounce de 400 ms no campo de texto via `useDebounce` (US-01)
- [ ] Implementar badges removíveis para cada status selecionado
- [ ] Implementar botão "Limpar filtros" (visível apenas com filtro ativo)
- [ ] Sincronizar parâmetro `search` na URL via `useSearchParams` + `router.push`
- [ ] Sincronizar parâmetro `status` (multi-valor) na URL via `useSearchParams` + `router.push`
- [ ] Resetar `page` para `1` automaticamente ao alterar `search` ou `status`
- [ ] Atualizar `useServiceOrders` para aceitar `{ page, search, status[] }` e construir query string corretamente
- [ ] Atualizar `QueryKey` para `["service-orders", { page, search, status }]`
- [ ] Exibir skeleton de 20 linhas durante `isFetching` na troca de filtro
- [ ] Exibir mensagem de "sem resultados" quando a API retorna lista vazia
- [ ] Atualizar texto auxiliar da paginação para refletir total filtrado

### US-03 — Detalhe de Cliente

- [ ] Criar hook `useClient(id: string)` em `src/hooks/useClient.ts` com `QueryKey: ["client", id]`
- [ ] Criar hook `useClientOrders(customerId: string)` em `src/hooks/useClientOrders.ts` com `QueryKey: ["service-orders", "by-client", customerId]`
- [ ] Criar página `src/app/clientes/[id]/page.tsx`
- [ ] Implementar seção de dados do cliente: nome, CPF/CNPJ mascarado (LGPD), telefone formatado, e-mail
- [ ] Implementar tabela de histórico de OS (últimas 10, colunas: Número, Data, Placa, Status badge, Consultor, Valor)
- [ ] Adicionar link para `/os/[id]` no número de cada OS da tabela de histórico
- [ ] Implementar skeleton de carregamento (dados + tabela)
- [ ] Implementar mensagem "Nenhuma OS encontrada para este cliente." quando histórico vazio
- [ ] Adicionar botão "Voltar" (`← Clientes`) com `router.back()`
- [ ] Adicionar breadcrumb `Clientes / <Nome do cliente>`
- [ ] Adicionar link para `/clientes/[id]` nas linhas da lista de clientes (`/clientes`)
- [ ] Adicionar link para `/clientes/[id]` nos cards do Kanban (`<KanbanCard>`)
- [ ] Adicionar link para `/clientes/[id]` no detalhe de OS (`/os/[id]`)
- [ ] Resolver DT-04: substituir `href as never` por tipagem correta nos novos links

---

## QA

- [ ] Testar US-01: simular erro 401 em DevTools → confirmar signOut + toast + redirect `/login`
- [ ] Testar US-01: simular Offline em DevTools → confirmar toast "Sem conexão com o servidor"
- [ ] Testar US-01: lançar erro manual em componente filho → confirmar fallback da `<ErrorBoundary>` com botão "Tentar novamente" funcional
- [ ] Testar US-01: confirmar que nenhum `fetch()` direto existe fora de `src/lib/api.ts` (`grep` no CI)
- [ ] Testar US-02: filtrar por placa parcial → URL atualizada → recarregar página restaura filtro
- [ ] Testar US-02: selecionar dois status → URL com dois `status=` → recarregar restaura ambos
- [ ] Testar US-02: clicar "Limpar filtros" → URL limpa → tabela volta ao estado padrão
- [ ] Testar US-02: filtrar em página 3 → `page` resetado para `1` automaticamente
- [ ] Testar US-03: acessar `/clientes/[id]` → CPF/CNPJ mascarado conforme LGPD
- [ ] Testar US-03: histórico de OS exibe até 10 itens com links para `/os/[id]`
- [ ] Testar US-03: links nas listas de clientes, Kanban e detalhe de OS navegam para `/clientes/[id]`
- [ ] Verificar que `make lint` passa sem erros após todas as alterações
- [ ] Verificar que `make typecheck` passa (tsc sem erros, nenhum `any` novo)

---

## Progresso do Sprint

| Área | Total | Concluído | Em Progresso | Bloqueado |
|------|-------|-----------|--------------|-----------|
| Frontend (US-01) | 15 | 0 | 0 | 0 |
| Frontend (US-02) | 12 | 0 | 0 | 0 |
| Frontend (US-03) | 14 | 0 | 0 | 0 |
| QA | 13 | 0 | 0 | 0 |
| **Total** | **54** | **0** | **0** | **0** |

---

*Atualizado por: PM Agent · Paddock Solutions · 2026-03-30*
