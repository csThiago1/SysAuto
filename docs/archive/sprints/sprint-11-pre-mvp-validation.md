# Sprint 11 — Pré-MVP: Identidade Unificada, Auth & UX
**Data:** Abril 2026
**Objetivo:** Desbloquear o MVP resolvendo os três eixos críticos — (1) login Keycloak funcionando, (2) identidade unificada entre Employee/Customer/GlobalUser, (3) RBAC no backend. Sem isso, o sistema não está pronto para uso real.

---

## Diagnóstico Raiz (Auditoria Sprint 10)

### Eixo 1 — Login quebrado (dev-credentials + Keycloak)
- **Bug confirmado:** `signIn("dev-credentials", { redirect: false })` não trata `result.ok` → usuário fica na tela sem feedback nem redirect.
- **Keycloak:** fluxo RS256 implementado corretamente no backend (`KeycloakJWTAuthentication`), mas:
  1. Claims customizados (`companies`, `active_company`, `tenant_schema`, `client_slug`) precisam de **Protocol Mappers** no realm Keycloak — sem isso, a sessão fica sem informações de roteamento de tenant.
  2. `X-Tenant-Domain` hardcoded como `dscar.localhost` no proxy — precisa ser dinâmico.
  3. `KEYCLOAK_ISSUER` env var não configurada no `.env.local` → next-auth não sabe aonde redirecionar.

### Eixo 2 — Identidade fragmentada
A mesma pessoa real pode ser **Employee**, **UnifiedCustomer** e **GlobalUser** ao mesmo tempo, mas não há nenhum elo entre eles:

| Entidade | Schema | Vinculada a |
|----------|--------|-------------|
| `GlobalUser` | public | nada (é a raiz) |
| `Employee` | tenant | GlobalUser (OneToOne) + Person (via signal) |
| `UnifiedCustomer` | public | **nada** — independente |
| `Person` | tenant | criada via signal ao admitir Employee |

**Problema concreto:** um cliente que também é funcionário (ex: sócio) tem dois cadastros que nunca se reconhecem. Não existe endpoint `/me` que retorne "quem sou eu no sistema".

### Eixo 3 — RBAC ausente no backend
Todos os ViewSets usam apenas `permission_classes = [IsAuthenticated]`. Qualquer STOREKEEPER pode fechar folha, desligar colaboradores, modificar salários. O RBAC existe só no frontend (PermissionGate), que é trivialmente contornável.

---

## Contexto Técnico — Arquitetura de Identidade

```
SCHEMA PUBLIC (compartilhado entre tenants)
─────────────────────────────────────────────────────
GlobalUser
  id (UUID) · email (encrypted) · email_hash (SHA-256)
  name · keycloak_id (nullable) · is_active

  ↑ OneToOne (PROTECT)

Employee ── FK (SET_NULL) ──► Person
  user → GlobalUser              full_name · document (CPF)
  cpf (encrypted)                roles: CLIENT | EMPLOYEE | INSURER
  department · position          contacts: telefone · email
  base_salary · hire_date        addresses

UnifiedCustomer (INDEPENDENTE)
  name · cpf (encrypted+hash)
  phone (encrypted+hash)
  email (encrypted+hash)
  global_user FK ← A SER CRIADO (Sprint 11)

SCHEMA tenant_dscar (isolado)
─────────────────────────────────────────────────────
Employee, Person, SalaryHistory, Payslip, etc.
```

---

## Blocos de Entrega

### BLOCO A — Auth: Fix Login Dev + Keycloak ✅ Bloqueador #1

