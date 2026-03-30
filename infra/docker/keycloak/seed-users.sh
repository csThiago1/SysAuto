#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-users.sh — Gerencia usuários do realm paddock no Keycloak
#
# Uso:
#   ./seed-users.sh list                             → lista todos os usuários
#   ./seed-users.sh create <email> <senha> <role>    → cria usuário
#   ./seed-users.sh reset-password <email> <senha>   → reseta senha
#   ./seed-users.sh delete <email>                   → remove usuário
#
# Roles disponíveis: ADMIN | MANAGER | CONSULTANT | STOREKEEPER
#
# Exemplo:
#   ./seed-users.sh create joao@dscar.com Senha123! CONSULTANT
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
  local email="$1" senha="$2" role="$3"
  local token; token=$(get_token)

  echo "Criando usuário: $email (role: $role)..."

  # Cria usuário
  HTTP=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$email\",
      \"email\": \"$email\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"credentials\": [{\"type\":\"password\",\"value\":\"$senha\",\"temporary\":false}]
    }")

  if [ "$HTTP" = "201" ]; then
    echo "  ✓ Usuário criado"
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

# ── dispatch ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  list)             cmd_list ;;
  create)           cmd_create "$2" "$3" "$4" ;;
  reset-password)   cmd_reset_password "$2" "$3" ;;
  delete)           cmd_delete "$2" ;;
  *)
    echo "Uso: $0 list | create <email> <senha> <role> | reset-password <email> <senha> | delete <email>"
    echo "Roles: ADMIN | MANAGER | CONSULTANT | STOREKEEPER"
    exit 1 ;;
esac
