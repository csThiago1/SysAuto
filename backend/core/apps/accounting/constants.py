"""Constantes de domínio financeiro/contábil compartilhadas.

Consistência de precisão pra novos campos monetários. Campos existentes
usam valores diversos por herança histórica (10/12/14/18) — não migrar
sem motivo, mas código novo deve seguir esses padrões.
"""

# ─── Dinheiro (BRL) ──────────────────────────────────────────────────────────
# max_digits=14 comporta até R$ 999.999.999.999,99 (~1 trilhão), suficiente
# pra qualquer operação DS Car sem sobra excessiva.

MONEY_MAX_DIGITS = 14
MONEY_DECIMAL_PLACES = 2


# ─── Quantidades ─────────────────────────────────────────────────────────────
# Peças, litros, horas. Precisão 4 casas comporta gramas, mL, minutos.
# Usar em campos de estoque, notas fiscais, cotas de material.

QUANTITY_MAX_DIGITS = 12
QUANTITY_DECIMAL_PLACES = 4


# ─── Percentuais (0-100) ─────────────────────────────────────────────────────
# Margens, IPI/ICMS, descontos percentuais.

PERCENT_MAX_DIGITS = 6
PERCENT_DECIMAL_PLACES = 2


# ─── Kwargs prontos pra models.DecimalField(**MONEY_FIELD_KWARGS) ────────────

MONEY_FIELD_KWARGS = {
    "max_digits": MONEY_MAX_DIGITS,
    "decimal_places": MONEY_DECIMAL_PLACES,
}

QUANTITY_FIELD_KWARGS = {
    "max_digits": QUANTITY_MAX_DIGITS,
    "decimal_places": QUANTITY_DECIMAL_PLACES,
}

PERCENT_FIELD_KWARGS = {
    "max_digits": PERCENT_MAX_DIGITS,
    "decimal_places": PERCENT_DECIMAL_PLACES,
}
