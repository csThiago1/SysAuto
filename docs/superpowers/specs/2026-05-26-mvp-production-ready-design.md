# MVP Production Ready — DS Car ERP

> **Objetivo:** Entregar um MVP funcional para validacao pelo cliente (DS Car), rodando em paralelo com o sistema legado (Box Empresa).
>
> **Versao:** 1.0 · **Data:** 2026-05-26 · **Autor:** Paddock Solutions

---

## 1. Contexto e premissas

### 1.1 Situacao atual

- Backend Django 5 + DRF funcional com ~15 apps Django
- Frontend Next.js 15 com ~20 paginas de cadastro/OS/compras/fiscal
- Mobile React Native + Expo com apontamento, vistoria, fotos
- Auth via Keycloak (dev-credentials em dev, SSO em prod) — complexo demais para MVP
- `apps/hub/` e um placeholder sem funcionalidade — peso morto no bundle
- Git sem estrategia de branches (branches espalhadas: codex/, feat/, feature/, ciclo-, worktree-)
- Cadastro de servicos e pecas com CRUD incompleto no frontend
- API de placas com error handling fragil
- Importacao Cilia/XML IFX funcional, Soma/HDI nao implementados

### 1.2 Premissas do MVP

- Coexistencia com legado — DS Car valida o novo sistema sem desligar o antigo
- Soma/HDI ficam fora do MVP (baixo volume: alguns/mes e 1-2/mes respectivamente)
- `apps/hub/` sera deletado — dscar-web e o ponto de entrada unico
- Auth nativo substitui Keycloak — simplifica stack e deployment
- RBAC configuravel por tenant — 5 roles fixos + matriz de permissoes por feature

### 1.3 Definicao de "pronto"

O MVP esta pronto quando:
1. Cliente consegue logar com email/senha (sem Keycloak)
2. Admin consegue configurar permissoes por role
3. Fluxo OS completo funciona (abertura → entrega → faturamento)
4. Cadastros de servicos, pecas, materiais, insumos tem CRUD funcional
5. Importacao Cilia + XML IFX funciona com validacoes corrigidas
6. API de placas funciona com error handling robusto
7. App abre rapido (bundle otimizado, sem hub)
8. Testes E2E cobrem fluxos criticos
9. Sentry monitorando erros em tempo real

---

## 2. Git Branching Strategy

### 2.1 Modelo: Git Flow simplificado

```
main          <- producao (sempre deployavel)
  ^
staging       <- pre-prod, testes de integracao, QA do cliente
  ^
develop       <- integracao continua de features
  ^
feat/*        <- branches de feature (ex: feat/auth-nativo)
fix/*         <- hotfixes
```

### 2.2 Regras

| Acao | De | Para | Metodo |
|------|-----|------|--------|
| Feature pronta | `feat/*` | `develop` | PR com review |
| Batch pronto pra QA | `develop` | `staging` | PR (pode ser fast-forward) |
| Cliente validou | `staging` | `main` | PR com approval |
| Hotfix producao | `fix/*` | `main` | PR urgente + cherry-pick pra `develop` |

### 2.3 Convencoes

- Branch naming: `feat/auth-nativo`, `feat/rbac-configuravel`, `fix/plate-api-error-handling`
- Commits: Conventional Commits (ja em uso) — `feat:`, `fix:`, `refactor:`, `chore:`, `test:`
- Squash merge em PRs de feature para historico limpo
- Delete branch apos merge

### 2.4 Setup inicial

1. Merge trabalho valido da branch atual (`codex/sprint-0-baseline`) para `main`
2. Criar `develop` a partir de `main`
3. Criar `staging` a partir de `main`
4. Limpar branches obsoletas (`codex/`, `ciclo-*`, `worktree-*`) apos verificar que nao tem trabalho perdido
5. Cada workstream do MVP vira um `feat/*` a partir de `develop`

---

## 3. Auth Nativo (Drop Keycloak)

### 3.1 Decisao

