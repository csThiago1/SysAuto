# Sprint 02 — Kanban & Dashboard

**Projeto:** DS Car ERP (grupo-dscar)
**Sprint:** 02
**Período:** Abril 2025
**Status:** Em andamento

---

## Objetivo do Sprint

Com a fundação do ERP entregue no Sprint 01 (autenticação, proxy, CRUD de OS e 5 telas operacionais), o Sprint 02 fecha o loop operacional diário da equipe do DS Car: uma tela Kanban arrastável para movimentação de OS por status, um Dashboard Home com métricas do dia, tratamento global de erros visível ao usuário, e a completude do proxy HTTP (PUT/DELETE) e da paginação de lista — eliminando todos os débitos técnicos de média/alta prioridade herdados do Sprint 01 e colocando o sistema em condição de uso real pela equipe operacional.

---

## User Stories

---

### US-01 — Kanban de OS

**Como** consultor de oficina,
**quero** visualizar as Ordens de Serviço organizadas por status em colunas arrastáveis,
**para que** eu possa mover uma OS de status com drag-and-drop sem precisar abrir o detalhe da OS.

#### Critérios de Aceitação

**Estrutura do board**
- [ ] Tela `/os/kanban` renderiza colunas fixas na ordem: `AGUARDANDO`, `EM_ANDAMENTO`, `AGUARDANDO_PECAS`, `PRONTO`, `ENTREGUE`
- [ ] Cada coluna exibe o nome do status e a contagem de OS (`(n)`) no cabeçalho
- [ ] OS são exibidas como cards com: número da OS, nome do cliente (mascarado LGPD), placa do veículo, consultor responsável e tempo decorrido desde abertura

**Drag-and-drop**
- [ ] Implementado com `@dnd-kit/core` + `@dnd-kit/sortable` (não react-beautiful-dnd)
- [ ] Drag de um card entre colunas dispara `PATCH /api/proxy/service-orders/{id}/` com body `{ "new_status": "<target_column>" }` via `useTransitionStatus`
- [ ] Durante o arrasto, o card original fica com `opacity-50` e um placeholder ocupa o espaço na coluna destino (`DragOverlay`)
- [ ] Se a requisição falhar, o card retorna à coluna original (rollback otimista via TanStack Query `onError`)
- [ ] Reordenação dentro da mesma coluna é permitida (ordenação por `updated_at` persistida localmente via Zustand; não persistida no backend neste sprint)

**Estado e dados**
- [ ] Dados carregados via `useServiceOrders({ page_size: 200 })` — sem paginação no Kanban neste sprint
- [ ] `QueryKey: ["service-orders", "kanban"]` separado da lista paginada
- [ ] Loading state: skeleton de 3 cards por coluna enquanto carrega
- [ ] Hook `useKanbanStore` (Zustand) controla a ordem local dos cards dentro de cada coluna

**Acessibilidade**
- [ ] `@dnd-kit` com suporte a teclado habilitado (`KeyboardSensor`)
- [ ] Cards com `aria-label` incluindo número da OS e status atual

**Navegação**
- [ ] Link "Kanban" adicionado ao `Sidebar` (ícone: `LayoutKanban` do lucide-react)
- [ ] URL `/os/kanban` protegida pelo middleware next-auth

---

### US-02 — Dashboard Home

**Como** gerente do DS Car,
**quero** ver na tela inicial os indicadores do dia (total de OS abertas, entregas previstas para hoje, distribuição por status),
**para que** eu tenha visibilidade operacional imediata ao acessar o sistema.

#### Critérios de Aceitação

**Rota e layout**
- [ ] Tela `/` (home) exibe o Dashboard — rota protegida, redireciona para `/login` se sem sessão
- [ ] Layout com grid responsivo: 2 colunas em mobile, 4 colunas em desktop (Tailwind `grid-cols-2 md:grid-cols-4`)

**Cards de stats**
- [ ] Card "Total Abertas" — soma de OS nos status `AGUARDANDO` + `EM_ANDAMENTO` + `AGUARDANDO_PECAS`
- [ ] Card "Entregas Hoje" — OS com `promised_date` = hoje e status diferente de `ENTREGUE`
- [ ] Card "Prontas para Entrega" — OS com status `PRONTO`
- [ ] Card "Entregues Hoje" — OS com status `ENTREGUE` e `updated_at` = hoje
- [ ] Cada card exibe: ícone (lucide-react), label, valor numérico em destaque, variação em relação ao dia anterior (se disponível no endpoint)

