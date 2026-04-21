"""Services da camada de importação.

Define os DTOs `ParsedItemDTO`, `ParsedParecerDTO` e `ParsedBudget` consumidos
por `ServiceOrderService.create_new_version_from_import()` (Ciclo 02).

A classe `ImportService` concreta é adicionada na Task 4 do Ciclo 04.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass
class ParsedItemDTO:
    """Item parseado — agnóstico à fonte (Cilia/XML/HDI usam mesmo formato)."""

    # Classificação
    bucket: str = "IMPACTO"
    payer_block: str = "SEGURADORA"
    impact_area: int | None = None
    item_type: str = "PART"  # PART | SERVICE | EXTERNAL_SERVICE | FEE

    # Descrição
    description: str = ""
    external_code: str = ""

    # Tipo de peça / fornecimento
    part_type: str = ""  # GENUINA | ORIGINAL | OUTRAS_FONTES | VERDE
    supplier: str = "OFICINA"  # OFICINA | SEGURADORA

    # Financeiro
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    net_price: Decimal = Decimal("0")

    # Flags
    flag_abaixo_padrao: bool = False
    flag_acima_padrao: bool = False
    flag_inclusao_manual: bool = False
    flag_codigo_diferente: bool = False
    flag_servico_manual: bool = False
    flag_peca_da_conta: bool = False

    # Operations — lista de dicts {op_type, labor_cat, hours, rate}
    # Serão convertidas em ItemOperation pela service layer.
    operations: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ParsedParecerDTO:
    """Parecer/conclusion vindo da fonte de importação."""

    source: str = "cilia"
    flow_number: int | None = None
    author_external: str = ""
    author_org: str = ""
    author_document: str = ""
    parecer_type: str = ""  # AUTORIZADO | NEGADO | CORRECAO | COMENTARIO_INTERNO | SEM_COBERTURA
    body: str = ""
    created_at_external: str | None = None  # ISO8601 string


@dataclass
class ParsedBudget:
    """Resultado do parser. Consumido por
    `ServiceOrderService.create_new_version_from_import()` (Ciclo 02).
    """

    source: str = "cilia"

    # Identificação
    external_budget_number: str = ""
    external_version: str = ""  # "1446508.2"
    external_numero_vistoria: str = ""
    external_integration_id: str = ""
    external_budget_id: int | None = None  # Cilia budget_id
    external_version_id: int | None = None  # Cilia budget_version_id
    external_flow_number: int | None = None

    # Status — já mapeado pra nossos status internos (analisado/em_analise/autorizado/negado)
    external_status: str = "analisado"

    # Segurado/cliente
    segurado_name: str = ""
    segurado_cpf: str = ""
    segurado_phone: str = ""
    segurado_email: str = ""

    # Veículo
    vehicle_plate: str = ""
    vehicle_description: str = ""
    vehicle_chassis: str = ""
    vehicle_color: str = ""
    vehicle_km: str = ""
    vehicle_year: int | None = None
    vehicle_brand: str = ""

    # Sinistro / apólice
    casualty_number: str = ""
    insurer_code: str = ""  # mapeado de insurer.trade pro nosso Insurer.code

    # Financeiro
    franchise_amount: Decimal = Decimal("0")
    global_discount_pct: Decimal = Decimal("0")
    hourly_rates: dict[str, str] = field(default_factory=dict)

    # Dados
    items: list[ParsedItemDTO] = field(default_factory=list)
    pareceres: list[ParsedParecerDTO] = field(default_factory=list)

    # Snapshot completo
    raw_payload: dict[str, Any] = field(default_factory=dict)
    raw_hash: str = ""

    # Cilia entrega report oficial (base64)
    report_pdf_base64: str = ""
    report_html_base64: str = ""