Remover Keycloak da stack. Auth gerenciado inteiramente pelo Django + next-auth CredentialsProvider.

### 3.2 Backend — Novos endpoints

**App:** `apps/authentication/`

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/v1/auth/login/` | POST | Email + senha → JWT (access + refresh) |
| `/api/v1/auth/register/` | POST | Criar conta (admin convida, nao e self-service) |
| `/api/v1/auth/forgot-password/` | POST | Envia email com token de reset |
| `/api/v1/auth/reset-password/` | POST | Token + nova senha → atualiza |
| `/api/v1/auth/verify-email/` | POST | Token de confirmacao → ativa conta |
| `/api/v1/auth/refresh/` | POST | Refresh token → novo access token |
| `/api/v1/auth/me/` | GET | Dados do usuario autenticado |

**JWT:**
- Algoritmo: RS256 (par de chaves gerado no Django, armazenado em env vars)
- Access token: 15 min TTL
- Refresh token: 7 dias TTL com rotacao (cada uso gera novo refresh)
- Claims mantêm estrutura atual: `sub`, `email`, `role`, `companies`, `active_company`, `tenant_schema`, `client_slug`, `permissions`

**Email:**
- Provider: Resend (ja na stack)
- Templates: esqueci senha, confirmacao de cadastro, convite de usuario
- Links apontam para dscar-web (nao mais Keycloak)

**Seguranca:**
- Rate limiting: 5 tentativas/minuto por IP no login (DRF throttle)
- Password: minimo 8 chars, validacao Django default (CommonPasswordValidator, MinimumLengthValidator)
- Refresh token rotation: token antigo invalidado apos uso
- Registro nao e self-service — ADMIN/OWNER cria usuario via convite

### 3.3 Frontend — dscar-web

**Paginas:**

| Rota | Descricao |
|------|-----------|
| `/login` | Email + senha (manter layout atual, remover botao Keycloak) |
| `/esqueci-senha` | Formulario email → envia link de reset |
| `/redefinir-senha/[token]` | Nova senha + confirmacao |
| `/confirmar-email/[token]` | Ativa conta apos convite |

**next-auth config (`lib/auth.ts`):**
- Manter CredentialsProvider, apontar para `/api/v1/auth/login/`
- Remover KeycloakProvider
- JWT callback: extrair claims do response Django
- Session callback: expor role, permissions, companies no client

### 3.4 Mobile

- Remover `expo-auth-session` (OIDC)
- Login direto via `POST /api/v1/auth/login/`
- Tokens em SecureStore (expo-secure-store)
- Refresh automatico via interceptor no httpClient

### 3.5 O que deletar

| Item | Acao |
|------|------|
| `apps/hub/` | Deletar diretorio inteiro |
| `turbo.json` | Remover hub dos pipelines |
| `package.json` (root) | Remover hub dos workspaces |
| `mozilla-django-oidc` | Remover do requirements + settings |
| `KeycloakJWTAuthentication` | Remover classe + refs |
| `infra/docker/keycloak/` | Deletar tudo (themes, config) |
| `docker-compose.*.yml` | Remover servico keycloak |
| Env vars Keycloak | Remover de todos os .env |

---

## 4. RBAC Configuravel

### 4.1 Modelo

5 roles fixos com hierarquia preservada:
```
OWNER (5) > ADMIN (4) > MANAGER (3) > CONSULTANT (2) > STOREKEEPER (1)
```

Cada tenant pode customizar quais permissoes cada role tem, via matriz editavel.

### 4.2 Permissoes granulares

~20 permission codes cobrindo os modulos MVP:

**OS:**
- `os.view` — Ver lista e detalhe de OS
- `os.create` — Criar nova OS
- `os.edit` — Editar OS existente
- `os.transition` — Avancar/retroceder status
- `os.billing` — Faturar OS (emitir NF)
- `os.delete` — Cancelar OS

**Cadastros:**
- `cadastros.view` — Ver pessoas, seguradoras, etc
- `cadastros.edit` — Criar/editar cadastros
- `cadastros.catalog` — Gerenciar catalogo (servicos, pecas, materiais)

**Compras/Estoque:**
- `compras.view` — Ver pedidos e cotacoes
- `compras.create` — Criar pedidos de compra
- `compras.approve` — Aprovar OC
- `estoque.view` — Ver estoque
- `estoque.move` — Dar entrada/saida

**Financeiro/Fiscal:**
- `financeiro.view` — Ver contas a pagar/receber
- `financeiro.edit` — Registrar pagamentos/recebimentos
- `fiscal.view` — Ver notas fiscais
- `fiscal.emit` — Emitir NF-e/NFS-e/NFC-e

**Admin:**
- `admin.users` — Gerenciar usuarios do tenant
- `admin.permissions` — Configurar matriz de permissoes
- `admin.settings` — Configuracoes do tenant

### 4.3 Backend

**Novo model:**

```python
class TenantPermissionOverride(TenantAwareModel):
    """Override de permissao padrao por role para este tenant."""
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    permission_code = models.CharField(max_length=50)
    allowed = models.BooleanField()

    class Meta:
        unique_together = ('tenant', 'role', 'permission_code')
