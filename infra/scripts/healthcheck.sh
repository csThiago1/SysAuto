#!/usr/bin/env bash
# =============================================================================
# Paddock Solutions — Healthcheck Pre-Deploy
# =============================================================================
#
# Valida que todos os serviços Docker estão healthy antes de um deploy.
# Retorna exit 0 se todos os checks passarem, exit 1 se algum falhar.
#
# Checks executados:
#   1. Docker services (postgres, redis, keycloak, django)
#   2. Django API responde em /api/schema/
#   3. Redis responde ao PING
#   4. PostgreSQL tem o schema tenant_dscar
#   5. Keycloak JWKS endpoint retorna JSON válido
#
# Uso:
#   bash infra/scripts/healthcheck.sh
#   bash infra/scripts/healthcheck.sh --quiet   (sem output colorido)
#
# Idempotente: pode ser executado múltiplas vezes sem efeitos colaterais.
# =============================================================================

set -euo pipefail

# ─── Configuração ─────────────────────────────────────────────────────────────

COMPOSE_FILE="$(dirname "$0")/../../infra/docker/docker-compose.dev.yml"

DJANGO_URL="${DJANGO_URL:-http://localhost:8000}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-paddock}"
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-paddock}
POSTGRES_DB="${POSTGRES_DB:-paddock_dev}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-paddock}"

TIMEOUT_CURL="${TIMEOUT_CURL:-5}"
QUIET="${QUIET:-false}"

# Serviços esperados no docker-compose (nome do container)
REQUIRED_CONTAINERS=(
    "paddock_postgres"
    "paddock_redis"
    "paddock_django"
)

# Keycloak é opcional — pode estar offline em alguns ambientes dev
OPTIONAL_CONTAINERS=(
    "paddock_keycloak"
)

# ─── Helpers de output ────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Desabilita cores se --quiet ou se não é terminal
if [[ "${QUIET}" == "true" ]] || [[ ! -t 1 ]]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

_log() {
    echo -e "${BLUE}[healthcheck]${NC} $*"
}

_pass() {
    local label="$1"
    local detail="${2:-}"
    local elapsed="${3:-}"
    local timing=""
    [[ -n "$elapsed" ]] && timing=" (${elapsed}ms)"
    echo -e "  ${GREEN}OK${NC}  ${label}${timing}"
    [[ -n "$detail" ]] && echo -e "       ${detail}"
}

_fail() {
    local label="$1"
    local detail="${2:-}"
    echo -e "  ${RED}FAIL${NC} ${label}"
    [[ -n "$detail" ]] && echo -e "       ${detail}"
}

_warn() {
    local label="$1"
    local detail="${2:-}"
    echo -e "  ${YELLOW}WARN${NC} ${label}"
    [[ -n "$detail" ]] && echo -e "       ${detail}"
}

_timer_start() {
    echo $(($(date +%s%N) / 1000000))
}

_timer_end() {
    local start="$1"
    local now=$(($(date +%s%N) / 1000000))
    echo $((now - start))
}

# ─── Rastreamento de falhas ────────────────────────────────────────────────────

FAILURES=0
WARNINGS=0

_record_fail() {
    FAILURES=$((FAILURES + 1))
}

_record_warn() {
    WARNINGS=$((WARNINGS + 1))
}

# ─── Check 1: Docker services healthy ────────────────────────────────────────

check_docker_services() {
    _log "Verificando containers Docker..."

    for container in "${REQUIRED_CONTAINERS[@]}"; do
        local t_start
        t_start=$(_timer_start)

        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")

        local elapsed
        elapsed=$(_timer_end "$t_start")

        case "$status" in
            "healthy")
                _pass "Docker: ${container}" "status=healthy" "$elapsed"
                ;;
            "starting")
                _warn "Docker: ${container}" "status=starting — aguardar inicialização completa"
                _record_warn
                ;;
            "unhealthy")
                _fail "Docker: ${container}" "status=unhealthy — verifique: docker logs ${container}"
                _record_fail
                ;;
            "not_found")
                _fail "Docker: ${container}" "container não encontrado — rode: make dev"
                _record_fail
                ;;
            *)
                # Containers sem healthcheck definido (ex: celery) reportam ""
                local running
                running=$(docker inspect --format='{{.State.Running}}' "$container" 2>/dev/null || echo "false")
                if [[ "$running" == "true" ]]; then
                    _pass "Docker: ${container}" "status=running (sem healthcheck)" "$elapsed"
                else
                    _fail "Docker: ${container}" "status=${status} — container não está rodando"
                    _record_fail
                fi
                ;;
        esac
    done

    # Containers opcionais — warn, não fail
    for container in "${OPTIONAL_CONTAINERS[@]}"; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")

        case "$status" in
            "healthy")
                _pass "Docker: ${container} (opcional)" "status=healthy"
                ;;
            "starting")
                _warn "Docker: ${container} (opcional)" "status=starting"
                _record_warn
                ;;
            "not_found" | "unhealthy" | "")
                _warn "Docker: ${container} (opcional)" "não está healthy — auth Keycloak indisponível"
                _record_warn
                ;;
        esac
    done
}

# ─── Check 2: Django /api/schema/ ────────────────────────────────────────────

