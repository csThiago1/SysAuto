# Auditoria de Segurança — Pré-Produção
**Data:** 2026-04-25
**Status:** Em andamento (Críticos ✅ | Altos 🔴 | Médios 🟡 | Baixos ⚪)

---

## Resumo

23 findings identificados antes do deploy de produção.
3 críticos corrigidos nesta sessão. Restam 7 altos, 8 médios, 5 baixos.

---

## Críticos — ✅ Corrigidos

| ID | Problema | Arquivo | Status |
|----|----------|---------|--------|
| F-01 | `DevTokenView` exposto em produção — auth bypass com `paddock123` | `authentication/urls.py` | ✅ `if settings.DEBUG:` |
| F-02 | `KeycloakJWTAuthentication` ausente em `prod.py` | `authentication/backends.py` (novo) + `prod.py` | ✅ Extraído para `backends.py`, configurado em `prod.py` |
| F-03 | `ServiceOrderCreateSerializer` sem `read_only_fields` — mass assignment em `status`, totais, `nfe_key` | `service_orders/serializers.py` | ✅ `read_only_fields` adicionado |

**Detalhe F-02:** `KeycloakJWTAuthentication` movida para `apps/authentication/backends.py`. Lê JWKS URL de `settings.OIDC_OP_JWKS_ENDPOINT` (dev: Keycloak Docker; prod: via env var). `prod.py` agora configura `DEFAULT_AUTHENTICATION_CLASSES` explicitamente sem `DevJWTAuthentication`.

---

## Altos — 🔴 Pendentes

| ID | Problema | Arquivo | Ação necessária |
|----|----------|---------|-----------------|
| F-04 | Webhook Focus NF-e aceita secret vazio | `fiscal/views.py:166` | Guard: retornar 503 se `FOCUS_NFE_WEBHOOK_SECRET` vazio |
| F-05 | `FIELD_ENCRYPTION_KEY` vazio = PII sem criptografia (LGPD) | `settings/base.py:264` | `ImproperlyConfigured` em `prod.py` se vazio |
| F-06 | Celery tasks sem `schema_context` | `fiscal/tasks.py`, `hr/tasks.py`, `imports/tasks.py`, `budgets/tasks.py` | Todas as tasks que acessam TENANT_APPS precisam de `with schema_context(tenant_schema):` |
| F-07 | `ExpertViewSet` sem RBAC de escrita | `experts/views.py:16` | `get_permissions()` com `IsManagerOrAbove` para create/update/destroy |
| F-08 | `InsurerViewSet` sem RBAC de escrita | `insurers/views.py:42` | Idem |
| F-09 | `SupplierViewSet` / `PayableDocumentViewSet` — CONSULTANT cria contas a pagar | `accounts_payable/views.py:49,97` | `get_permissions()` com `IsManagerOrAbove` para escrita |
| F-10 | URL do backend hardcoded `localhost:8000` no proxy Next.js | `proxy/[...path]/route.ts:12` | Usar `process.env.BACKEND_URL ?? "http://localhost:8000"` |

---

## Médios — 🟡 Pendentes

| ID | Problema | Ação |
|----|----------|------|
| F-11 | Views fiscais vazam `str(exc)` de `FocusNFeError` | Mensagem genérica + `logger.error` |
| F-12 | Cilia view vaza `str(e)` de exception genérica | `except Exception: return Response({"erro": "Erro interno."}, 500)` |
| F-13 | `NfeRecebidaManifestView` repassa `resp.data` da Focus | Mensagem genérica em erro |
| F-14 | `EmployeeViewSet` — CONSULTANT cria colaboradores | `create`/`update`/`partial_update` em `IsManagerOrAbove` |
| F-15 | `InsurerViewSet.retrieve` retorna registros soft-deleted | Filtrar `is_active=True` em `retrieve` também |
| F-16 | Swagger UI sem autenticação em prod | Condicionar a `if settings.DEBUG:` em `urls.py` |
| F-17 | `CORS_ALLOW_ALL_ORIGINS=True` em `dev.py` — risco em staging | Garantir staging usa `prod.py` |
| F-18 | Push token sem validação de formato | Validar prefixo `ExponentPushToken` no endpoint |

---

## Baixos — ⚪ Pendentes

| ID | Problema | Ação |
|----|----------|------|
| F-19 | `ALLOWED_HOSTS` não validado em `prod.py` | Guard contra `*` |
| F-20 | `verify_aud: False` no Keycloak — token de outro client aceito | Configurar `aud` com `OIDC_RP_CLIENT_ID` em prod |
| F-21 | Expiração de token não alinhada (Keycloak ↔ simplejwt) | Alinhar `ACCESS_TOKEN_LIFETIME` com `access_token_lifespan` do Keycloak |
| F-22 | `phone`/`email` completos expostos para CONSULTANT | Retornar completo apenas para MANAGER+ |
| F-23 | `StaffListView` fallback retorna todos os usuários quando HR falha | Retornar lista vazia em vez de fallback total |

---

## Aspectos Positivos Confirmados

- LGPD: `EncryptedCharField` para CPF/email/telefone com SHA-256 hash para busca ✅
- Soft delete consistente via `PaddockBaseModel.is_active` ✅
- Proxy Next.js não loga body (LGPD) ✅
- Guard `FOCUS_NFE_AMBIENTE=producao` bloqueado quando `DEBUG=True` ✅
- Mascaramento de CPF consistente em todos os serializers ✅
- RBAC bem estruturado em ViewSets críticos (fiscal, accounting, pricing) ✅

---

## Env vars obrigatórias em produção (checklist)

```bash
DJANGO_SECRET_KEY=<forte, 50+ chars>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=dscar.paddock.solutions,api.paddock.solutions
FIELD_ENCRYPTION_KEY=<Fernet key>
FOCUS_NFE_WEBHOOK_SECRET=<32+ chars aleatórios>
OIDC_OP_JWKS_ENDPOINT=https://<keycloak-host>/realms/paddock/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=paddock-frontend
KEYCLOAK_CLIENT_SECRET=<secret do client>
```