**Fonte de dados**
- [ ] Dados consumidos via `GET /api/proxy/service-orders/dashboard/stats/`
- [ ] Hook `useDashboardStats` com `QueryKey: ["dashboard", "stats"]` e `staleTime: 60_000` (1 minuto)
- [ ] Skeleton loader exibido enquanto `isLoading === true`
- [ ] Em caso de erro, cards exibem `"—"` e toast de erro via `sonner` (integrado na US-03)
- [ ] Botão "Atualizar" com ícone de refresh executa `queryClient.invalidateQueries(["dashboard", "stats"])`

**Tabela de OS recentes**
- [ ] Abaixo dos cards, tabela com as 10 OS mais recentes (campo `updated_at` desc)
- [ ] Colunas: Número, Cliente, Placa, Status (badge colorido), Consultor, Última atualização
- [ ] Link em cada linha navega para `/os/[id]`

---

### US-03 — Tratamento Global de Erros

**Como** usuário do sistema,
**quero** ver notificações claras quando uma ação falha (erro de rede, erro de validação, timeout),
**para que** eu saiba o que aconteceu e possa agir sem ficar em tela branca.

#### Critérios de Aceitação

**Toast via sonner**
- [ ] Pacote `sonner` instalado e `<Toaster />` adicionado ao layout raiz (`src/app/layout.tsx`)
- [ ] Tema configurado com cores DS Car: `error` em `primary-600` (vermelho), `success` em verde `#16a34a`
- [ ] Posição: `top-right`, duração: 5000ms para erros, 3000ms para sucesso

**Integração com apiFetch**
- [ ] `apiFetch` em `src/lib/api.ts` captura erros HTTP e chama `toast.error(message)` automaticamente
- [ ] Mensagem de erro exibe o campo `detail` do Django REST Framework quando disponível; fallback: `"Erro inesperado. Tente novamente."`
- [ ] Erros 401 disparam `signOut()` do next-auth e redirecionam para `/login` com toast `"Sessão expirada"`
- [ ] Erros de rede (fetch throws) exibem: `"Sem conexão com o servidor"`

**Error Boundaries**
- [ ] Componente `<ErrorBoundary>` criado em `src/components/error-boundary.tsx` usando `react-error-boundary`
- [ ] Cada rota de página (`/os`, `/os/kanban`, `/`, `/clientes`) envolvida em `<ErrorBoundary>` + `<Suspense>`
- [ ] Fallback da `<ErrorBoundary>`: card com mensagem, stack trace ocultado em produção, botão "Tentar novamente" chama `resetErrorBoundary`
- [ ] Fallback do `<Suspense>`: componente `<PageSkeleton>` com animação pulse

**Logging**
- [ ] Erros capturados pelo `<ErrorBoundary>` enviados ao Sentry via `Sentry.captureException(error)` (Sentry configurado como débito técnico se `SENTRY_DSN` não estiver presente — degradação silenciosa)

---

### US-04 — PUT/DELETE no Proxy

**Como** desenvolvedor,
**quero** que o proxy Next.js suporte todos os métodos HTTP necessários para CRUD completo,
**para que** o frontend possa atualizar e excluir registros sem bypassar o proxy.

#### Critérios de Aceitação

**Arquivo:** `src/app/api/proxy/[...path]/route.ts`

**Métodos implementados**
- [ ] `export async function PUT(request, context)` — encaminha com body JSON, headers de tenant e Authorization
- [ ] `export async function DELETE(request, context)` — encaminha sem body, headers de tenant e Authorization
- [ ] Comportamento idêntico ao `PATCH` existente: injeta `Host: dscar.localhost`, `Authorization: Bearer <token>`, `Content-Type: application/json`
- [ ] Response retorna o status code original do Django (204 para DELETE bem-sucedido)

**Tratamento de erros no proxy**
- [ ] Se a sessão next-auth não existir, retorna `401 { "detail": "Não autenticado" }`
- [ ] Se o Django retornar erro, o proxy repassa o status code e body intactos (não engole erros)

**Testes manuais**
- [ ] `PUT /api/proxy/service-orders/1/` atualiza OS e retorna 200
- [ ] `DELETE /api/proxy/service-orders/1/` remove OS e retorna 204
- [ ] Requisição sem token retorna 401 do proxy (não chega ao Django)

---

### US-05 — Paginação na Lista de OS

**Como** consultor de oficina,
**quero** navegar entre páginas da lista de OS com controles de anterior/próximo,
**para que** eu possa acessar OS mais antigas sem que a tela carregue centenas de registros de uma vez.

#### Critérios de Aceitação

