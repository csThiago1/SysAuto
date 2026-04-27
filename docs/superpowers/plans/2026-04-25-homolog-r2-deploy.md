# Homolog — Cloudflare R2 + Docker Compose no Coolify

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir o ambiente de homologação completo (Django + Celery + Keycloak + Next.js) no Coolify com Cloudflare R2 como storage de media.

**Architecture:** `homolog.py` herda de `base.py` e configura R2 via `S3Boto3Storage` com endpoint Cloudflare. Backend servido por Daphne (ASGI), static files pelo WhiteNoise. Frontend Next.js com `output: standalone`. Um `docker-compose.homolog.yml` na raiz do repo gerenciado pelo Coolify.

**Tech Stack:** Django 5, Daphne 4, WhiteNoise 6, Cloudflare R2 (django-storages S3 backend), Next.js 15 standalone, Docker Compose, Coolify.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/core/requirements/prod.txt` | Modificar | Adicionar daphne + whitenoise |
| `backend/core/config/settings/homolog.py` | Criar | Settings de homolog/prod |
| `backend/core/entrypoint.sh` | Criar | Switch api/worker/beat |
| `backend/core/Dockerfile` | Criar | Imagem de produção Django |
| `apps/dscar-web/next.config.ts` | Modificar | output standalone + R2 remotePatterns |
| `apps/dscar-web/Dockerfile` | Criar | Imagem de produção Next.js |
| `docker-compose.homolog.yml` | Criar | Stack completa (raiz do repo) |
| `.env.homolog.example` | Criar | Template de variáveis |
| `.gitignore` | Modificar | Ignorar `.env.r2.local` |

---

## Task 1: Adicionar dependências de produção

**Files:**
- Modify: `backend/core/requirements/prod.txt`

- [ ] **Step 1: Adicionar daphne e whitenoise**

```txt
-r base.txt

# ─── ASGI server ──────────────────────────────────────────────────────────────
daphne==4.1.2

# ─── Static files ─────────────────────────────────────────────────────────────
whitenoise==6.8.2

# ─── WSGI server (fallback) ───────────────────────────────────────────────────
gunicorn==23.0.0
uvicorn[standard]==0.32.1

# ─── Healthcheck ─────────────────────────────────────────────────────────────
django-health-check==3.18.4
```

- [ ] **Step 2: Verificar que django-storages já está no base.txt**

```bash
grep "django-storages" backend/core/requirements/base.txt
```

Expected: `django-storages[s3]==1.14.4` ✅ (já existe)

- [ ] **Step 3: Commit**

```bash
git add backend/core/requirements/prod.txt
git commit -m "chore(infra): adiciona daphne e whitenoise ao prod.txt"
```

---

## Task 2: Testar R2 localmente

> Valida as credenciais R2 antes de qualquer código de settings.

**Files:**
- Create: `.env.r2.local` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Criar bucket no Cloudflare**

No painel Cloudflare → R2 → Create bucket → nome: `dscar-homolog-media` → região: APAC ou Auto.

- [ ] **Step 2: Gerar API Token R2**

Cloudflare → R2 → Manage R2 API Tokens → Create API Token → permissão: `Object Read & Write` → restringir ao bucket `dscar-homolog-media`.

Anotar:
- Account ID (aparece na sidebar do R2)
- Access Key ID
- Secret Access Key

- [ ] **Step 3: Configurar CORS no bucket**

No painel Cloudflare → R2 → `dscar-homolog-media` → Settings → CORS Policy → adicionar:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

(Depois de confirmar o domínio homolog, trocar `*` pelo domínio real.)

- [ ] **Step 4: Adicionar `.env.r2.local` ao .gitignore**

Abrir `.gitignore` na raiz e adicionar na seção de env files:
```
.env.r2.local
```

- [ ] **Step 5: Criar `.env.r2.local` com credenciais reais**

```bash
# .env.r2.local — NÃO COMMITAR
DEFAULT_FILE_STORAGE=storages.backends.s3boto3.S3Boto3Storage
AWS_S3_ENDPOINT_URL=https://<SEU_ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
AWS_STORAGE_BUCKET_NAME=dscar-homolog-media
AWS_S3_CUSTOM_DOMAIN=<pub-XXXXX.r2.dev ou custom domain sem https://>
AWS_DEFAULT_ACL=
AWS_QUERYSTRING_AUTH=False
AWS_S3_FILE_OVERWRITE=False
```

- [ ] **Step 6: Subir o Django dev com as vars R2**

```bash
# A partir de infra/docker/
docker compose -f docker-compose.dev.yml --env-file ../../.env.r2.local up django -d
```

Ou, se rodar fora do Docker:
```bash
cd backend/core
export $(cat ../../.env.r2.local | xargs)
python manage.py runserver --settings=config.settings.dev
```

- [ ] **Step 7: Fazer upload de uma logo de seguradora**

Acesse `http://localhost:3001/cadastros/seguradoras` → selecione uma seguradora → faça upload de um PNG.