#### A-1: Fix login page (dev-credentials)
**Arquivo:** `apps/dscar-web/src/app/(auth)/login/page.tsx`

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const onSubmit = async (data: LoginForm) => {
  setLoading(true);
  setError(null);
  try {
    const result = await signIn("dev-credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (!result?.ok) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    router.push(result.url ?? "/service-orders");
  } finally {
    setLoading(false);
  }
};
```

- Botão desabilitado + spinner `Loader2` durante loading
- Mensagem de erro inline (não alert)
- Usar `Card`, `CardContent`, `CardHeader`, `CardTitle` do shadcn/ui
- Remover placeholder `paddock123` hardcoded na UI

#### A-2: Fix Keycloak — Protocol Mappers
**Arquivo:** `infra/docker/keycloak/realm-export.json`

Adicionar Protocol Mappers no client `paddock-frontend` para emitir claims customizados:

| Claim | Tipo | Fonte |
|-------|------|-------|
| `companies` | String List | User attribute `companies` |
| `active_company` | String | User attribute `active_company` |
| `role` | String | Realm role (maior precedência) |
| `tenant_schema` | String | User attribute `tenant_schema` |
| `client_slug` | String | User attribute `client_slug` |

Seed users (`seed-users.sh`) precisam ter atributos `active_company=dscar`, `tenant_schema=tenant_dscar`, `client_slug=grupo-dscar`, `companies=dscar`.

#### A-3: Fix next-auth Keycloak callback — extração de role
**Arquivo:** `apps/dscar-web/src/lib/auth.ts`

```typescript
async jwt({ token, account, profile }) {
  if (account?.access_token) token.accessToken = account.access_token;
  // Keycloak: extrair role de realm_access.roles OU claim direto
  if (account?.provider === "keycloak") {
    const p = profile as Record<string, unknown>;
    // Claim direto (via Protocol Mapper) tem precedência
    if (typeof p?.role === "string") {
      token.role = p.role;
    } else {
      // Fallback: realm_access.roles
      const roles = (p?.realm_access as { roles?: string[] })?.roles ?? [];
      const known: PaddockRole[] = ["OWNER","ADMIN","MANAGER","CONSULTANT","STOREKEEPER"];
      token.role = roles.find(r => known.includes(r as PaddockRole)) ?? "STOREKEEPER";
    }
    // Claims de routing de tenant
    token.companies     = p?.companies as string[] ?? [];
    token.activeCompany = p?.active_company as string ?? "";
    token.tenantSchema  = p?.tenant_schema as string ?? "";
    token.clientSlug    = p?.client_slug as string ?? "";
  }
  return token;
},
async session({ session, token }) {
  session.accessToken   = token.accessToken as string ?? "";
  session.role          = token.role as PaddockRole ?? "STOREKEEPER";
  session.companies     = token.companies as string[] ?? [];
  session.activeCompany = token.activeCompany as string ?? "";
  session.tenantSchema  = token.tenantSchema as string ?? "";
  session.clientSlug    = token.clientSlug as string ?? "";
  return session;
},
```

#### A-4: X-Tenant-Domain dinâmico no proxy
**Arquivo:** `apps/dscar-web/src/app/api/proxy/[...path]/route.ts`

```typescript
// Antes: "X-Tenant-Domain": "dscar.localhost" (hardcoded)
// Depois: ler da sessão ou de env var

const session = await auth();
const tenantDomain = session?.tenantSchema
  ? `${session.activeCompany}.localhost`
  : (process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost");

headers["X-Tenant-Domain"] = tenantDomain;
```

Adicionar `DEFAULT_TENANT_DOMAIN=dscar.localhost` no `.env.local`.

#### A-5: Variáveis de ambiente — documentar e criar template
**Novo arquivo:** `apps/dscar-web/.env.local.example`

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-32-chars-minimum-here

# Keycloak (opcional em dev — use dev-credentials se não tiver Keycloak)
KEYCLOAK_CLIENT_ID=paddock-frontend
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ISSUER=http://localhost:8080/realms/paddock

# Tenant padrão
DEFAULT_TENANT_DOMAIN=dscar.localhost
```

---

### BLOCO B — Identidade Unificada ✅ Bloqueador #2

#### B-1: Link `UnifiedCustomer` ↔ `GlobalUser` (nova migration)
**Arquivo:** `backend/core/apps/customers/models.py`

```python
global_user = models.OneToOneField(
    "authentication.GlobalUser",
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="customer_profile",
    help_text="Conta de acesso vinculada a este cliente (opcional).",
)
```

**Signal:** ao criar GlobalUser via login (get_or_create), verificar se existe UnifiedCustomer com mesmo `email_hash` e, se sim, preencher `global_user` automaticamente.

```python
# apps/authentication/signals.py
@receiver(post_save, sender=GlobalUser)
def link_customer_to_global_user(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.customers.models import UnifiedCustomer
    customer = UnifiedCustomer.objects.filter(
        email_hash=instance.email_hash
    ).first()
    if customer and not customer.global_user_id:
        UnifiedCustomer.objects.filter(pk=customer.pk).update(
            global_user=instance
        )
        logger.info("GlobalUser %s vinculado ao UnifiedCustomer %s", instance.pk, customer.pk)
```

#### B-2: Endpoint `/api/v1/auth/me/`
**Arquivo:** `backend/core/apps/authentication/views.py`

```python
class MeView(APIView):
    """Retorna identidade completa do usuário autenticado no tenant atual."""
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        user: GlobalUser = request.user
        payload = request.auth  # dict com claims do JWT

        data: dict = {
            "id": str(user.pk),
            "name": user.name,
            "email_hash": user.email_hash,
            "role": payload.get("role", "STOREKEEPER"),
            "active_company": payload.get("active_company", ""),
            "tenant_schema": payload.get("tenant_schema", ""),
            "is_employee": False,
            "is_customer": False,
            "employee": None,
            "customer": None,
        }

        # Perfil de colaborador (tenant schema atual)
        try:
            emp = user.employee_profile
            data["is_employee"] = True
            data["employee"] = {
                "id": str(emp.pk),
                "department": emp.department,
                "position": emp.position,
                "status": emp.status,
                "registration_number": emp.registration_number,
            }
        except Exception:
            pass

        # Perfil de cliente (schema public)
        try:
            customer = user.customer_profile  # via OneToOne
            if customer:
                data["is_customer"] = True
                data["customer"] = {
                    "id": str(customer.pk),
                    "name": customer.name,
                    "phone_masked": customer.phone_masked,
                    "cpf_masked": customer.cpf_masked,
                }
        except Exception:
            pass

        return Response(data)
```

**URL:** `GET /api/v1/auth/me/`

**Frontend hook:**
```typescript
// packages/auth/src/index.ts ou apps/dscar-web/src/hooks/useMe.ts
export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<MeResponse>("/api/proxy/auth/me/"),
    staleTime: 5 * 60 * 1000,
  });
}
```

**Tipo `MeResponse`:** adicionar em `packages/types/src/auth.types.ts`

#### B-3: Signal `Employee` ↔ `Person` (já existe, garantir funcionamento)
**Arquivo:** `backend/core/apps/hr/signals.py`

O signal `sync_employee_to_person` já existe e está correto. Verificar:
- Que está registrado em `apps/hr/apps.py` → `ready()` → `import apps.hr.signals`
- Que lookup `Person.objects.filter(document=raw_cpf)` usa formato normalizado (só dígitos)
- Que `PersonRole.objects.get_or_create(person=person, role="EMPLOYEE")` usa o valor correto do choices

---

### BLOCO C — RBAC no Backend ✅ Bloqueador #3

#### C-1: Permission Classes
**Novo arquivo:** `backend/core/apps/authentication/permissions.py`

```python
from rest_framework.permissions import BasePermission

ROLE_HIERARCHY = {
    "STOREKEEPER": 1,
    "CONSULTANT": 2,
    "MANAGER": 3,
    "ADMIN": 4,
    "OWNER": 5,
}

def _get_role(request) -> str:
    """Extrai role do payload JWT (request.auth é o dict de claims)."""
    if not request.auth:
        return "STOREKEEPER"
    if isinstance(request.auth, dict):
        return request.auth.get("role", "STOREKEEPER")
    return "STOREKEEPER"

class IsConsultantOrAbove(BasePermission):
    def has_permission(self, request, view):
        return ROLE_HIERARCHY.get(_get_role(request), 0) >= ROLE_HIERARCHY["CONSULTANT"]

class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return ROLE_HIERARCHY.get(_get_role(request), 0) >= ROLE_HIERARCHY["MANAGER"]

class IsAdminOrAbove(BasePermission):
    def has_permission(self, request, view):
        return ROLE_HIERARCHY.get(_get_role(request), 0) >= ROLE_HIERARCHY["ADMIN"]
```

#### C-2: Aplicar permission classes nos ViewSets

| ViewSet | Permission necessária |
|---------|----------------------|
| `ServiceOrderViewSet` (leitura) | `IsConsultantOrAbove` |
| `ServiceOrderViewSet` (escrita) | `IsConsultantOrAbove` |
| `EmployeeViewSet.terminate` | `IsManagerOrAbove` |
| `SalaryHistoryViewSet` | `IsManagerOrAbove` |
| `PayslipViewSet.close` | `IsManagerOrAbove` |
| `AllowanceViewSet.approve/pay` | `IsManagerOrAbove` |
| `GoalTargetViewSet.achieve` | `IsConsultantOrAbove` |
| `StaffDetailView` (PATCH) | `IsManagerOrAbove` |
| `UnifiedCustomerViewSet` (leitura) | `IsConsultantOrAbove` |
| `UnifiedCustomerViewSet` (escrita) | `IsConsultantOrAbove` |
| `TimeClockViewSet.approve` | `IsManagerOrAbove` |

Padrão de aplicação:
```python
class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @action(detail=True, methods=["post"])
    def terminate(self, request, pk=None):
        self.check_permissions(request)  # IsManagerOrAbove aqui
        # ou sobrescrever get_permissions() por action
```

---

### BLOCO D — HR: Melhorias de Negócio

#### D-1: `Employee.pay_frequency` (nova migration)
```python
class PayFrequency(models.TextChoices):
    MONTHLY   = "monthly",   _("Mensal")
    BIWEEKLY  = "biweekly",  _("Quinzenal")
    WEEKLY    = "weekly",    _("Semanal")

pay_frequency = models.CharField(
    max_length=10, choices=PayFrequency.choices, default=PayFrequency.MONTHLY
)
```
- `PayslipService.generate_payslip()` usa `pay_frequency` para calcular período
- `EmployeeCreateSerializer` + `EmployeeUpdateSerializer`: expor campo
- Frontend: Select no form de admissão

#### D-2: `Deduction` — desconto percentual
```python
class DiscountType(models.TextChoices):
    FIXED      = "fixed",      _("Valor Fixo")
    PERCENTAGE = "percentage", _("Percentual do Salário")

discount_type = models.CharField(max_length=12, choices=DiscountType.choices, default="fixed")
rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
```
- `DeductionSerializer.validate()`: `amount` obrigatório se fixed; `rate` obrigatório (0 < rate <= 100) se percentage
- `PayslipService._get_deductions()`: calcular `amount = base_salary * rate / 100` se percentage

#### D-3: `GoalTarget` — metas recorrentes
```python
is_recurring   = models.BooleanField(default=False)
recurrence_day = models.IntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(28)])
parent_goal    = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)
```
- Celery task `task_clone_recurring_goals(tenant_schema)`: roda no dia configurado
- Frontend: checkbox "Meta recorrente" + campo "Dia de reinício" no `CreateGoalForm`

---

### BLOCO E — UX/UI

#### E-1: Sidebar & Header
- `PAGE_TITLES` em `AppHeader.tsx`: mapear todas as rotas `/rh/**` e `/os/**`
- Sidebar: "Recursos Humanos" → "RH"; OS + Kanban → grupo expansível
- `getPageTitle()`: regex para `/rh/colaboradores/[id]` → "Colaborador", etc.

#### E-2: OS — Aba Entrega
- 4ª aba "Entrega" em `/os/[id]`: checklist de entrega, observações, botão "Registrar Entrega"
- Stepper de status com labels legíveis
- Subtotais separados (Peças + Serviços + Descontos)

---

## Migrations Consolidadas

```
authentication/migrations/0003_globaluser_customer_link_signal.py
customers/migrations/0002_unifiedcustomer_global_user.py
hr/migrations/0003_sprint11_pay_frequency_deduction_goal.py
  → Employee.pay_frequency
  → Deduction.discount_type + rate
  → GoalTarget.is_recurring + recurrence_day + parent_goal
```

---

## Prioridade de Implementação — MVP First

| # | Item | Bloqueador MVP? | Effort |
|---|------|-----------------|--------|
| **A-1** | Fix login page (result.ok) | ✅ SIM | P |
| **A-2** | Keycloak Protocol Mappers | ✅ SIM | M |
| **A-3** | next-auth Keycloak callback | ✅ SIM | P |
| **A-4** | X-Tenant-Domain dinâmico | ✅ SIM | P |
| **A-5** | .env.local.example | Médio | P |
| **B-1** | UnifiedCustomer.global_user + signal | ✅ SIM | M |
| **B-2** | Endpoint /me + hook useMe | ✅ SIM | M |
| **B-3** | Signal Employee↔Person (verificar) | Médio | P |
| **C-1** | Permission classes RBAC | ✅ SIM (segurança) | P |
| **C-2** | Aplicar RBAC nos ViewSets | ✅ SIM | M |
| **D-1** | pay_frequency | Médio | M |
| **D-2** | Desconto percentual | Baixo | M |
| **D-3** | Metas recorrentes | Baixo | G |
| **E-1** | Sidebar/Header UX | Médio | P |
| **E-2** | OS aba Entrega | Baixo | G |

**P = Pequeno (< 2h) · M = Médio (2–4h) · G = Grande (4–8h)**

---

## Fora do Escopo desta Sprint
- NF-e / NFS-e (Sprint 12)
- Assinatura digital do cliente
- Integração biométrica de ponto
- App mobile
- Multi-tenant switching completo (Hub SSO portal — Sprint 12)
- Inventory e Fiscal ViewSets

---

## Guia de Validação Humana

Após implementação, testar **na ordem**:

1. **Login dev-credentials**: email qualquer + `paddock123` → deve redirecionar para `/service-orders`
2. **Login Keycloak**: `admin@paddock.solutions` / `admin123` → deve redirecionar com role `ADMIN`
3. **GET /api/v1/auth/me/**: retornar `{ name, role, is_employee, is_customer }`
4. **Admitir colaborador**: POST `/api/v1/hr/employees/` → verificar GlobalUser criado + Person criado com role=EMPLOYEE
5. **Criar cliente com mesmo email**: POST `/api/v1/customers/` → verificar `global_user` FK preenchida
6. **RBAC**: logar com STOREKEEPER, tentar PATCH salary → 403
7. **RBAC**: logar com MANAGER, tentar fechar folha → 403 (somente ADMIN)

---

*Paddock Solutions · Sprint 11 · Abril 2026*
*Spec gerado pós-auditoria de qualidade (4 agentes) + diagnóstico de identidade (2 agentes)*