check_django_api() {
    _log "Verificando Django API..."

    local t_start
    t_start=$(_timer_start)

    local http_code
    http_code=$(
        curl -s -o /dev/null \
             -w "%{http_code}" \
             --max-time "$TIMEOUT_CURL" \
             "${DJANGO_URL}/api/schema/" 2>/dev/null || echo "000"
    )

    local elapsed
    elapsed=$(_timer_end "$t_start")

    if [[ "$http_code" == "200" ]]; then
        _pass "Django: GET /api/schema/" "HTTP ${http_code}" "$elapsed"
    elif [[ "$http_code" == "000" ]]; then
        _fail "Django: GET /api/schema/" "timeout ou connection refused — ${DJANGO_URL} inacessível"
        _record_fail
    else
        _fail "Django: GET /api/schema/" "HTTP ${http_code} — esperado 200"
        _record_fail
    fi
}

# ─── Check 3: Redis PING ──────────────────────────────────────────────────────

check_redis() {
    _log "Verificando Redis..."

    local t_start
    t_start=$(_timer_start)

    local response
    response=$(
        docker exec paddock_redis redis-cli -h 127.0.0.1 -p 6379 PING 2>/dev/null || echo "ERROR"
    )

    local elapsed
    elapsed=$(_timer_end "$t_start")

    if [[ "$response" == "PONG" ]]; then
        _pass "Redis: PING" "response=PONG" "$elapsed"
    else
        _fail "Redis: PING" "response='${response}' — esperado PONG"
        _record_fail
    fi
}

# ─── Check 4: PostgreSQL schema tenant_dscar ─────────────────────────────────

check_postgres_tenant_schema() {
    _log "Verificando PostgreSQL + schema tenant_dscar..."

    local t_start
    t_start=$(_timer_start)

    # Executa query via docker exec (evita dependência de psql local)
    local result
    result=$(
        docker exec paddock_postgres \
            psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
            "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'tenant_dscar';" \
            2>/dev/null | tr -d '[:space:]' || echo "ERROR"
    )

    local elapsed
    elapsed=$(_timer_end "$t_start")

    if [[ "$result" == "1" ]]; then
        _pass "PostgreSQL: schema tenant_dscar" "schema existe e é acessível" "$elapsed"
    elif [[ "$result" == "0" ]]; then
        _fail "PostgreSQL: schema tenant_dscar" "schema não encontrado — rode: make migrate"
        _record_fail
    else
        _fail "PostgreSQL: schema tenant_dscar" "erro ao consultar: '${result}' — verifique o container postgres"
        _record_fail
    fi
}

# ─── Check 5: Keycloak JWKS endpoint ─────────────────────────────────────────

check_keycloak_jwks() {
    _log "Verificando Keycloak JWKS endpoint..."

    local jwks_url="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs"

    local t_start
    t_start=$(_timer_start)

    local response
    response=$(
        curl -s \
             --max-time "$TIMEOUT_CURL" \
             -H "Accept: application/json" \
             "$jwks_url" 2>/dev/null || echo ""
    )

    local elapsed
    elapsed=$(_timer_end "$t_start")

    if [[ -z "$response" ]]; then
        _warn "Keycloak: JWKS ${jwks_url}" "timeout ou connection refused — auth RS256 indisponível em dev"
        _record_warn
        return
    fi

    # Verifica que a resposta é JSON válido com a chave "keys"
    local is_valid_json
    is_valid_json=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('true' if 'keys' in data else 'no_keys')
except json.JSONDecodeError:
    print('false')
" 2>/dev/null || echo "false")

    case "$is_valid_json" in
        "true")
            _pass "Keycloak: JWKS endpoint" "JSON válido com campo 'keys'" "$elapsed"
            ;;
        "no_keys")
            _fail "Keycloak: JWKS endpoint" "JSON válido mas sem campo 'keys' — realm pode não estar configurado"
            _record_fail
            ;;
        "false")
            _fail "Keycloak: JWKS endpoint" "resposta não é JSON válido"
            _record_fail
            ;;
    esac
}

# ─── Sumário final ────────────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo "─────────────────────────────────────────"

    if [[ $FAILURES -eq 0 && $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}Todos os checks passaram.${NC} Deploy liberado."
    elif [[ $FAILURES -eq 0 ]]; then
        echo -e "${YELLOW}Checks passaram com ${WARNINGS} aviso(s).${NC} Deploy pode prosseguir."
    else
        echo -e "${RED}${FAILURES} check(s) falharam.${NC} Deploy BLOQUEADO."
        [[ $WARNINGS -gt 0 ]] && echo -e "  + ${WARNINGS} aviso(s) adicionais."
    fi

    echo "─────────────────────────────────────────"
    echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    echo ""
    echo "─────────────────────────────────────────"
    echo "  Paddock Solutions — Healthcheck"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "─────────────────────────────────────────"
    echo ""

    check_docker_services
    echo ""

    check_django_api
    echo ""

    check_redis
    echo ""

    check_postgres_tenant_schema
    echo ""

    check_keycloak_jwks

    print_summary

    # Exit code: 0 = tudo OK, 1 = há falhas críticas
    if [[ $FAILURES -gt 0 ]]; then
        exit 1
    fi

    exit 0
}

main "$@"
