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
