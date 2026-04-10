# Sprint 12 — Auth & SSO: Keycloak Funcionando End-to-End

**Data:** Abril 2026
**Objetivo:** Resolver falhas de autenticação e SSO com Keycloak
**Resultado:** ✅ Login funciona, nome do usuário exibido corretamente após SSO

---

## 🎯 Resumo da Sprint

Após uma sessão intensiva de debugging, todas as 11 falhas de autenticação foram resolvidas:

- **next-auth v5** usa `AUTH_SECRET`, não `NEXTAUTH_SECRET`
- **Keycloak** requer schema PostgreSQL inicializado antes do primeiro start
- **Login redirect** agora aponta para `/os` (destino correto)
- **Usuários autenticados** são redirecionados para fora de `/login`
- **Cache do TanStack Query** agora invalida corretamente (query key consistency)
- **RBAC backend** implementado em todos os ViewSets
- **Identidade unificada** (GlobalUser + Employee + Customer) via `/me`
- **Protocol Mappers** Keycloak configurados (role, companies, tenant_schema, etc)

---

## 📋 Todas as 11 Correções

### 1. next-auth v5: `AUTH_SECRET` (não `NEXTAUTH_SECRET`)

**Arquivo:** `apps/dscar-web/.env.local` e `apps/hub/.env.local`
**Problema:** next-auth v5 (beta.28) mudou o nome da variável de ambiente de `NEXTAUTH_SECRET` para `AUTH_SECRET`. Sem essa variável, o next-auth falha silenciosamente.

**Solução:**
```bash
# Adicionar em .env.local de ambos dscar-web e hub
AUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=

# NEXTAUTH_SECRET pode ficar como alias de compatibilidade, mas AUTH_SECRET é o oficial
NEXTAUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=
```

**Por que isso importa:** Sem `AUTH_SECRET`, next-auth não consegue assinar JWTs, resultando em `session = null` no frontend e falhas silenciosas no provider Keycloak.

---

### 2. Keycloak: Schema PostgreSQL Ausente

**Arquivo:** `docker-compose.dev.yml` (configuração) e `paddock_dev` database
**Problema:** `docker-compose.dev.yml` define `KC_DB_SCHEMA: keycloak`, mas a schema nunca foi criada no PostgreSQL. Keycloak falha com:
```
ERROR: schema "keycloak" does not exist
```

**Solução - Primeira Vez (Manual):**
```bash
# Conectar ao PostgreSQL rodando
docker exec paddock_postgres psql -U paddock -d paddock_dev

# Dentro do psql:
CREATE SCHEMA IF NOT EXISTS keycloak;
\q
```

**Solução - Próximas Vezes:**
Keycloak cria tabelas automaticamente na primeira vez que roda. Apenas garanta que o PostgreSQL já esteja subido antes de `docker compose up`.

**Por que isso importa:** Keycloak precisa de schema dedicado para isolar suas tabelas das outras aplicações (multitenancy).

---

### 3. Login Redirect Apontava para URL Interna

**Arquivo:** `apps/dscar-web/src/app/(auth)/login/page.tsx`
**Problema:** Após autenticação bem-sucedida, a página redirectava para `result.url`, que em next-auth v5 com `redirect: false` retorna a URL interna de callback do next-auth, não a URL de destino (p.ex.: `/os`).

**Antes:**
```typescript
if (result.ok) {
  router.push(result.url ?? "/service-orders"); // ❌ result.url é interno
}
```

**Depois:**
```typescript
if (result.ok) {
  router.push("/os"); // ✅ destino correto
}
```

**Por que isso importa:** O usuário conseguia fazer login mas não conseguia navegar para nenhuma página.

---

### 4. Usuários Autenticados Presos em `/login`

**Arquivo:** `apps/dscar-web/src/middleware.ts`
**Problema:** O middleware não tinha guard para redirecionar usuários já autenticados para fora de páginas de auth (como `/login`).