- [ ] **Step 8: Verificar no painel R2**

Cloudflare → R2 → `dscar-homolog-media` → Objects. O arquivo deve aparecer sob o path `insurers/logos/`.

Verificar também que a URL pública retorna a imagem:
```
https://<AWS_S3_CUSTOM_DOMAIN>/insurers/logos/<uuid>.png
```

- [ ] **Step 9: Commit**

```bash
git add .gitignore
git commit -m "chore: ignora .env.r2.local (credenciais R2 local)"
```

---

## Task 3: Criar `homolog.py`

**Files:**
- Create: `backend/core/config/settings/homolog.py`

- [ ] **Step 1: Criar o arquivo**

```python
"""
Paddock Solutions — Django Settings Homolog
Herda de base.py. Base para prod.py futuro.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

DEBUG = False

# ─── Auth — apenas Keycloak RS256 em homolog ─────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.backends.KeycloakJWTAuthentication",
    ],
}

# ─── Storage — Cloudflare R2 ─────────────────────────────────────────────────
_R2_ACCOUNT_ID = config("R2_ACCOUNT_ID", default="")  # type: ignore[name-defined]
_R2_PUBLIC_URL = config("R2_PUBLIC_URL", default="")  # type: ignore[name-defined]

DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_ENDPOINT_URL = f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
AWS_ACCESS_KEY_ID = config("R2_ACCESS_KEY_ID", default="")  # type: ignore[name-defined]
AWS_SECRET_ACCESS_KEY = config("R2_SECRET_ACCESS_KEY", default="")  # type: ignore[name-defined]
AWS_STORAGE_BUCKET_NAME = config("R2_BUCKET_NAME", default="")  # type: ignore[name-defined]
AWS_S3_CUSTOM_DOMAIN = _R2_PUBLIC_URL  # sem "https://"
AWS_DEFAULT_ACL = None          # R2 não suporta ACLs
AWS_QUERYSTRING_AUTH = False    # URLs públicas
AWS_S3_FILE_OVERWRITE = False   # nunca sobrescrever uploads

# ─── Static files — WhiteNoise ────────────────────────────────────────────────
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_ROOT = BASE_DIR / "staticfiles"  # type: ignore[name-defined]

# WhiteNoise logo após SecurityMiddleware
MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ─── Segurança ────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ─── Fiscal — ambiente de homologação ────────────────────────────────────────
# SEFAZ_ENV herdado de base.py via env var (default="homologation") — não alterar aqui.

# ─── Guards — falha imediata se vars críticas estiverem ausentes ──────────────
_REQUIRED_VARS = {
    "DJANGO_SECRET_KEY": config("DJANGO_SECRET_KEY", default=""),  # type: ignore[name-defined]
    "FIELD_ENCRYPTION_KEY": config("FIELD_ENCRYPTION_KEY", default=""),  # type: ignore[name-defined]
    "R2_ACCOUNT_ID": _R2_ACCOUNT_ID,
    "R2_ACCESS_KEY_ID": AWS_ACCESS_KEY_ID,
    "R2_SECRET_ACCESS_KEY": AWS_SECRET_ACCESS_KEY,
    "R2_BUCKET_NAME": AWS_STORAGE_BUCKET_NAME,
}

for _var, _val in _REQUIRED_VARS.items():
    if not _val:
        raise ImproperlyConfigured(
            f"[homolog] Variável obrigatória não configurada: {_var}"
        )
```

- [ ] **Step 2: Verificar que não há erro de import**

