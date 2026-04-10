#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-users.sh — Gerencia usuários do realm paddock no Keycloak
#
# Uso:
#   ./seed-users.sh list                                      → lista todos os usuários
#   ./seed-users.sh create <email> <senha> <role> [company]   → cria usuário com atributos de tenant
#   ./seed-users.sh reset-password <email> <senha>            → reseta senha
#   ./seed-users.sh delete <email>                            → remove usuário
#   ./seed-users.sh set-tenant <email> [company]              → atualiza atributos de tenant
#
# Roles disponíveis: ADMIN | MANAGER | CONSULTANT | STOREKEEPER
# Company (default: dscar): dscar | pecas | vidros | estetica
#
# Exemplos:
#   ./seed-users.sh create joao@dscar.com Senha123! CONSULTANT
#   ./seed-users.sh create maria@pecas.com Senha123! MANAGER pecas
#   ./seed-users.sh set-tenant joao@dscar.com dscar
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="paddock"
ADMIN_USER="admin"
ADMIN_PASS="admin"

# ── auth ──────────────────────────────────────────────────────────────────────
get_token() {
  curl -sf -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -d "grant_type=password&client_id=admin-cli&username=$ADMIN_USER&password=$ADMIN_PASS" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])"
}

# ── helpers ───────────────────────────────────────────────────────────────────
get_user_id() {
  local token="$1" email="$2"
  curl -sf "$KEYCLOAK_URL/admin/realms/$REALM/users?email=$email" \
    -H "Authorization: Bearer $token" \
    | python3 -c "import json,sys; u=json.load(sys.stdin); print(u[0]['id'] if u else '')"
}

get_role_id() {
  local token="$1" role="$2"
  curl -sf "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role" \
    -H "Authorization: Bearer $token" \
    | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('id',''))"
}

# ── commands ──────────────────────────────────────────────────────────────────
cmd_list() {
  local token; token=$(get_token)
  echo "Usuários no realm '$REALM':"
  curl -sf "$KEYCLOAK_URL/admin/realms/$REALM/users?max=100" \
    -H "Authorization: Bearer $token" \
    | python3 -c "
import json, sys
users = json.load(sys.stdin)
for u in users:
    print(f'  {u[\"username\"]:<40} enabled={u[\"enabled\"]}')
print(f'\nTotal: {len(users)}')
"
}

cmd_create() {
  local email="$1" senha="$2" role="$3" company="${4:-dscar}"
  local tenant_schema="tenant_${company}"
  local client_slug="grupo-dscar"
  local token; token=$(get_token)

  echo "Criando usuário: $email (role: $role, company: $company)..."

  # Cria usuário com atributos de tenant
  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$email\",
      \"email\": \"$email\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"credentials\": [{\"type\":\"password\",\"value\":\"$senha\",\"temporary\":false}],
      \"attributes\": {
        \"active_company\": [\"$company\"],
        \"tenant_schema\": [\"$tenant_schema\"],
        \"client_slug\": [\"$client_slug\"],
        \"companies\": [\"$company\"]
      }
    }")

  if [ "$HTTP" = "201" ]; then
    echo "  ✓ Usuário criado com atributos de tenant"
  else
    echo "  ✗ Erro HTTP $HTTP (usuário já existe?)"
    exit 1
  fi

  # Busca o ID
  local user_id; user_id=$(get_user_id "$token" "$email")
  [ -z "$user_id" ] && { echo "  ✗ Não encontrou ID do usuário"; exit 1; }

  # Atribui role
  local role_id; role_id=$(get_role_id "$token" "$role")
  [ -z "$role_id" ] && { echo "  ✗ Role '$role' não encontrada"; exit 1; }

  curl -sf -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "[{\"id\":\"$role_id\",\"name\":\"$role\"}]"

  echo "  ✓ Role '$role' atribuída"
  echo "  → Login: $email / $senha"
  echo "  → Tenant: $company (schema: $tenant_schema)"
}

cmd_reset_password() {
  local email="$1" senha="$2"
  local token; token=$(get_token)
  local user_id; user_id=$(get_user_id "$token" "$email")
  [ -z "$user_id" ] && { echo "Usuário '$email' não encontrado"; exit 1; }

  curl -sf -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/reset-password" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"password\",\"value\":\"$senha\",\"temporary\":false}"

  echo "✓ Senha de '$email' atualizada"
}

cmd_delete() {
  local email="$1"
  local token; token=$(get_token)
  local user_id; user_id=$(get_user_id "$token" "$email")
  [ -z "$user_id" ] && { echo "Usuário '$email' não encontrado"; exit 1; }

  curl -sf -X DELETE \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id" \
    -H "Authorization: Bearer $token"

  echo "✓ Usuário '$email' removido"
}

# Atualiza atributos de tenant em usuário existente
cmd_set_tenant() {
  local email="$1" company="${2:-dscar}"
  local tenant_schema="tenant_${company}"
  local token; token=$(get_token)
  local user_id; user_id=$(get_user_id "$token" "$email")
  [ -z "$user_id" ] && { echo "Usuário '$email' não encontrado"; exit 1; }

  curl -sf -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{
      \"attributes\": {
        \"active_company\": [\"$company\"],
        \"tenant_schema\": [\"tenant_${company}\"],
        \"client_slug\": [\"grupo-dscar\"],
        \"companies\": [\"$company\"]
      }
    }"

  echo "✓ Atributos de tenant de '$email' atualizados → $company"
}

# ── dispatch ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  list)             cmd_list ;;
  create)           cmd_create "$2" "$3" "$4" "${5:-dscar}" ;;
  reset-password)   cmd_reset_password "$2" "$3" ;;
  delete)           cmd_delete "$2" ;;
  set-tenant)       cmd_set_tenant "$2" "${3:-dscar}" ;;
  *)
    echo "Uso: $0 list | create <email> <senha> <role> [company] | reset-password <email> <senha> | delete <email> | set-tenant <email> [company]"
    echo "Roles: ADMIN | MANAGER | CONSULTANT | STOREKEEPER"
    echo "Company (default: dscar): dscar | pecas | vidros | estetica"
    exit 1 ;;
esac