**Solução:**
```typescript
// Em middleware.ts, após validar isLoggedIn
if (isLoggedIn && isAuthPage) {
  return NextResponse.redirect(new URL("/os", request.url));
}
```

**Por que isso importa:** Evita que usuários fiquem em loop de login ou vejam página de login após já estar autenticado.

---

### 5. Invalidação de Cache: Query Key Inconsistente

**Arquivo:**
- `apps/dscar-web/src/app/(app)/os/[id]/_components/CiliaUpdateModal.tsx`
- `apps/dscar-web/src/app/(app)/os/[id]/_components/OSDatesTimeline.tsx`

**Problema:** O hook query usava chave canônica `"service-orders"`, mas os modais tentavam invalidar com `"service_orders"` (underscore). TanStack Query não reconhecia como mesma chave.

**Solução:**
```typescript
// Antes (❌ inconsistente)
queryClient.invalidateQueries({ queryKey: ["service_orders"] });

// Depois (✅ canônico)
queryClient.invalidateQueries({ queryKey: ["service-orders"] });
```

**Por que isso importa:** Cache desincronizado → usuário vê dados antigos após sincronizar com Cilia ou atualizar datas.

---

### 6. `hub/.env.local` Faltava Totalmente

**Arquivo:** `apps/hub/.env.local`
**Problema:** O hub estava sem arquivo `.env.local`, causando falhas de autenticação no portal SSO/Hub.

**Solução - Criar arquivo:**
```bash
# apps/hub/.env.local

# next-auth v5
AUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=
NEXTAUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=

# Keycloak OIDC
AUTH_KEYCLOAK_ID=paddock-hub
AUTH_KEYCLOAK_SECRET=[seu_secret_keycloak]
AUTH_KEYCLOAK_ISSUER=http://keycloak:8080/realms/paddock
AUTH_KEYCLOAK_REALM=paddock
```

**Por que isso importa:** Sem essas variáveis, o hub não consegue autenticar ninguém.

---

### 7. RBAC: Permissões Faltando em ViewSets

**Arquivo:** `backend/core/apps/authentication/permissions.py` (novo)
**Problema:** Todos os ViewSets estavam abertos (sem validação de role). Qualquer usuário conseguia acessar qualquer recurso.

**Solução - Criar arquivo de permissões:**
```python
# backend/core/apps/authentication/permissions.py

from rest_framework.permissions import BasePermission
from apps.authentication.models import GlobalUser

class IsConsultantOrAbove(BasePermission):
    """Requer CONSULTANT (≥2) ou acima"""
    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, GlobalUser):
            return False
        return user.role >= 2

class IsManagerOrAbove(BasePermission):
    """Requer MANAGER (≥3) ou acima"""
    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, GlobalUser):
            return False
        return user.role >= 3

class IsAdminOrAbove(BasePermission):
    """Requer ADMIN (≥4) ou acima"""
    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, GlobalUser):
            return False
        return user.role >= 4
```

**Aplicar em todos os ViewSets (exemplo):**
```python
class ServiceOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    ...
```

**Por que isso importa:** Sem RBAC, dados confidenciais (salários, dados de clientes, etc) ficam expostos.

---

### 8. Identidade Fragmentada: UnifiedCustomer ↔ GlobalUser

**Arquivo:** `backend/core/apps/customers/models.py` e `backend/core/apps/customers/migrations/0002_unifiedcustomer_global_user.py`

**Problema:** `UnifiedCustomer` não tinha relacionamento com `GlobalUser`. Um cliente que também era funcionário tinha duas identidades desconectadas.

**Solução - Adicionar campo:**
```python
# models.py
class UnifiedCustomer(PaddockBaseModel):
    ...
    global_user = models.OneToOneField(
        GlobalUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer",
        help_text="Link para GlobalUser se o cliente é também um usuário do sistema"
    )
```