```bash
cd backend/core
DJANGO_SETTINGS_MODULE=config.settings.homolog \
DJANGO_SECRET_KEY=test FIELD_ENCRYPTION_KEY=test \
R2_ACCOUNT_ID=test R2_ACCESS_KEY_ID=test \
R2_SECRET_ACCESS_KEY=test R2_BUCKET_NAME=test \
python -c "import django; django.setup(); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/core/config/settings/homolog.py
git commit -m "feat(infra): homolog.py — settings R2 + whitenoise + guards"
```

---

## Task 4: Criar `Dockerfile` do backend

**Files:**
- Create: `backend/core/entrypoint.sh`
- Create: `backend/core/Dockerfile`

- [ ] **Step 1: Criar `entrypoint.sh`**

```bash
#!/bin/sh
set -e

case "$1" in
  api)
    echo "[entrypoint] Coletando arquivos estáticos..."
    python manage.py collectstatic --noinput
    echo "[entrypoint] Iniciando Daphne..."
    exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
    ;;
  worker)
    exec celery -A config worker \
      --loglevel=info \
      --concurrency=4 \
      -Q celery,fiscal,crm,ai
    ;;
  beat)
    exec celery -A config beat \
      --loglevel=info \
      --scheduler django_celery_beat.schedulers:DatabaseScheduler
    ;;
  *)
    exec "$@"
    ;;
esac
```

- [ ] **Step 2: Criar `Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python (layer cacheável)
COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Código da aplicação
COPY . .

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.homolog

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]
```

- [ ] **Step 3: Build local para validar**

```bash
cd backend/core
docker build -f Dockerfile -t paddock-django:homolog .
```

Expected: build completa sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/core/Dockerfile backend/core/entrypoint.sh
git commit -m "feat(infra): Dockerfile de produção Django com Daphne"
```

---

## Task 5: Criar `Dockerfile` do frontend

**Files:**
- Modify: `apps/dscar-web/next.config.ts`
- Create: `apps/dscar-web/Dockerfile`

- [ ] **Step 1: Adicionar `output: standalone` e R2 ao `next.config.ts`**

```typescript
import path from "path";
import type { NextConfig } from "next";

// R2_PUBLIC_URL pode ser domínio custom (media.homolog.paddock.solutions)
// ou URL pública R2 padrão (pub-xxxxx.r2.dev). Nunca incluir "https://".
const r2Hostname = process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, "") ?? "";

const nextConfig: NextConfig = {
    output: "standalone",
    transpilePackages: ["@paddock/ui", "@paddock/types", "@paddock/auth"],
    experimental: {
        typedRoutes: true,
        outputFileTracingRoot: path.join(__dirname, "../../"),
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.amazonaws.com",
            },
            {
                protocol: "https",
                hostname: "**.r2.dev",
            },
            // Custom domain do R2 (ex: media.homolog.paddock.solutions)
            ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname }] : []),
        ],
    },
    async rewrites() {
        return [
            {
                source: "/media/:path*",
                destination: "http://localhost:8000/media/:path*",
            },
        ];
    },
};

export default nextConfig;
```

- [ ] **Step 2: Criar `apps/dscar-web/Dockerfile`**

```dockerfile
# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /repo

# Instala dependências a partir da raiz do monorepo (Turborepo workspace)
COPY package.json package-lock.json turbo.json ./
COPY apps/dscar-web/package.json apps/dscar-web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/utils/package.json packages/utils/

RUN npm ci

# Copia código fonte
COPY apps/dscar-web/ apps/dscar-web/
COPY packages/ packages/

# Build args para vars públicas do Next.js (baked in no build)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG R2_PUBLIC_URL
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL

RUN npm run build --workspace=apps/dscar-web

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Standalone output inclui apenas o necessário para runtime
COPY --from=builder /repo/apps/dscar-web/.next/standalone ./
COPY --from=builder /repo/apps/dscar-web/.next/static ./apps/dscar-web/.next/static
COPY --from=builder /repo/apps/dscar-web/public ./apps/dscar-web/public

EXPOSE 3000

