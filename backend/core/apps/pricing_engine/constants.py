"""
Paddock Solutions — Pricing Engine — Constants
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Mapeamento de categorias de mão de obra (pricing_catalog) para
positions/cargos de colaboradores (apps.hr via apps.persons).
"""

# Mapeamento categoria MO (pricing_catalog) → position/cargo do Employee (apps.hr)
# Campo Employee.position usa SetorPessoa.choices / CargoPessoa.choices de apps.persons
# Este dicionário é um documento vivo — expandir conforme crescer o catálogo
MAPEAMENTO_CATEGORIA_POSITION: dict[str, list[str]] = {
    "funileiro": ["FUNILEIRO"],
    "pintor": ["PINTOR"],
    "montador": ["MONTADOR", "DESMONTADOR"],
    "eletricista": ["ELETRICISTA_AUTOMOTIVO"],
    "mecanico": ["MECANICO"],
    "polidor": ["POLIDOR"],
    "lavador": ["LAVADOR"],
    "auxiliar": ["AUXILIAR_OFICINA"],
}

# Horas produtivas conservadoras por categoria (8h × 21 dias = 168)
HORAS_PRODUTIVAS_DEFAULT = 168
