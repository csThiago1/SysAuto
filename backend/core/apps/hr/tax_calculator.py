"""
Paddock Solutions — HR: Cálculo de Impostos Trabalhistas Brasileiros

Tabelas vigentes 2024/2025 (Portaria MF nº 3/2024).

INSS (empregado): tabela progressiva — cada faixa incide apenas sobre
    o valor dentro da faixa, não sobre o total (igual ao IR).
IRRF: calculado sobre (salário bruto - INSS retido), tabela progressiva
    com deduções por dependente.
FGTS: 8% do salário bruto — obrigação patronal, não desconta do empregado,
    mas deve aparecer no contracheque como informativo.

Referências:
    https://www.gov.br/esocial/pt-br/documentacao-tecnica/tabelas
    IN RFB nº 2.141/2023 + atualizações 2024
"""
from decimal import Decimal, ROUND_HALF_UP

# ── INSS 2024: tabela progressiva ─────────────────────────────────────────────
# (limite_superior, aliquota)  — None = sem teto na última faixa
_INSS_TABELA = [
    (Decimal("1412.00"),  Decimal("0.075")),
    (Decimal("2666.68"),  Decimal("0.09")),
    (Decimal("4000.03"),  Decimal("0.12")),
    (Decimal("7786.02"),  Decimal("0.14")),
]

# ── IRRF 2024/2025 ────────────────────────────────────────────────────────────
# (limite_superior, aliquota, deducao_fixa)  — None = sem teto
_IRRF_TABELA = [
    (Decimal("2259.20"),  Decimal("0.00"),  Decimal("0.00")),
    (Decimal("2826.65"),  Decimal("0.075"), Decimal("169.44")),
    (Decimal("3751.05"),  Decimal("0.15"),  Decimal("381.44")),
    (Decimal("4664.68"),  Decimal("0.225"), Decimal("662.77")),
    (None,                Decimal("0.275"), Decimal("896.00")),
]

_IRRF_DEDUCAO_DEPENDENTE = Decimal("189.59")   # por dependente/mês
_FGTS_ALIQUOTA            = Decimal("0.08")     # 8% — patronal (informativo)


def calcular_inss(salario_bruto: Decimal) -> Decimal:
    """
    Calcula INSS do empregado pela tabela progressiva 2024.

    Cada faixa incide apenas sobre a parcela do salário dentro dela.

    Args:
        salario_bruto: Salário bruto mensal (base + HE; sem vales).

    Returns:
        Valor do INSS retido, arredondado a 2 casas.
    """
    total = Decimal("0.00")
    anterior = Decimal("0.00")

    for teto, aliquota in _INSS_TABELA:
        if salario_bruto <= anterior:
            break
        faixa = min(salario_bruto, teto) - anterior
        total += faixa * aliquota
        anterior = teto

    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_irrf(salario_bruto: Decimal, inss: Decimal, dependentes: int = 0) -> Decimal:
    """
    Calcula IRRF retido na fonte.

    Base de cálculo = salário bruto - INSS - (dependentes × R$ 189,59).

    Args:
        salario_bruto: Salário bruto mensal.
        inss: INSS já calculado (deduzido da base antes do IR).
        dependentes: Número de dependentes declarados.

    Returns:
        Valor do IRRF retido, nunca negativo, arredondado a 2 casas.
    """
    base = salario_bruto - inss - (_IRRF_DEDUCAO_DEPENDENTE * dependentes)
    if base <= Decimal("0.00"):
        return Decimal("0.00")

    for teto, aliquota, deducao in _IRRF_TABELA:
        if teto is None or base <= teto:
            irrf = base * aliquota - deducao
            return max(irrf, Decimal("0.00")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

    return Decimal("0.00")


def calcular_fgts(salario_bruto: Decimal) -> Decimal:
    """
    Calcula FGTS patronal (informativo — não desconta do empregado).

    Args:
        salario_bruto: Salário bruto mensal.

    Returns:
        Valor do FGTS (8%), arredondado a 2 casas.
    """
    return (salario_bruto * _FGTS_ALIQUOTA).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def calcular_impostos(
    salario_bruto: Decimal,
    dependentes: int = 0,
) -> dict:
    """
    Calcula todos os encargos trabalhistas de uma vez.

    Args:
        salario_bruto: Salário bruto (base + HE + bônus, sem vales).
        dependentes: Dependentes para dedução de IRRF.

    Returns:
        Dict com chaves: inss, irrf, fgts_informativo, total_descontos.
    """
    inss = calcular_inss(salario_bruto)
    irrf = calcular_irrf(salario_bruto, inss, dependentes)
    fgts = calcular_fgts(salario_bruto)

    return {
        "inss": inss,
        "irrf": irrf,
        "fgts_informativo": fgts,
        "total_descontos": inss + irrf,
    }