```

**Defaults:**
- Cada role tem um set de permissoes padrao (hardcoded)
- `TenantPermissionOverride` altera o default (allow ou deny)
- OWNER sempre tem todas as permissoes (nao pode ser overridden)

**Enforcement:**

```python
# Decorator para ViewSets
@has_permission("os.billing")
def faturar(self, request, pk=None):
    ...

# Ou via mixin
class PermissionMixin:
    required_permission = None

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.required_permission:
            check_tenant_permission(request, self.required_permission)
```

**Endpoints:**

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/v1/permissions/matrix/` | GET | Retorna matriz completa (defaults + overrides) |
| `/api/v1/permissions/matrix/` | PUT | Salva overrides (body: lista de {role, permission_code, allowed}) |
| `/api/v1/permissions/my/` | GET | Permissoes do usuario autenticado (role + overrides aplicados) |

### 4.4 Frontend

**Tela admin (`/configuracoes/permissoes`):**
- Tabela: roles nas colunas, permissoes agrupadas por modulo nas linhas
- Toggle switch em cada celula
- OWNER coluna desabilitada (sempre tudo permitido)
- Somente ADMIN/OWNER acessa

**Hook:**
```typescript
// usePermission.ts
function usePermission(code: string): boolean
// Usa session.permissions (array de codes permitidos)
```

**Uso nos componentes:**
```tsx
const canBill = usePermission("os.billing");
// Esconde botao se nao tem permissao
{canBill && <Button onClick={handleBilling}>Faturar</Button>}
```

**Middleware (middleware.ts):**
- Rotas protegidas por permissao (ex: `/financeiro` requer `financeiro.view`)
- Usa session + permissoes cacheadas

### 4.5 JWT — novo claim `permissions`

O access token inclui array de permission codes do usuario:
```json
{
  "sub": "uuid",
  "role": "CONSULTANT",
  "permissions": ["os.view", "os.create", "os.edit", "cadastros.view"],
  ...
}
```

Isso evita lookup no banco a cada request — permissoes viajam no token.
Ao alterar a matriz, tokens existentes expiram em ate 15 min (access token TTL).

---

## 5. Cleanup Hub + Performance

### 5.1 Deletar hub

Remover `apps/hub/` e todas as referencias:
- `turbo.json` pipelines
- `package.json` workspaces
- CI/CD (se houver)
- Docs que referenciam hub

### 5.2 Bundle analysis

1. Instalar `@next/bundle-analyzer` em dscar-web
2. Gerar report: `ANALYZE=true pnpm build`
3. Identificar top 10 maiores chunks

### 5.3 Otimizacoes esperadas

