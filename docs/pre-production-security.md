# Checklist de Segurança — Pré-Produção

**Projeto:** DS Car ERP (grupo-dscar)
**Referência:** Auditoria de segurança realizada em 2026-04-10
**Status:** Pendente — executar antes do deploy em produção

---

## Itens Concluídos (já no código) ✅

- [x] **JWT secret hardcoded removido** — `apps/dscar-web/src/lib/auth.ts`
  App agora falha explicitamente se `DEV_JWT_SECRET` não estiver no ambiente.

- [x] **TLS verification habilitado** — `apps/cilia/client.py` e `vehicle_catalog/views.py`
  Removido `verify=False` dos clientes httpx. Certificados inválidos são recusados.

- [x] **WebSocket com autenticação** — `apps/service_orders/consumers.py`
  Conexões não autenticadas são fechadas antes de serem aceitas.

---

## Itens Pendentes — Executar Antes de Ir para Produção

### CRÍTICO

#### SEC-01 — Rotacionar FIELD_ENCRYPTION_KEY (LGPD)

**Por que:** A chave Fernet atual está exposta no `.env` do repositório. Essa chave encripta CPF, email e telefone de todos os clientes/colaboradores. Se comprometida, constitui brecha LGPD.

**Como fazer:**

1. Gerar nova chave:
```bash
docker exec grupo-dscar-django-1 python -c \
  "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

2. No `backend/core/config/settings/base.py`, adicionar **temporariamente** as duas chaves (suporte a rotação nativa do `django-encrypted-model-fields`):
```python
# Temporário durante a rotação — nova chave primeiro, antiga depois
FIELD_ENCRYPTION_KEY = ["NOVA_CHAVE_AQUI", "CHAVE_ANTIGA_AQUI"]
```

3. Rodar o script de re-encriptação (pede ao Claude Code para gerar o script quando for executar):
```bash
docker exec grupo-dscar-django-1 python manage.py rotate_encryption_keys
# (Claude Code pode gerar este management command quando for a hora)
```

4. Após confirmar que todos os dados foram re-encriptados, remover a chave antiga:
```python
FIELD_ENCRYPTION_KEY = "NOVA_CHAVE_AQUI"
```

5. Atualizar a variável de ambiente em staging/produção (AWS Secrets Manager ou similar).

---

#### SEC-02 — AUTH_SECRET único por app

**Por que:** `hub/.env.local` e `dscar-web/.env.local` compartilham o mesmo `AUTH_SECRET`. Uma sessão forjada em uma app seria válida na outra.

**Como fazer:**

```bash
# Gerar um novo secret para o hub
openssl rand -base64 32
```

Atualizar `apps/hub/.env.local`:
```
AUTH_SECRET=<novo_valor_gerado>
```

O `dscar-web` fica com o valor atual. Em produção, cada app precisa de sua própria variável de ambiente `AUTH_SECRET` configurada separadamente.

---

### ALTO

#### SEC-03 — Variável DEV_JWT_SECRET no ambiente de dev

**Por que:** O código agora exige que `DEV_JWT_SECRET` esteja definido (não há mais fallback). Garantir que o `.env.local` de todos os devs tenha esse valor.

**O que fazer:** Confirmar que `apps/dscar-web/.env.local` contém:
```
DEV_JWT_SECRET=dscar-dev-secret-paddock-2025
```
(esse valor é ok em dev — o problema era ele estar hardcoded no código)

---

#### SEC-04 — Rate limiting nas APIs

**Por que:** Nenhum endpoint tem proteção contra brute force ou abuso.

**Como fazer:** Adicionar em `backend/core/config/settings/base.py`:
```python
REST_FRAMEWORK = {
    ...
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/min",
        "user": "200/min",
    },
}
```

---

#### SEC-05 — Dev-credentials provider condicional

**Por que:** O provider `dev-credentials` (senha `paddock123`) está sempre registrado. Se o código for para produção sem a variável de controle, qualquer pessoa consegue logar.

**Como fazer:** Em `apps/dscar-web/src/lib/auth.ts`, tornar o provider condicional:
```typescript
// Incluir só se explicitamente habilitado
...(process.env.DEV_CREDENTIALS_ENABLED === "true" ? [
  Credentials({ id: "dev-credentials", ... })
] : []),
```

Adicionar `DEV_CREDENTIALS_ENABLED=true` apenas nos `.env.local` de desenvolvimento. Nunca em staging/produção.

---

#### SEC-06 — Restringir Swagger/OpenAPI em produção

**Por que:** `/api/docs/` expõe toda a estrutura da API sem autenticação.

**Como fazer:** Em `backend/core/config/settings/prod.py`:
```python
# Desabilitar docs em produção
SPECTACULAR_SETTINGS = {
    ...
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
}
```

---

### MÉDIO

#### SEC-07 — JWT audience verification

**Por que:** `verify_aud: False` em `settings/dev.py` faz o backend aceitar JWTs de qualquer serviço/realm.

**Como fazer:** Configurar o claim `aud` esperado e habilitar verificação em `settings/base.py`.

---

#### SEC-08 — Validação de upload de arquivos

**Por que:** Endpoint de fotos de OS não valida MIME type nem tamanho máximo.

**Como fazer:** Adicionar em `settings/base.py`:
```python
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
```
E no serializer de upload, validar `content_type` contra lista de tipos permitidos (`image/jpeg`, `image/png`, `image/webp`).

---

## Configurações de Produção — Confirmar

Antes do deploy, verificar que `backend/core/config/settings/prod.py` tem:

```python
DEBUG = False
ALLOWED_HOSTS = ["api.paddock.solutions", "dscar.paddock.solutions"]  # sem *
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ["https://dscar.paddock.solutions", "https://paddock.solutions"]
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
```

E que `DevJWTAuthentication` **não** está em `DEFAULT_AUTHENTICATION_CLASSES` em produção.

---

## Resumo de Prioridades

| # | Item | Severidade | Esforço |
|---|------|------------|---------|
| SEC-01 | Rotacionar FIELD_ENCRYPTION_KEY | Crítico | Médio |
| SEC-02 | AUTH_SECRET único por app | Alto | Baixo |
| SEC-03 | DEV_JWT_SECRET no .env.local | Alto | Baixo |
| SEC-04 | Rate limiting | Alto | Baixo |
| SEC-05 | Dev-credentials condicional | Alto | Baixo |
| SEC-06 | Restringir Swagger em prod | Médio | Baixo |
| SEC-07 | JWT audience verification | Médio | Médio |
| SEC-08 | Validação upload de arquivos | Médio | Médio |

---

*Gerado por: Paddock Solutions · Auditoria 2026-04-10*