**Signal de Auto-Link (primeira autenticação):**
```python
from django.db.models.signals import post_save

@receiver(post_save, sender=GlobalUser)
def link_customer_on_first_login(sender, instance, created, **kwargs):
    if created and instance.email_hash:
        try:
            customer = UnifiedCustomer.objects.get(email_hash=instance.email_hash)
            customer.global_user = instance
            customer.save(update_fields=['global_user'])
        except UnifiedCustomer.DoesNotExist:
            pass
```

**Por que isso importa:** Permite saber se um cliente tem permissão de acesso ao sistema, e unifica histórico pessoal.

---

### 9. Falta Endpoint `/me`: Identidade Unificada

**Arquivo:** `backend/core/apps/authentication/views.py` (novo endpoint)
**Problema:** Frontend não tinha forma de obter dados unificados do usuário logado (GlobalUser + Employee + Customer).

**Solução - Adicionar ação:**
```python
# apps/authentication/views.py

from rest_framework.decorators import action
from rest_framework.response import Response

class GlobalUserViewSet(viewsets.ModelViewSet):
    ...

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Retorna identidade unificada do usuário logado"""
        user = request.user

        # Snapshot de Employee se existe
        employee = None
        try:
            emp = user.employee
            employee = {
                'id': str(emp.id),
                'name': emp.name,
                'department': emp.department,
                'position': emp.position,
                'status': emp.status,
            }
        except:
            pass

        # Snapshot de Customer se existe
        customer = None
        try:
            cust = user.customer
            customer = {
                'id': str(cust.id),
                'name': cust.name,
                'cpf_hash': cust.cpf_hash,
                'email_hash': cust.email_hash,
            }
        except:
            pass

        return Response({
            'id': str(user.id),
            'email': user.email,
            'email_hash': user.email_hash,
            'role': user.role,
            'role_display': user.get_role_display(),
            'employee': employee,
            'customer': customer,
        })
```

**Rota:** `GET /api/v1/auth/me/`

**Por que isso importa:** Frontend precisa saber se o usuário é colaborador, cliente ou ambos.

---

### 10. Protocol Mappers Keycloak: Claims Customizados

**Arquivo:** `infra/keycloak/realm-export.json`
**Problema:** O JWT de Keycloak não tinha claims customizados necessários (role, companies, tenant_schema, etc).

**Solução - Adicionar 5 mappers em `realm-export.json`:**

```json
{
  "name": "realm",
  "protocolMappers": [
    {
      "name": "role",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "consentRequired": false,
      "config": {
        "claim.value": "CONSULTANT",
        "userinfo.token.claim": "true",
        "id.token.claim": "true",
        "access.token.claim": "true",
        "claim.name": "role"
      }
    },
    {
      "name": "companies",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "config": {
        "claim.value": "[\"dscar\",\"pecas\"]",
        "claim.name": "companies",
        "access.token.claim": "true"
      }
    },
    {
      "name": "active_company",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "config": {
        "claim.value": "dscar",
        "claim.name": "active_company",
        "access.token.claim": "true"
      }
    },
    {
      "name": "tenant_schema",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "config": {
        "claim.value": "tenant_dscar",
        "claim.name": "tenant_schema",
        "access.token.claim": "true"
      }
    },
    {
      "name": "client_slug",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "config": {
        "claim.value": "grupo-dscar",
        "claim.name": "client_slug",
        "access.token.claim": "true"
      }
    }
  ]
}
```

**Por que isso importa:** Backend usa esses claims para rotear requisições para o schema correto e validar permissões por empresa.

---

### 11. X-Tenant-Domain: Rota de Proxy Dinâmica

**Arquivo:** `apps/dscar-web/src/middleware.ts` e `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`
**Problema:** Header `X-Tenant-Domain` estava hardcoded como `dscar.localhost`, não adaptável a múltiplos clientes/empresas.