- **Lazy loading de paginas:** dynamic import para rotas pesadas (fiscal, compras, dashboard)
- **Dynamic imports de componentes:** modais grandes, editores, tabelas complexas
- **Verificar dependencias duplicadas:** se packages/ui e dscar-web importam versoes diferentes de libs
- **Tree shaking:** verificar se barrel exports (index.ts) estao puxando modulos desnecessarios
- **Image optimization:** verificar se next/image esta sendo usado corretamente
- **Remover dependencias nao usadas:** auditoria com depcheck

### 5.4 Meta

Reducao mensuravel no tempo de First Contentful Paint (FCP). Baseline sera medido antes das otimizacoes com Lighthouse.

---

## 6. CRUD Completo — Cadastros Catalogo

### 6.1 Servicos (prioridade — hoje read-only)

**Pagina:** `/cadastros/catalogo/servicos`

**Adicionar:**
- Botao "Novo Servico" no header
- Sheet form com campos: codigo, nome, categoria (select das categorias existentes), unidade (select), descricao, aplica_multiplicador_tamanho (checkbox), is_active (checkbox)
- Botao editar em cada linha da tabela
- Botao desativar/reativar em cada linha
- Usar hooks `useCreateServicoCanonico`, `useUpdateServicoCanonico` (ja existem ou criar)
- Mesmo padrao visual de pecas (Sheet + form + validacao Zod)

**Backend:** Ja pronto — `ServicoCanonicoViewSet` com CREATE, UPDATE, DELETE.

### 6.2 Pecas

**Pagina:** `/cadastros/catalogo/pecas`

**Adicionar:**
- Botao desativar/reativar (soft delete via `is_active=false`)
- Filtro ativo/inativo (toggle ou select)
- Confirmacao antes de desativar ("Tem certeza? Peca nao aparecera em novos orcamentos")

**Backend:** Ja pronto.

### 6.3 Materiais

**Pagina:** `/cadastros/catalogo/materiais`

**Adicionar:**
- Botao "Novo Material" + Sheet form: codigo, nome, unidade_base (select), tipo (consumivel/ferramenta), is_active
- Edit em cada linha
- Desativar/reativar

**Backend:** Ja pronto — `MaterialCanonicoViewSet`.

### 6.4 Insumos

**Pagina:** `/cadastros/catalogo/insumos`

**Adicionar:**
- Botao "Novo Insumo" + Sheet form: material (select), descricao, marca, gtin_ean, fator_conversao, is_active
- Edit em cada linha
- Desativar/reativar
- Validacao GTIN (13 ou 14 digitos)

**Backend:** Ja pronto — `InsumoMaterialViewSet`.

### 6.5 Categorias Mao-de-Obra

**Pagina:** `/cadastros/catalogo/categorias-mao-obra`

**Adicionar:**
- CRUD basico: nome, valor_hora_padrao, is_active
- Mesmo padrao de Sheet form

**Backend:** Ja pronto.

### 6.6 Padrao compartilhado

Todas as paginas seguem o mesmo padrao:
1. Tabela com busca
2. Botao "Novo X" no header abre Sheet lateral
3. Botao edit em cada linha abre Sheet com dados preenchidos
4. Botao desativar com confirmacao
5. Filtro ativo/inativo
6. Toast de sucesso/erro

---

## 7. API de Placas — Fixes

### 7.1 VehicleService (backend/core/apps/vehicles/services.py)

**Correcoes:**
1. Trocar broad `except Exception` por catches especificos: `httpx.HTTPStatusError`, `httpx.TimeoutException`, `httpx.ConnectError`, `json.JSONDecodeError`
2. Log do status code HTTP antes de swallow: `logger.warning("API placa %s retornou HTTP %d", plate[:3], response.status_code)`
3. Rate limit handling: detectar 429, cachear falha por 60s (nao re-tentar)
4. Timeout explicito: usar `APIPLACAS_TIMEOUT` setting consistentemente

### 7.2 Vehicle Catalog Views (backend/core/apps/vehicle_catalog/views.py)

