"""
Paddock Solutions — Pricing Catalog Models
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico
"""

from .aliases import AliasMaterial, AliasPeca, AliasServico
from .canonical import (
    CategoriaMaoObra,
    CategoriaServico,
    CompatibilidadePeca,
    InsumoMaterial,
    MaterialCanonico,
    PecaCanonica,
    ServicoCanonico,
)
from .supplier import CodigoFornecedorPeca, Fornecedor

__all__ = [
    # canonical
    "CategoriaServico",
    "ServicoCanonico",
    "CategoriaMaoObra",
    "MaterialCanonico",
    "InsumoMaterial",
    "PecaCanonica",
    "CompatibilidadePeca",
    # supplier
    "Fornecedor",
    "CodigoFornecedorPeca",
    # aliases
    "AliasServico",
    "AliasPeca",
    "AliasMaterial",
]