CMD ["node", "apps/dscar-web/server.js"]
```

- [ ] **Step 3: Verificar que o workspace script existe**

```bash
cat package.json | grep -A5 '"workspaces"'
```

Expected: `apps/*` e `packages/*` listados como workspaces.

- [ ] **Step 4: Build local para validar**

```bash
# A partir da raiz do repo
docker build \
  -f apps/dscar-web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.homolog.paddock.solutions \
  --build-arg R2_PUBLIC_URL=pub-xxxxx.r2.dev \
  -t paddock-nextjs:homolog \
  .
```

Expected: build completa, imagem ~200MB.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/next.config.ts apps/dscar-web/Dockerfile
git commit -m "feat(infra): Dockerfile Next.js standalone + output config"
```

---

## Task 6: Criar `docker-compose.homolog.yml` e template de env

**Files:**
- Create: `docker-compose.homolog.yml` (raiz do repo)
- Create: `.env.homolog.example`

- [ ] **Step 1: Criar `docker-compose.homolog.yml`**

```yaml
# docker-compose.homolog.yml
# Deploy: docker compose -f docker-compose.homolog.yml up -d
# Gerenciado pelo Coolify via SSH.

services:

  # ─── PostgreSQL 16 + pgvector ─────────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis 7 ──────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Keycloak 24 ──────────────────────────────────────────────────────────
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    restart: unless-stopped
    command: start --import-realm --health-enabled=true
    environment:
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      KC_DB_USERNAME: ${POSTGRES_USER}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KC_DB_SCHEMA: keycloak
      KC_HOSTNAME: ${KEYCLOAK_HOSTNAME}
      KC_PROXY: edge
      KC_HTTP_ENABLED: "true"
      KC_HEALTH_ENABLED: "true"
    volumes:
      - ./infra/docker/keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json
      - ./infra/docker/keycloak/themes/paddock:/opt/keycloak/themes/paddock
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 && echo -e 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && cat <&3 | grep -q '\"status\": \"UP\"'"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 90s

  # ─── Django — API ASGI (Daphne) ────────────────────────────────────────────
  django:
    build:
      context: backend/core
      dockerfile: Dockerfile
    image: paddock-django:homolog
    restart: unless-stopped
    command: api
    env_file: .env.homolog
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/api/schema/')\""]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  # ─── Celery Worker ────────────────────────────────────────────────────────
  celery-worker:
    image: paddock-django:homolog
    restart: unless-stopped
    command: worker
    env_file: .env.homolog
    depends_on:
      django:
        condition: service_started
      redis:
        condition: service_healthy

  # ─── Celery Beat ──────────────────────────────────────────────────────────
  celery-beat:
    image: paddock-django:homolog
    restart: unless-stopped
    command: beat
    env_file: .env.homolog
    depends_on:
      django:
        condition: service_started
      redis:
        condition: service_healthy

  # ─── Next.js — Frontend ───────────────────────────────────────────────────
  nextjs:
    build:
      context: .
      dockerfile: apps/dscar-web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        R2_PUBLIC_URL: ${R2_PUBLIC_URL}
    image: paddock-nextjs:homolog
    restart: unless-stopped
    environment:
      BACKEND_URL: http://django:8000
    depends_on:
      django:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: paddock_homolog
```

- [ ] **Step 2: Criar `.env.homolog.example`**

```bash
# .env.homolog.example — copiar para .env.homolog e preencher
# NUNCA commitar .env.homolog

# ─── Django ──────────────────────────────────────────────────────────────────
DJANGO_SETTINGS_MODULE=config.settings.homolog
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=api.homolog.paddock.solutions
DJANGO_DEBUG=False

# ─── Criptografia (LGPD) ─────────────────────────────────────────────────────
FIELD_ENCRYPTION_KEY=                        # Fernet key — gerar com: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# ─── Banco de dados ───────────────────────────────────────────────────────────
DATABASE_URL=postgres://paddock:<senha>@postgres:5432/paddock_homolog
POSTGRES_USER=paddock
POSTGRES_PASSWORD=
POSTGRES_DB=paddock_homolog

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
DJANGO_CHANNELS_LAYER_URL=redis://redis:6379/2

# ─── Cloudflare R2 ───────────────────────────────────────────────────────────
R2_ACCOUNT_ID=                               # Cloudflare Account ID
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=dscar-homolog-media
R2_PUBLIC_URL=                               # sem https:// (ex: pub-xxxxx.r2.dev)

# ─── Keycloak ────────────────────────────────────────────────────────────────
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=
KEYCLOAK_HOSTNAME=auth.homolog.paddock.solutions
KEYCLOAK_CLIENT_ID=paddock-frontend
KEYCLOAK_CLIENT_SECRET=
OIDC_OP_JWKS_ENDPOINT=https://auth.homolog.paddock.solutions/realms/paddock/protocol/openid-connect/certs

# ─── Fiscal ──────────────────────────────────────────────────────────────────
SEFAZ_ENV=homologation
FOCUSNFE_TOKEN=
FOCUS_NFE_WEBHOOK_SECRET=                    # gerar com: openssl rand -hex 32

# ─── Frontend ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=https://api.homolog.paddock.solutions
```

- [ ] **Step 3: Adicionar `.env.homolog` ao .gitignore**

```
.env.homolog
.env.r2.local
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.homolog.yml .env.homolog.example .gitignore
git commit -m "feat(infra): docker-compose.homolog + template de env vars"
```

---

## Task 7: Deploy no Coolify

> Passos operacionais — executados no servidor, não no código.

- [ ] **Step 1: Provisionar VPS e instalar Coolify**

```bash
# SSH no VPS (Ubuntu 22.04+, mínimo 2 vCPU / 4GB RAM)
ssh root@<IP_DO_VPS>

# Instalar Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Acessar Coolify em `http://<IP_DO_VPS>:8000` e criar conta admin.

- [ ] **Step 2: Adicionar o repositório no Coolify**

Coolify → New Resource → Docker Compose → apontar para o repo → branch: `ciclo-07-cadastros-unificados` (ou `main`) → Compose file: `docker-compose.homolog.yml`.

- [ ] **Step 3: Configurar env vars no Coolify**

Na UI do Coolify → Environment Variables → copiar cada variável do `.env.homolog.example` e preencher com os valores reais.

Variáveis críticas a gerar antes:
```bash
# FIELD_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# DJANGO_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(50))"

# FOCUS_NFE_WEBHOOK_SECRET
openssl rand -hex 32
```

- [ ] **Step 4: Configurar domínios no Coolify**

Para cada service, adicionar o domínio via Coolify (Traefik gerencia automaticamente SSL via Let's Encrypt):
- `django` → `api.homolog.paddock.solutions`
- `nextjs` → `homolog.paddock.solutions`
- `keycloak` → `auth.homolog.paddock.solutions`

Apontar os DNS A records para o IP do VPS antes de fazer deploy.

- [ ] **Step 5: Primeiro deploy**

Coolify → Deploy. Acompanhar logs em tempo real.

- [ ] **Step 6: Rodar migrations e criar tenant**

```bash
# Identificar o container django
docker ps | grep django

# Rodar migrations
docker exec <container_id> python manage.py migrate_schemas --settings=config.settings.homolog

# Criar tenant DS Car
docker exec -it <container_id> python manage.py shell --settings=config.settings.homolog
```

```python
from apps.tenants.models import Company, Domain

company = Company.objects.create(
    schema_name="tenant_dscar",
    name="DS Car Centro Automotivo",
    slug="dscar",
    on_trial=True,
)
Domain.objects.create(
    domain="dscar.homolog.paddock.solutions",
    tenant=company,
    is_primary=True,
)
```

- [ ] **Step 7: Smoke test**

1. Acesse `https://homolog.paddock.solutions` → tela de login Keycloak
2. Login com `admin@paddock.solutions / admin123`
3. Crie uma OS → deve funcionar
4. Faça upload de uma logo de seguradora → verificar no painel R2 que o arquivo aparece em `insurers/logos/`
5. Checar URL da imagem: deve ser `https://<R2_PUBLIC_URL>/insurers/logos/<uuid>.png`

---

## Checklist final pré-deploy

- [ ] `FIELD_ENCRYPTION_KEY` gerado e salvo com segurança (se perder, dados criptografados são irrecuperáveis)
- [ ] DNS A records apontados para o VPS
- [ ] Bucket R2 criado com CORS configurado
- [ ] Keycloak `realm-export.json` commitado no repo (`infra/docker/keycloak/`)
- [ ] `.env.homolog` **não** commitado (só o `.example`)
- [ ] `make lint` e `make typecheck` passando na branch
