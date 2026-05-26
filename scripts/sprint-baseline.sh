#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.dev.yml}"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

section() {
  printf "\n==> %s\n" "$1"
}

if [[ -z "$("${COMPOSE[@]}" ps -q django 2>/dev/null)" ]]; then
  printf "Django container is not running. Start it with: make dev\n" >&2
  exit 1
fi

section "Django system check"
"${COMPOSE[@]}" exec -T django python manage.py check --settings=config.settings.dev

section "Pytest collection"
"${COMPOSE[@]}" exec -T django pytest --collect-only -q

section "Monorepo TypeScript typecheck"
npm run typecheck

section "Sprint baseline complete"
