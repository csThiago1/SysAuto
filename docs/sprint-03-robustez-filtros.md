# Sprint 03 — Robustez, Filtros e Detalhe de Cliente

**Projeto:** DS Car ERP (grupo-dscar)
**Sprint:** 03
**Período:** Maio 2026
**Status:** Planejado

---

## Objetivo do Sprint

Com o loop operacional básico entregue no Sprint 02 (Kanban, Dashboard, paginação, proxy completo), o Sprint 03 foca em três eixos: (1) robustez global — consolidar utilitários duplicados, fortalecer o tratamento de erros e proteger todas as páginas com Error Boundaries; (2) produtividade operacional — filtros de texto e status na lista de OS com estado na URL; (3) contexto de cliente — tela de detalhe com histórico de OS, fechando o fluxo consultor → OS → cliente.

---

## User Stories

---

### US-01 — Robustez Global

**Como** desenvolvedor,
**quero** ter utilitários e tratamento de erros centralizados e consistentes,
**para que** qualquer nova página herde automaticamente proteção contra falhas de rede, sessão expirada e erros de renderização.

#### Critérios de Aceitação

**`useDebounce` centralizado**
- [ ] Hook `useDebounce<T>(value: T, delay: number): T` criado em `src/hooks/useDebounce.ts`
- [ ] Todas as ocorrências duplicadas do hook substituídas pela importação central
- [ ] Nenhum arquivo fora de `src/hooks/useDebounce.ts` define `useDebounce` localmente
- [ ] Tipagem genérica estrita — sem `any`

**`apiFetch` global (`src/lib/api.ts`)**
- [ ] Função `apiFetch(path: string, init?: RequestInit): Promise<Response>` exportada como default
- [ ] Erros HTTP capturados: chama `toast.error(message)` via `sonner`; mensagem usa campo `detail` do DRF quando presente, fallback `"Erro inesperado. Tente novamente."`
- [ ] Erro 401: chama `signOut()` do next-auth + toast `"Sessão expirada"` + redirect `/login`
- [ ] Erro de rede (fetch throws): toast `"Sem conexão com o servidor"`
- [ ] Todos os hooks (`useServiceOrders`, `useClients`, `useDashboardStats`, etc.) migrados para usar `apiFetch` — nenhum `fetch()` direto fora de `api.ts`

**`ErrorBoundary` (`src/components/ErrorBoundary.tsx`)**
- [ ] Componente criado usando `react-error-boundary` (pacote já listado como dependência do Sprint 02)
- [ ] Fallback: card com título "Algo deu errado", mensagem de erro (stack oculto em `NODE_ENV === "production"`), botão "Tentar novamente" que chama `resetErrorBoundary`
- [ ] Em `componentDidCatch`: `Sentry.captureException(error)` com degradação silenciosa se `SENTRY_DSN` ausente
- [ ] Páginas `/`, `/os`, `/os/kanban`, `/clientes` e `/clientes/[id]` (nova — US-03) envolvidas em `<ErrorBoundary>` + `<Suspense>`
- [ ] Fallback do `<Suspense>`: `<PageSkeleton />` (já existente do Sprint 02)

#### Definição de Done

- `make lint` e `make typecheck` passando após remoção dos `useDebounce` duplicados
- Nenhum `fetch()` direto fora de `src/lib/api.ts` (verificado via `grep -r "fetch(" src/hooks src/app --include="*.ts" --include="*.tsx"`)
- Simulação de erro 401 em DevTools → confirma signOut + redirect + toast
- Simulação de erro de rede (DevTools → Offline) → confirma toast "Sem conexão"
- Lançar erro manual em componente filho → confirma fallback da ErrorBoundary com botão funcional

---

### US-02 — Filtros na Lista de OS

**Como** consultor de oficina,
**quero** filtrar a lista de OS por texto livre (placa ou cliente) e por um ou mais status,
**para que** eu localize rapidamente uma OS específica sem precisar paginar manualmente.

#### Critérios de Aceitação

**Barra de filtros**
- [ ] Barra de filtros renderizada acima da tabela, dentro do layout da página `/os`
- [ ] Campo de busca por texto: placeholder `"Buscar por placa ou cliente…"`, `debounce` de 400 ms via `useDebounce`
- [ ] Select de status com suporte a múltipla seleção; opções: `AGUARDANDO`, `EM_ANDAMENTO`, `AGUARDANDO_PECAS`, `PRONTO`, `ENTREGUE`; cada status selecionado exibe um badge colorido e removível
- [ ] Botão "Limpar filtros" visível apenas quando há filtro ativo; ao clicar, reseta texto e status e atualiza a URL

**Sincronização com URL via `useSearchParams`**
- [ ] Parâmetro `search` na URL: `/os?search=ABC-1234`
- [ ] Parâmetro `status` na URL (multi-valor): `/os?status=AGUARDANDO&status=PRONTO`
- [ ] Parâmetro `page` resetado para `1` sempre que `search` ou `status` muda
- [ ] URL pode ser copiada e colada — filtros são restaurados ao carregar a página

**Query e skeleton**
- [ ] `useServiceOrders` atualizado para aceitar `{ page, search, status[] }` e construir query string corretamente
- [ ] `QueryKey: ["service-orders", { page, search, status }]`
- [ ] Durante troca de filtro (enquanto nova query está em `isFetching`): tabela exibe skeleton de 20 linhas no lugar dos dados anteriores
- [ ] Sem resultados: mensagem `"Nenhuma OS encontrada para os filtros aplicados."` centralizada na área da tabela