**Solução - Usar `session.activeCompany`:**
```typescript
// Em middleware.ts ou route.ts, após ter acesso a session
const session = await auth();
const activeCompany = session?.activeCompany ?? "dscar"; // fallback

// Ao chamar API Django
const response = await fetch(`http://localhost:8000/api/v1/${path}`, {
  headers: {
    "X-Tenant-Domain": `${activeCompany}.localhost`,
    "Authorization": `Bearer ${session?.accessToken}`,
  },
});
```

**Por que isso importa:** Permite rotear para tenant correto dinamicamente, sem hardcode.

---

## 🔐 Keycloak: Setup do Zero

### Pré-requisitos
- PostgreSQL 16 rodando (via `docker compose up`)
- Docker e Docker Compose instalados

### Passo 1: Criar Schema Keycloak

```bash
# Conectar ao PostgreSQL
docker exec paddock_postgres psql -U paddock -d paddock_dev

# Criar schema (copie e cole no psql)
CREATE SCHEMA IF NOT EXISTS keycloak;
\q
```

### Passo 2: Subir Keycloak

```bash
# Do diretório raiz
docker compose up keycloak
```

Aguarde até ver no console:
```
Keycloak 24.0.1 (WildFly Core 21.0.4.Final) started in X ms
```

### Passo 3: Acessar Admin Console

- **URL:** http://localhost:8080
- **Usuário:** admin
- **Senha:** admin

### Passo 4: Criar Realm "paddock"

1. Clique em dropdown "Master" (canto superior esquerdo)
2. Clique em "Create Realm"
3. Nome: `paddock`
4. Clique em "Create"

### Passo 5: Criar Usuários

Navegue para "Users" (sidebar esquerdo), clique "Create New User":

**Usuário 1:**
- Username: `admin@paddock.solutions`
- Email: `admin@paddock.solutions`
- First Name: `Admin`
- Last Name: `Paddock`
- Email Verified: ON
- Clique "Create"

Abra o usuário criado:
- Aba "Credentials"
- Clique "Set password"
- Password: `admin123`
- Confirm password: `admin123`
- Temporary: OFF
- Clique "Set password"

Abra o usuário criado novamente:
- Aba "Role mapping"
- Clique "Assign role"
- Selecione `admin` (role padrão)
- Clique "Assign"

**Usuário 2:**
- Username: `thiago@paddock.solutions`
- Email: `thiago@paddock.solutions`
- First Name: `Thiago`
- Last Name: `Campos`
- Email Verified: ON
- Clique "Create"

Configure senha: `paddock123` (idem acima)

Atribua role: `user` (ou qualquer role não-admin)

### Passo 6: Criar Client "paddock-hub"

Navegue para "Clients" (sidebar), clique "Create":
- Client ID: `paddock-hub`
- Name: `Paddock Hub`
- Clique "Next"
- Client authentication: ON
- Authorization: OFF
- Clique "Next"
- Valid Redirect URIs: `http://localhost:3000/*`
- Web Origins: `http://localhost:3000`
- Clique "Save"

**Abra o client criado:**
- Aba "Credentials"
- Copie o "Client secret" para `apps/hub/.env.local` como `AUTH_KEYCLOAK_SECRET`

### Passo 7: Variáveis de Ambiente

**`apps/dscar-web/.env.local`:**
```
AUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=
NEXTAUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=

AUTH_KEYCLOAK_ID=paddock-hub
AUTH_KEYCLOAK_SECRET=[client_secret_do_passo_6]
AUTH_KEYCLOAK_ISSUER=http://keycloak:8080/realms/paddock
AUTH_KEYCLOAK_REALM=paddock
```

**`apps/hub/.env.local`:**
```
AUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=
NEXTAUTH_SECRET=TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=

AUTH_KEYCLOAK_ID=paddock-hub
AUTH_KEYCLOAK_SECRET=[client_secret_do_passo_6]
AUTH_KEYCLOAK_ISSUER=http://keycloak:8080/realms/paddock
AUTH_KEYCLOAK_REALM=paddock
```

---

## ✅ Checklist de Testes

### Dev-Credentials (Teste Rápido)

