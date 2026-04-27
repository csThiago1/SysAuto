# Spec: Homolog — Cloudflare R2 + Docker Compose no Coolify
**Data:** 2026-04-25
**Status:** Aprovado pelo usuário

---

## Contexto

Primeira versão de ambiente não-local do grupo-dscar. Não existe prod ainda — este homolog serve como base para prod futura. Storage atual é filesystem local; passa a ser Cloudflare R2 (media only) em todos os ambientes não-locais.

Docker Swarm foi descartado por ser overengineering para homolog solo. Coolify gerencia o deploy via SSH + docker compose diretamente.

---

## Objetivos

1. Configurar Cloudflare R2 como storage de media (fotos OS, logos seguradoras, docs RH, XMLs/PDFs NF-e)
2. Criar `homolog.py` settings — base para futura `prod.py`
3. Criar `docker-compose.homolog.yml` para deploy no Coolify
4. Testar R2 localmente antes de subir no Coolify

---

## O que NÃO entra no escopo

- Static files no R2 (servidos pelo Django via WhiteNoise)
- CI/CD automatizado (deploy manual via Coolify por ora)
- Docker Swarm / multi-node (futuro, quando houver necessidade real)
- Configuração de prod (será derivada do homolog depois)

---

## Arquitetura

### Storage — Cloudflare R2

**Backend:** `storages.backends.s3boto3.S3Boto3Storage`
R2 é S3-compatible. Diferença: `AWS_S3_ENDPOINT_URL` aponta para o endpoint R2 da conta Cloudflare.

```
Media files → R2 bucket (dscar-homolog-media)
Static files → WhiteNoise (servido pelo Django diretamente)
```

**Mapeamento de variáveis (`homolog.py`):**
```
R2_ACCOUNT_ID        → AWS_S3_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID     → AWS_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY → AWS_SECRET_ACCESS_KEY
R2_BUCKET_NAME       → AWS_STORAGE_BUCKET_NAME
R2_PUBLIC_URL        → AWS_S3_CUSTOM_DOMAIN  (sem "https://")
```

O mapeamento fica em `homolog.py` — o resto do código não sabe que é R2.

**CORS no bucket R2:** configurar antes do primeiro upload para permitir requests do domínio homolog.

### Settings hierarchy

```
base.py
└── homolog.py    ← novo
└── prod.py       ← futuro (cópia de homolog com ajustes mínimos)
```

`homolog.py` define:
- `DEBUG = False`
- R2 como `DEFAULT_FILE_STORAGE`
- `SEFAZ_ENV = "homologation"` (NF-e em ambiente de teste)
- `ALLOWED_HOSTS` via env var
- HTTPS/HSTS/cookies seguros
- `CORS_ALLOWED_ORIGINS` explícito
- `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` com apenas `KeycloakJWTAuthentication`
- Guard: `ImproperlyConfigured` se `FIELD_ENCRYPTION_KEY` ou `R2_ACCOUNT_ID` estiver vazio

### Docker Compose

**Arquivo:** `infra/docker/stacks/docker-compose.homolog.yml`

**Services:**

| Service | Imagem | Notas |
|---------|--------|-------|
| `django` | `paddock/dscar-api:homolog` | Daphne ASGI, porta 8000 interna |
| `celery-worker` | mesma imagem Django | `command: celery worker` |
| `celery-beat` | mesma imagem Django | `command: celery beat` |
| `redis` | `redis:7-alpine` | broker + channels layer |
| `postgres` | `postgres:16` | volume persistente |
| `keycloak` | `quay.io/keycloak/keycloak:24` | volume persistente + realm-export.json |
| `nextjs` | `paddock/dscar-web:homolog` | porta 3000 interna |

**Rede:** bridge `paddock_homolog` — comunicação interna entre todos os services.

**Volumes persistentes:**
```
postgres_data   → /var/lib/postgresql/data
keycloak_data   → /opt/keycloak/data
```

**Portas expostas:** apenas via Coolify reverse proxy (Traefik). Nenhuma porta exposta diretamente ao host.

**Env vars:** configuradas na UI do Coolify (não em arquivo commitado). Template documentado em `infra/docker/stacks/.env.homolog.example`.

### Dockerfiles

**`backend/Dockerfile`**
- Base: `python:3.12-slim`
- Instala `requirements.txt`
- `collectstatic`
- Entrypoint parametrizado: `api` | `worker` | `beat`

**`apps/dscar-web/Dockerfile`**
- Base: `node:20-alpine`
- `npm ci` + `next build`
- `next start`

### Teste local do R2

Antes de subir no Coolify, testar R2 com o servidor local:

```bash
# .env.r2.local (gitignored)
DEFAULT_FILE_STORAGE=storages.backends.s3boto3.S3Boto3Storage
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2_key>
AWS_SECRET_ACCESS_KEY=<r2_secret>
AWS_STORAGE_BUCKET_NAME=dscar-homolog-media
AWS_S3_CUSTOM_DOMAIN=<r2_public_url_sem_https>
```

Rodar `docker compose` com `env_file: .env.r2.local` sobrescrevendo só o storage — sem alterar `dev.py`.

---

## Ordem de execução

1. **Cloudflare:** ativar R2 → criar bucket → gerar API Token (`Object Read & Write`) → configurar CORS
2. **Teste local R2:** `.env.r2.local` → subir Django → fazer upload de logo de seguradora → verificar no painel R2
3. **`homolog.py`:** settings completos com guards de segurança
4. **`backend/Dockerfile`:** se não existir
5. **`apps/dscar-web/Dockerfile`:** se não existir
6. **`docker-compose.homolog.yml`:** stack completa
7. **`.env.homolog.example`:** template documentado
8. **Coolify:** criar projeto → apontar repo → configurar env vars → primeiro deploy
9. **Pós-deploy:** `migrate_schemas` + criar tenant + seed Keycloak
10. **Smoke test:** login → criar OS → upload → verificar no R2

---

## Variáveis de ambiente (template homolog)

```bash
# Django
DJANGO_SETTINGS_MODULE=config.settings.homolog
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=api.homolog.paddock.solutions
DJANGO_DEBUG=False
FIELD_ENCRYPTION_KEY=

# Banco
DATABASE_URL=postgres://paddock:<senha>@postgres:5432/paddock

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1

# R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=dscar-homolog-media
R2_PUBLIC_URL=<sem https://>

# Keycloak
OIDC_OP_JWKS_ENDPOINT=https://auth.homolog.paddock.solutions/realms/paddock/protocol/openid-connect/certs
KEYCLOAK_CLIENT_ID=paddock-frontend
KEYCLOAK_CLIENT_SECRET=

# Fiscal
SEFAZ_ENV=homologation
FOCUSNFE_TOKEN=
FOCUS_NFE_WEBHOOK_SECRET=

# Frontend
BACKEND_URL=http://django:8000
NEXT_PUBLIC_API_URL=https://api.homolog.paddock.solutions
```

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| R2 sem CORS → uploads falham | Configurar CORS no bucket antes do primeiro teste |
| `FIELD_ENCRYPTION_KEY` diferente entre deploys | Fixar no Coolify, nunca regerar |
| Migrations sem backup | `pg_dump` antes de qualquer `migrate_schemas` |
| Keycloak realm perdido no redeploy | Volume persistente + `realm-export.json` no compose |
| Env vars sensíveis expostas | Nunca commitar `.env.*` — apenas `.example` |
