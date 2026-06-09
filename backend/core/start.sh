#!/usr/bin/env sh
# Paddock Solutions — start script unificado (Railway + Procfile + railpack)
# Variáveis de ambiente:
#   SKIP_MIGRATIONS  — "true" para pular migrate_schemas no boot (deploys de hotfix)
#   GUNICORN_WORKERS — default 3
#   GUNICORN_TIMEOUT — default 30
set -e

if [ "${SKIP_MIGRATIONS:-}" != "true" ]; then
  # --executor=multiprocessing paraleliza migrations entre schemas (ganho real com 3+ tenants)
  python manage.py migrate_schemas --noinput --executor=multiprocessing
else
  echo "[start] SKIP_MIGRATIONS=true — pulando migrate_schemas"
fi

# Idempotente — cria public/tenant_dscar/admin se ainda não existem
python setup_tenant.py

# --max-requests recicla workers a cada N requests (mitiga memory leaks comuns em Django)
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-30}" \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --access-logfile -
