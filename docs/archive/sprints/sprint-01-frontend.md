# Sprint 01 — DS Car ERP Frontend

**Projeto:** DS Car ERP (grupo-dscar)
**Sprint:** 01
**Período:** Março 2025
**Status:** Concluído

---

## Resumo do Sprint

Fundação completa do ERP DS Car: backend Django com endpoints de OS e Clientes funcionais, e frontend Next.js 15 com autenticação, proxy reverso e cinco telas operacionais. O sistema vai do login ao CRUD de Ordens de Serviço com transição de status, usando design system com identidade visual DS Car.

---

## Entregues

### Backend (Django 5 · `/backend/core/`)

| Módulo | Arquivo | O que foi construído |
|--------|---------|----------------------|
| Service Orders | `apps/service_orders/serializers.py` | ServiceOrder CRUD completo + campo `new_status` para transição de status |
| Service Orders | `apps/service_orders/views.py` | ViewSet completo + endpoint `/dashboard/stats/` (totais por status, entregas do dia) |
| Service Orders | `apps/service_orders/urls.py` | Rotas registradas no roteador DRF |
| Customers | `apps/customers/serializers.py` | List e Retrieve com campos pessoais mascarados (LGPD) |
| Customers | `apps/customers/views.py` + `urls.py` | ViewSet somente leitura + rotas registradas |

### Frontend (Next.js 15 · `apps/dscar-web/`)

| Área | O que foi construído |
|------|----------------------|
| Autenticação | next-auth v5 com dois provedores: Keycloak (OIDC) e Credentials mock para desenvolvimento |
| Proxy reverso | `src/app/api/proxy/[...path]/route.ts` — encaminha requisições do frontend para Django com `Host: dscar.localhost` e `Authorization: Bearer` |
| Tela Login | `/login` — formulário com identidade DS Car, suporte a dev credentials |
| Tela Lista OS | `/os` — tabela paginada com filtros de status, usa `useServiceOrders` |
| Tela Criação OS | `/os/nova` — formulário com React Hook Form + Zod |
| Tela Detalhe OS | `/os/[id]` — visualização completa + botão de transição de status |
| Tela Clientes | `/clientes` — listagem com dados LGPD mascarados |
| Design System | Paleta DS Car: vermelho (`primary-600`), preto profundo (`secondary-950`), cinza metálico; design tokens em `src/lib/design-tokens.ts` |
| Estado | TanStack Query v5 (server state) + Zustand v5 (UI state, ex: sidebar colapsada) |
| Componentes UI | `Sidebar`, `AppHeader`, `DsCarLogo` (placeholder SVG) + 9 primitivas shadcn/ui |
| Helper de fetch | `apiFetch` com verificação `res.ok` e lançamento de erro tipado |
| Middleware | Proteção de rotas — redireciona para `/login` se sem sessão |

---

## Decisões Tecnicas (ADRs)

### ADR-01 — Proxy Next.js em vez de acesso direto ao Django

**Contexto:** O Django usa `django-tenants` com schema-per-tenant roteado pelo header `Host`. O frontend precisa enviar `Host: dscar.localhost` para acessar o tenant correto.

**Decisao:** Criar `/api/proxy/[...path]` no Next.js que injeta o header `Host` e o `Authorization: Bearer` em todas as requisicoes ao backend.

**Consequencias positivas:**
- Frontend nunca expõe o token JWT ao browser diretamente
- Ponto único para adicionar headers globais (tenant, version, trace-id)
- Permite rodar frontend em `localhost:3001` sem CORS

**Consequencias negativas:**
- Latência extra de um hop interno (aceitável em dev/staging)
- Em produção, Nginx fará esse papel — o proxy Next.js é apenas para ambiente local

---

### ADR-02 — Dev Credentials para desenvolvimento sem Keycloak

**Contexto:** Keycloak em produção exige configuração de realm, client, certificados e redirect URIs. Em desenvolvimento solo, esse overhead atrasa a iteração de UI.

**Decisao:** next-auth v5 com dois provedores simultâneos:
1. `Keycloak` — usado em staging e produção
2. `Credentials` (id: `dev-credentials`) — mock com senha fixa `paddock123`, gera token `dev-mock-token`

**Consequencias:** Iteração local sem infraestrutura de SSO. O token mock é aceito pelo proxy, que o encaminha ao Django — o Django em dev pode usar `DJANGO_DEV_BYPASS_AUTH=true` para ignorar validação JWT.

**Risco:** As dev credentials NUNCA devem chegar a produção. Mitigação: variável `NEXTAUTH_DEV_PROVIDERS=false` desabilita o provider Credentials em ambientes não-locais (débito técnico — ver abaixo).

---

### ADR-03 — TanStack Query para estado de servidor + Zustand para UI

**Contexto:** O app tem dois tipos de estado: dados remotos (OS, clientes) que precisam de cache, refetch e invalidação; e estado local de UI (sidebar colapsada, modais abertos) que não precisa persistir no servidor.

**Decisao:** TanStack Query v5 para tudo que vem da API. Zustand v5 para estado puro de UI.