**Integração com paginação existente**
- [ ] Componente `<Pagination>` (Sprint 02) mantido e funcional com os novos filtros
- [ ] Texto auxiliar atualizado para refletir total filtrado: `"Exibindo 1–20 de 12 ordens de serviço"`

#### Definição de Done

- Filtrar por placa parcial retorna resultados corretos e URL contém `search=<valor>`
- Selecionar dois status → URL contém dois `status=` → recarregar página restaura filtros
- Limpar filtros → URL limpa → tabela volta ao estado padrão (página 1, todos os status)
- Aplicar filtro em página 3 → `page` resetado para 1 automaticamente
- `make typecheck` sem erros novos

---

### US-03 — Detalhe de Cliente

**Como** consultor de oficina,
**quero** acessar o detalhe de um cliente para ver seus dados e histórico de OS,
**para que** eu possa contextualizar um novo atendimento sem sair do sistema.

#### Critérios de Aceitação

**Rota e acesso**
- [ ] Página criada em `src/app/clientes/[id]/page.tsx`
- [ ] Rota protegida pelo middleware next-auth; redireciona para `/login` sem sessão
- [ ] Link nas linhas da lista de clientes (`/clientes`) navega para `/clientes/[id]`
- [ ] Link nos cards do Kanban (`<KanbanCard>`) e nas linhas do detalhe de OS (`/os/[id]`) navega para `/clientes/[id]`

**Dados do cliente**
- [ ] Seção de cabeçalho com: nome completo, CPF/CNPJ mascarado (LGPD: exibe `***.***.***-**` para CPF, `**.***.***/****-**` para CNPJ), telefone formatado, e-mail
- [ ] Dados carregados via `GET /api/proxy/customers/{id}/`
- [ ] Hook `useClient(id: string)` criado em `src/hooks/useClient.ts` com `QueryKey: ["client", id]`
- [ ] Skeleton enquanto carrega (3 linhas de dados + tabela)
- [ ] Estado de erro: fallback da `<ErrorBoundary>` (US-01)

**Histórico de OS**
- [ ] Tabela abaixo dos dados com as últimas 10 OS do cliente, ordenadas por `created_at` desc
- [ ] Colunas: Número, Data de abertura, Placa, Status (badge colorido), Consultor, Valor total
- [ ] Dados carregados via `GET /api/proxy/service-orders/?customer={id}&page_size=10&ordering=-created_at`
- [ ] Hook `useClientOrders(customerId: string)` criado em `src/hooks/useClientOrders.ts` com `QueryKey: ["service-orders", "by-client", customerId]`
- [ ] Cada linha tem link para `/os/[id]` no número da OS
- [ ] Sem histórico: mensagem `"Nenhuma OS encontrada para este cliente."`

**Navegação**
- [ ] Botão "Voltar" (`← Clientes`) no topo da página, navega para `/clientes` via `router.back()`
- [ ] Breadcrumb: `Clientes / <Nome do cliente>`

#### Definição de Done

- Acessar `/clientes/[id]` exibe dados reais do cliente com CPF/CNPJ mascarado
- Tabela de histórico exibe até 10 OS com links funcionais para `/os/[id]`
- Links nas listas de clientes, cards do Kanban e detalhe de OS navegam corretamente para `/clientes/[id]`
- `<ErrorBoundary>` envolvendo a página — erro de API exibe fallback com botão "Tentar novamente"
- `make lint` e `make typecheck` passando sem erros

---

## Critérios de Done do Sprint

- [ ] **US-01 Robustez** — `useDebounce` centralizado; `apiFetch` com 401/rede; `<ErrorBoundary>` em todas as páginas
- [ ] **US-02 Filtros** — busca por texto + select de status múltiplo; estado na URL; skeleton durante fetch
- [ ] **US-03 Detalhe de cliente** — `/clientes/[id]` com dados mascarados e histórico de OS; links nas listas e cards
- [ ] `make lint` e `make typecheck` passando sem erros em `apps/dscar-web/`
- [ ] Nenhum `any` introduzido — TypeScript strict mantido
- [ ] Nenhum `fetch()` direto fora de `src/lib/api.ts`
- [ ] Conventional Commits em todos os commits do sprint

---

## Débitos Técnicos Relacionados

| # | Item | Ação no Sprint 03 |
|---|------|-------------------|
| DT-02 | `KEYCLOAK_CLIENT_SECRET` | Fora do escopo — carregado para Sprint 04 |
| DT-03 | Testes automatizados | Fora do escopo — carregado para Sprint 04 |
| DT-04 | Tipagem de rotas Next.js | Resolver ao criar links para `/clientes/[id]` |
| DT-07 | Sentry DSN | Coberto pela US-01 (`ErrorBoundary` com degradação silenciosa) |

---

## Referências

- Sprint 01: [`docs/sprint-01-frontend.md`](./sprint-01-frontend.md)
- Sprint 02: [`docs/sprint-02-kanban-dashboard.md`](./sprint-02-kanban-dashboard.md)
- Proxy: `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`
- Hook de OS: `apps/dscar-web/src/hooks/useServiceOrders.ts`
- Página de clientes: `apps/dscar-web/src/app/clientes/page.tsx`
- Endpoint clientes: `backend/core/apps/customers/views.py`

---

*Paddock Solutions · paddock.solutions · Sprint 03 planejado em 2026-03-30*