**Controles de paginação**
- [ ] Componente `<Pagination>` criado em `src/components/ui/pagination.tsx` (shadcn/ui pattern)
- [ ] Exibe: botão "Anterior" (desabilitado na página 1), número da página atual, total de páginas, botão "Próximo" (desabilitado na última página)
- [ ] Texto auxiliar: `"Exibindo 1–20 de 143 ordens de serviço"`

**Estado na URL**
- [ ] Página atual persistida como query param: `/os?page=2`
- [ ] Hook `useServiceOrders` lê `searchParams.get("page")` e passa para a query da API como `?page=<n>&page_size=20`
- [ ] Trocar de página atualiza a URL via `router.push` sem reload completo
- [ ] `QueryKey: ["service-orders", { page, status, search }]` — mudança de página invalida apenas a query da página alvo

**Comportamento**
- [ ] Ao mudar de página, scroll automático para o topo da tabela
- [ ] Loading state: tabela exibe skeleton de 20 linhas durante fetch
- [ ] Filtros de status existentes mantidos ao paginar (query params acumulados)
- [ ] Página 1 ao aplicar um novo filtro (reset automático)

---

## Critérios de Done do Sprint

- [ ] **US-01 Kanban** — board arrastável funcional em `/os/kanban`, transição de status via drag-and-drop persistida no backend
- [ ] **US-02 Dashboard** — tela `/` exibe cards de stats com dados reais de `/dashboard/stats/`
- [ ] **US-03 Erros** — todo erro de API exibe toast via `sonner`; todas as páginas têm `<ErrorBoundary>` + `<Suspense>`
- [ ] **US-04 Proxy** — `PUT` e `DELETE` implementados e testados manualmente no proxy
- [ ] **US-05 Paginação** — lista de OS com controles de página, estado na URL, page_size=20
- [ ] `make lint` e `make typecheck` passando sem erros em `apps/dscar-web/`
- [ ] Nenhum `any` introduzido — TypeScript strict mantido
- [ ] Conventional Commits em todos os commits do sprint
- [ ] Débitos técnicos abaixo marcados como resolvidos ou carregados para Sprint 03

---

## Débitos Técnicos Conhecidos

| # | Item | Descrição | Prioridade | Sprint Alvo |
|---|------|-----------|------------|-------------|
| DT-01 | Keycloak produção | `NEXTAUTH_DEV_PROVIDERS=false` não implementado — Credentials mock pode vazar para staging | Alta | Sprint 02 (parcial: variável deve ser validada no `auth.config.ts`) |
| DT-02 | `KEYCLOAK_CLIENT_SECRET` | Variável vazia no `.env.local`; precisa de secret manager (AWS Secrets Manager) em produção | Alta | Sprint 03 |
| DT-03 | Testes automatizados | Zero testes no frontend (Vitest + Playwright não configurados); backend sem pytest nos endpoints novos | Alta | Sprint 03 |
| DT-04 | Tipagem de rotas Next.js | `href as never` no `<Link>` da Sidebar — substituir por typed routes ou enum de rotas | Média | Sprint 03 |
| DT-05 | Logo DS Car real | `DsCarLogo` usa SVG placeholder — aguardando arte final do cliente | Baixa | A definir |
| DT-06 | Paginação no Kanban | Board carrega até 200 OS sem paginação — limitação aceitável no Sprint 02, mas precisará de virtualização para boards grandes | Média | Sprint 03 |
| DT-07 | Sentry DSN | Integração com Sentry codificada mas `SENTRY_DSN` não configurado — erro silencioso em produção | Alta | Sprint 03 |
| DT-08 | Reordenação de cards no Kanban | Ordem local via Zustand não é persistida no backend — ao recarregar, cards voltam à ordem original | Baixa | Sprint 04 |

---

## Dependências Externas

| Dependência | Pacote | Motivo |
|-------------|--------|--------|
| `@dnd-kit/core` | `^6.x` | Motor de drag-and-drop do Kanban |
| `@dnd-kit/sortable` | `^8.x` | Listas ordenáveis dentro das colunas |
| `@dnd-kit/utilities` | `^3.x` | CSS utilities para transform durante arrasto |
| `sonner` | `^1.x` | Toast notifications |
| `react-error-boundary` | `^4.x` | Error boundaries declarativas |

---

## Referências

- Sprint 01: [`docs/sprint-01-frontend.md`](./sprint-01-frontend.md)
- Proxy reverso: `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`
- Hook de OS: `apps/dscar-web/src/hooks/useServiceOrders.ts`
- Design tokens: `apps/dscar-web/src/lib/design-tokens.ts`
- Endpoint de stats: `backend/core/apps/service_orders/views.py` → `DashboardStatsView`

---

*Paddock Solutions · paddock.solutions · Sprint 02 iniciado em Abril 2025*