**Correcoes:**
1. Validacao de JSON response: `if not isinstance(data, dict): return 502`
2. Validacao de chassis: 17 chars alfanumericos (regex `^[A-Z0-9]{17}$`) — rejeitar parcialmente mascarados
3. Year parsing robusto: `re.search(r'\d{4}', str(value))` em vez de split("/")
4. Cache completeness: nao cachear respostas sem make/model

### 7.3 Frontend proxy (apps/dscar-web/src/app/api/plate/[plate]/route.ts)

- Sem mudancas necessarias — ja normaliza, valida e tem timeout.

---

## 8. Validacao Importacao (Cilia + XML IFX)

### 8.1 Insurer mapping dinamico

**Antes:** Hardcoded em `INSURER_TRADE_TO_CODE` (10 entries no cilia_parser.py)

**Depois:** Campo `trade_names: ArrayField(CharField)` no model `Insurer`
- Parser consulta `Insurer.objects.filter(trade_names__contains=[trade])`
- Fallback pro mapping hardcoded (retrocompatibilidade)
- Admin pode adicionar aliases via cadastro de seguradoras

### 8.2 Validacoes adicionadas

| Campo | Validacao | Comportamento se invalido |
|-------|-----------|--------------------------|
| `vehicle_year` | Range 1900-2100 | Warning log + aceita None |
| `segurado_phone` | Regex digits, min 10 max 11 | Warning log + armazena raw |
| `discount_pct` | Range 0-100 | Clamp + warning log |
| Decimal parse | `_dec()` retorna 0 | Warning log (nao mais silencioso) |
| `external_version_id` | Positivo ou None | Warning log + aceita None |

### 8.3 Nao entra no MVP

- Soma parser
- HDI/Audatex parser
- Batch import
- Import history dashboard
- Rollback de import

---

## 9. Testes E2E + Monitoring

### 9.1 Testes E2E (Playwright)

**Fluxos cobertos:**
1. Login com email/senha → redirect pra /os
2. Esqueci senha → email → redefinir → login
3. Criar OS particular → avancar status → faturar → entregar
4. Importar orcamento Cilia → aprovar versao
5. Cadastrar servico → editar → desativar
6. Cadastrar peca → editar → desativar
7. Buscar placa → preencher veiculo
8. Admin configura matriz RBAC → CONSULTANT nao ve botao faturar

### 9.2 Testes de integracao backend

- Auth: login, register, forgot-password, reset-password, verify-email, refresh
- RBAC: check_tenant_permission com overrides
- Import: Cilia com validacoes novas, XML IFX
- Placa: mock API com cenarios de erro (429, timeout, JSON invalido)

### 9.3 Monitoring

**Sentry (ja na stack):**
- Alert: error rate > 10/min
- Alert: transaction p95 > 3s
- Performance monitoring habilitado no dscar-web e Django

**Health check:**
- `GET /api/v1/health/` retorna status de: DB, Redis, Resend (email), API placas (token valido)
- Usado pelo deploy pra verificar se a app subiu ok

---

## 10. Fora do escopo (backlog)

| Item | Motivo |
|------|--------|
| Soma/HDI parsers | Baixo volume, nao bloqueia validacao |
| Hub SSO portal | Deletado — sem utilidade pro MVP |
| Bulk operations (CSV import/export) | Nice-to-have, cliente nao pediu |
| Motor de precificacao | Fora do MVP (docs/backlog.md) |
| CRM/Inbox | Fora do MVP |
| PWA / offline web | Mobile cobre offline |
| Self-service registration | Nao aplicavel — ADMIN convida usuarios |

---

## 11. Riscos e mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migracao auth quebra sessoes existentes | Alto | Deploy coordenado: invalida todos os tokens, forca re-login |
| Performance nao melhora o suficiente | Medio | Bundle analyzer antes/depois, metas numericas |
| RBAC muito granular confunde admin | Medio | Defaults sensatos, agrupamento por modulo na UI |
| Branches velhas tem trabalho nao mergeado | Medio | Audit antes de limpar — verificar diff de cada uma |
| API de placas fora do ar | Baixo | Cache 3-tier ja existe, adicionar circuit breaker |
