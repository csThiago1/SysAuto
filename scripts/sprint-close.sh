#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# sprint-close.sh — Fecha sprint com commits por domínio
#
# Uso:
#   ./scripts/sprint-close.sh [numero_sprint]
#   make sprint-close SPRINT=14
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Número da sprint ──────────────────────────────────────────────────────────
SPRINT="${1:-}"
if [[ -z "$SPRINT" ]]; then
  # Tenta extrair do CLAUDE.md (linha "Sprint XX")
  SPRINT=$(grep -oP 'Sprint \K\d+' CLAUDE.md 2>/dev/null | head -1 || true)
fi
if [[ -z "$SPRINT" ]]; then
  read -rp "Número da sprint: " SPRINT
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Fechando Sprint $SPRINT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Guarda de dados sensíveis ─────────────────────────────────────────────────
SENSITIVE=$(git status --porcelain | grep -E '\.(csv|xls|xlsx)$|Relatorio.*\.txt' || true)
if [[ -n "$SENSITIVE" ]]; then
  echo ""
  echo "⚠️  Arquivos sensíveis detectados — NÃO serão commitados:"
  echo "$SENSITIVE"
  echo "(Verifique o .gitignore se quiser excluí-los permanentemente)"
fi

# ── Domínios e seus caminhos ──────────────────────────────────────────────────
# Formato: "dominio|conv_commits_prefix|paths separados por espaço"
DOMAINS=(
  "hr|feat(hr)|backend/core/apps/hr backend/core/apps/experts apps/dscar-web/src/app/(app)/rh apps/dscar-web/src/hooks/useHR.ts packages/types/src/hr.types.ts docs/sprint-*hr*"
  "os|feat(os)|backend/core/apps/service_orders apps/dscar-web/src/app/(app)/os apps/dscar-web/src/app/(app)/service-orders apps/dscar-web/src/features/create-os apps/dscar-web/src/hooks/useOverdueOrders.ts apps/dscar-web/src/hooks/useServiceOrders.ts apps/dscar-web/src/hooks/useClientOrders.ts packages/types/src/service-order.types.ts docs/sprint-*os*"
  "accounting|feat(accounting)|backend/core/apps/accounting backend/core/apps/accounts_payable backend/core/apps/accounts_receivable apps/dscar-web/src/app/(app)/financeiro apps/dscar-web/src/hooks/useAccounting.ts apps/dscar-web/src/hooks/useFinanceiro.ts packages/types/src/accounting.types.ts packages/types/src/financeiro.types.ts docs/sprint-*accounting* docs/spec-financial*"
  "auth|fix(auth)|backend/core/apps/authentication apps/dscar-web/src/lib/auth.ts apps/dscar-web/src/middleware.ts infra/docker/keycloak packages/auth/src packages/types/src/auth.types.ts docs/sprint-*auth*"
  "persons|feat(persons)|backend/core/apps/persons backend/core/apps/crm apps/dscar-web/src/app/(app)/cadastros apps/dscar-web/src/hooks/usePersons.ts apps/dscar-web/src/hooks/usePersonMutations.ts apps/dscar-web/src/hooks/useMe.ts packages/types/src/person.types.ts"
  "cilia|feat(cilia)|backend/core/apps/cilia apps/dscar-web/src/features/create-os/CiliaImportPanel.tsx"
  "vehicles|feat(vehicles)|backend/core/apps/vehicle_catalog backend/core/apps/insurers packages/types/src/vehicle.types.ts packages/types/src/insurer.types.ts apps/dscar-web/src/app/api/plate"
  "ui|feat(ui)|apps/dscar-web/src/components/ui apps/dscar-web/src/components/AppHeader.tsx apps/dscar-web/src/components/Sidebar.tsx apps/dscar-web/src/app/globals.css apps/dscar-web/src/lib/design-tokens.ts apps/dscar-web/src/app/(app)/dashboard/_components"
)

COMMITTED=0

# ── Itera sobre domínios ──────────────────────────────────────────────────────
for entry in "${DOMAINS[@]}"; do
  IFS='|' read -r domain prefix paths <<< "$entry"

  # Verifica se há arquivos modificados nesse domínio
  HAS_CHANGES=0
  # shellcheck disable=SC2086
  for p in $paths; do
    if git status --porcelain -- $p 2>/dev/null | grep -qvE '^\?\? .*(\.csv|\.xls|Relatorio)'; then
      HAS_CHANGES=1
      break
    fi
  done

  [[ $HAS_CHANGES -eq 0 ]] && continue

  echo ""
  echo "┌─ Domínio: $domain ─────────────────────────────"
  # shellcheck disable=SC2086
  git status --short -- $paths 2>/dev/null | head -15
  echo "└─────────────────────────────────────────────────"
  read -rp "  Criar commit $prefix? [S/n/m=mensagem própria] " ans

  [[ "$ans" =~ ^[Nn]$ ]] && continue

  # Monta mensagem padrão ou customizada
  if [[ "$ans" == m* || "$ans" == M* ]]; then
    read -rp "  Mensagem: $prefix: " custom_msg
    COMMIT_MSG="$prefix: $custom_msg"
  else
    COMMIT_MSG="$prefix: sprint $SPRINT — alterações"
  fi

  # Stage arquivos do domínio (ignora erros de path inexistente)
  # shellcheck disable=SC2086
  git add -- $paths 2>/dev/null || true

  if git diff --cached --quiet; then
    echo "  (nada para commitar neste domínio)"
    continue
  fi

  git commit -m "$(printf '%s\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>' "$COMMIT_MSG")"
  COMMITTED=$((COMMITTED + 1))
  echo "  ✓ Commit criado"
done

# ── Restante (deps, config, docs) ─────────────────────────────────────────────
REMAINING=$(git status --porcelain | grep -vcE '\.(csv|xls|xlsx)$|Relatorio.*\.txt' || true)
if [[ "$REMAINING" -gt 0 ]]; then
  echo ""
  echo "┌─ Restante (deps, config, docs) ─────────────────"
  git status --short | grep -vE '\.(csv|xls|xlsx)$|Relatorio' | head -20
  echo "└─────────────────────────────────────────────────"
  read -rp "  Criar commit chore? [S/n] " ans

  if [[ ! "$ans" =~ ^[Nn]$ ]]; then
    git add -A
    # Remove arquivos sensíveis se foram adicionados por engano
    git reset HEAD -- '*.csv' '*.xls' '*.xlsx' 2>/dev/null || true

    if ! git diff --cached --quiet; then
      git commit -m "$(printf 'chore: sprint %s — deps, config e documentação\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>' "$SPRINT")"
      COMMITTED=$((COMMITTED + 1))
      echo "  ✓ Commit criado"
    fi
  fi
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Sprint $SPRINT fechada — $COMMITTED commits"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log --oneline -"$((COMMITTED + 1))"

echo ""
read -rp "Push para origin/main? [s/N] " push_ans
if [[ "$push_ans" =~ ^[Ss]$ ]]; then
  git push origin main
  echo "✓ Push realizado."
fi