**Consequencias:** Queries são invalidadas automaticamente após mutações (ex: transição de status invalida `["service-orders", id]` e `["service-orders"]`). Estado de UI é síncrono e sem boilerplate.

---

### ADR-04 — shadcn/ui como base de componentes

**Contexto:** Precisamos de componentes acessíveis (Radix UI) com estilo customizável via Tailwind, sem dependência de biblioteca proprietária.

**Decisao:** shadcn/ui copiado para `src/components/ui/` — os componentes são código próprio, não uma dependência.

**Consequencias:** Total controle sobre estilo e comportamento. Os tokens de design DS Car são aplicados diretamente via classes Tailwind definidas em `tailwind.config.ts`.

---

## Bugs Encontrados e Corrigidos (QA)

| # | Componente | Descricao | Severidade | Status |
|---|------------|-----------|------------|--------|
| Bug #2 | `Sidebar.tsx` | Prop `href` dos itens de navegacao com tipagem TypeScript incorreta — `href` nao aceitava strings literais de rota | Media | Corrigido — cast `as never` na prop do `<Link>` como workaround; tipagem adequada e débito técnico registrado |
| Bug #3 | `useServiceOrders.ts` | Transicao de status enviava campo `status` no body, mas o serializer Django esperava `new_status` | Alta | Corrigido — body agora envia `{ new_status: status }` |
| Bug #4 | `Sidebar.tsx` | Item de menu "Ordens de Servico" aparecia duplicado na lista de navegacao | Media | Corrigido — array `navItems` tinha entrada duplicada, removida |
| Bug #5 | `useServiceOrders.ts`, `useCustomers.ts` | Nenhum hook verificava `res.ok` — erros HTTP 4xx/5xx retornavam silenciosamente como dados vazios | Alta | Corrigido — helper `apiFetch` centraliza verificacao de status e lanca `Error` com `detail` do Django |

---

## Debito Tecnico

| Item | Descricao | Prioridade | Sprint Alvo |
|------|-----------|------------|-------------|
| Keycloak em producao | Provider Credentials nao deve existir em producao; `NEXTAUTH_DEV_PROVIDERS` ainda nao implementada | Alta | Sprint 02 |
| Tipagem de rotas Next.js | `href as never` no `<Link>` e workaround de tipagem — substituir por `typed-routes` do Next.js ou enum de rotas | Media | Sprint 02 |
| Testes automatizados | Zero testes no frontend (Vitest + Playwright nao configurados). Backend sem pytest para os endpoints novos | Alta | Sprint 03 |
| `PATCH` unico no proxy | Proxy implementa GET, POST e PATCH — falta `PUT` e `DELETE` para CRUD completo de OS | Media | Sprint 02 |
| Logo DS Car real | `DsCarLogo` usa SVG placeholder. Logo oficial precisa ser fornecida pelo cliente | Baixa | A definir |
| Dashboard stats na home | Endpoint `/dashboard/stats/` existe no backend mas nenhuma tela consome os dados ainda | Media | Sprint 02 |
| Paginacao no frontend | Lista de OS usa `PaginatedResponse<T>` do tipo, mas a UI nao renderiza controles de pagina | Media | Sprint 02 |
| Tratamento de erro global | `apiFetch` lanca erros mas a UI nao tem toast/boundary padrao para erros de rede | Media | Sprint 02 |
| Variavel `KEYCLOAK_CLIENT_SECRET` | Atualmente vazia no `.env.local` — deve ser preenchida e gerenciada via secret manager em producao | Alta | Sprint 02 |

---

## Proximo Sprint (Sprint 02 — Sugestao)

Com a fundacao construida, o Sprint 02 deve completar o loop operacional de Ordens de Servico e preparar o ambiente para staging.

### Funcionalidades sugeridas

1. **Kanban de OS** — visualizacao por status em colunas arrastáveis (drag-and-drop) com `@dnd-kit`. É a tela mais usada pela equipe operacional do DS Car.

2. **Dashboard Home com stats** — consumir o endpoint `/dashboard/stats/` e exibir cards de totais (abertas, em andamento, entregas do dia).

3. **Paginacao e filtros avancados na lista de OS** — controles de pagina, filtro por data, placa, status e consultor.

4. **Tratamento global de erros** — toast de erro via `sonner` integrado ao `apiFetch`; boundary de carregamento com `<Suspense>`.

5. **Configuracao do Keycloak local** — subir realm `paddock` via `docker-compose.dev.yml`, registrar client `paddock-frontend`, testar fluxo OIDC completo.

6. **Testes basicos** — configurar Vitest, escrever testes unitarios para `apiFetch`, `useServiceOrders` e componentes criticos.

### Criterios de saida do Sprint 02

- [ ] Kanban operacional com transicao de status por drag-and-drop
- [ ] Dashboard com metricas do dia na home
- [ ] Keycloak rodando localmente e autenticacao OIDC funcional
- [ ] `make test-web` passando com cobertura basica

---

*Paddock Solutions · paddock.solutions · Sprint 01 concluido em Marco 2025*