```bash
# Terminal 1: Subir todos os serviços
make dev

# Terminal 2: Acessar frontend
open http://localhost:3000/login

# Preencha:
Email: test@example.com (qualquer email)
Senha: paddock123

# Resultado esperado:
✅ Login bem-sucedido
✅ Nome do usuário exibido no header/sidebar
✅ Redirecionado para /os
```

### Keycloak OIDC (Teste Completo)

```bash
# Terminal 1: Serviços Docker
make dev

# Terminal 2: Acessar frontend
open http://localhost:3000/login

# Clique em "Login com Keycloak" ou "Sign in with Keycloak"
# Será redirecionado para http://keycloak:8080/auth/...

# Preencha com um dos usuários criados:
Email: thiago@paddock.solutions
Senha: paddock123

# Resultado esperado:
✅ Redirecionado de volta para http://localhost:3000
✅ Nome do usuário exibido corretamente (Thiago Campos)
✅ Redirecionado para /os
✅ Consegue acessar pages protegidas
```

### Cache e Invalidação (TanStack Query)

```bash
# Em uma OS (http://localhost:3000/os/[id]):
1. Abra modal "Sincronizar com Cilia"
2. Clique em sincronizar
3. Verifique que os dados são atualizados (não mostra dados antigos)

# Em OSDatesTimeline:
1. Altere uma data
2. Verifique que a timeline é atualizada imediatamente
```

### RBAC Backend

```bash
# Terminal: Django shell
docker exec paddock_core python manage.py shell

# Teste permissão:
>>> from apps.authentication.models import GlobalUser
>>> from apps.service_orders.models import ServiceOrder
>>> user = GlobalUser.objects.get(email="test@example.com")
>>> user.role
2  # CONSULTANT

# Teste acesso à API:
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/service-orders/

# Resultado esperado: 200 OK (se role >= CONSULTANT)
```

---

## 📦 Variáveis de Ambiente Completas

| Variável | Serviço | Valor Padrão | Descrição |
|----------|---------|--------------|-----------|
| `AUTH_SECRET` | next-auth v5 | `TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=` | Secret para assinar JWTs |
| `NEXTAUTH_SECRET` | next-auth v4 compat | `TC9d93UuxmQ8TFju8hlXHDWBIP6/ZPIl9eRM7c37Lc0=` | Alias para compatibilidade (desaprovado em v5) |
| `AUTH_KEYCLOAK_ID` | next-auth OIDC | `paddock-hub` | Client ID no Keycloak |
| `AUTH_KEYCLOAK_SECRET` | next-auth OIDC | (vazio — copiar do Keycloak) | Client secret no Keycloak |
| `AUTH_KEYCLOAK_ISSUER` | next-auth OIDC | `http://keycloak:8080/realms/paddock` | URL do realm Keycloak |
| `AUTH_KEYCLOAK_REALM` | next-auth OIDC | `paddock` | Nome do realm |
| `DEV_JWT_SECRET` | Django auth | `dscar-dev-secret-paddock-2025` | Secret HS256 para dev-credentials |

---

## 🎓 Lições Aprendidas

1. **next-auth v5 é beta** — mudanças radicais de v4 (variável `AUTH_SECRET`, estrutura session, etc)
2. **Keycloak é stateful** — precisa de schema PostgreSQL antes de rodar
3. **Query keys no TanStack Query** — devem ser strings com um padrão consistente (kebab-case, não snake_case)
4. **JWT claims customizados** — Keycloak exige protocol mappers explícitos
5. **Multitenancy + OIDC** — precisa de mapping de `active_company` e `tenant_schema` no token

---

## 📚 Referências

- **next-auth v5 docs:** https://authjs.dev/
- **Keycloak Admin Console:** http://localhost:8080
- **Keycloak OIDC Protocol:** https://openid.net/connect/
- **Django OIDC:** https://mozilla-django-oidc.readthedocs.io/
- **Sprint anterior (Sprint 4):** `docs/sprint-04-rbac-ux-integration.md`

---

**Sprint 12 Entregue:** Abril 2026
**Status:** ✅ Login funciona, SSO com Keycloak operacional, identidade unificada implementada
