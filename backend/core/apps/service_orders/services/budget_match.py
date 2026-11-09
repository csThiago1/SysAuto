"""
Cruzamento do checklist de entrada com o orçamento ativo da OS.

Roda no import do orçamento (Celery), ao finalizar o checklist e sob demanda. `budget_match`
é dado calculado, fora do PDF assinado: pode mudar com o checklist travado. A relação
declarada pelo consultor nunca é tocada.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from django.db import transaction

from apps.followups.services import upsert_pre_existing_damage

from ..checklist_constants import BudgetMatch, DamageRelation
from ..models import BudgetPanelRule, ChecklistDamage, ServiceOrder, ServiceOrderVersionItem
from ..models.checklist import ENTRY
from .budget_panels import panels_for_description

logger = logging.getLogger(__name__)

MATCHED_ITEM_TYPES: tuple[str, ...] = ("PART", "SERVICE", "EXTERNAL_SERVICE")


@dataclass
class MatchSummary:
    inside: int = 0
    outside: list[str] = field(default_factory=list)
    unmapped: list[dict[str, Any]] = field(default_factory=list)


def active_budget_items(order: ServiceOrder) -> list[ServiceOrderVersionItem]:
    """Peças e serviços da versão ativa (a de maior número). Sem versão → []."""
    # ponytail: "versão ativa" = is_active_version (maior version_number), sem a query por item.
    version = order.versions.order_by("-version_number").first()
    if version is None:
        return []
    return list(version.items.filter(item_type__in=MATCHED_ITEM_TYPES))


def _active_damages(order: ServiceOrder) -> list[ChecklistDamage]:
    return list(
        ChecklistDamage.objects.filter(
            service_order=order, checklist_type=ENTRY, is_active=True
        ).order_by("number")
    )


@transaction.atomic
def run_budget_match(order: ServiceOrder) -> MatchSummary:
    """Grava `budget_match` em cada dano ativo e atualiza o retorno de dano pré-existente."""
    items = active_budget_items(order) if order.customer_type == "insurer" else []
    summary = MatchSummary()
    panel_items: dict[str, list[int]] = {}
    if items:
        rules = list(
            BudgetPanelRule.objects.filter(is_active=True).values_list("pattern", "panel_keys")
        )
        for item in items:
            panels = panels_for_description(item.description, rules)
            if not panels:
                summary.unmapped.append({"item_id": item.id, "description": item.description})
            for panel in panels:
                panel_items.setdefault(panel, []).append(item.id)

    for damage in _active_damages(order):
        if not items:
            damage.budget_match, damage.matched_budget_items = BudgetMatch.SEM_ORCAMENTO, []
        elif damage.panel_key in panel_items:
            damage.budget_match = BudgetMatch.NO_ORCAMENTO
            damage.matched_budget_items = panel_items[damage.panel_key]
            summary.inside += 1
        else:
            damage.budget_match, damage.matched_budget_items = BudgetMatch.FORA_DO_ORCAMENTO, []
            label = damage.get_panel_key_display()
            if label not in summary.outside:
                summary.outside.append(label)
        damage.save(update_fields=["budget_match", "matched_budget_items", "updated_at"])

    upsert_pre_existing_damage(order, summary.outside)
    logger.info(
        "Cruzamento da OS %s: %s no orçamento, %s fora, %s itens não mapeados",
        order.pk,
        summary.inside,
        len(summary.outside),
        len(summary.unmapped),
    )
    return summary


def report_data(order: ServiceOrder) -> dict[str, Any]:
    """Contexto do relatório de cruzamento (refaz o cruzamento antes, para sair atual)."""
    from apps.documents.data_loaders import OSDataLoader

    summary = run_budget_match(order)
    descriptions = {item.id: item.description for item in active_budget_items(order)}
    data = OSDataLoader._base_context(order)
    data["order"]["customer_name"] = order.customer_name
    data["vehicle"] = OSDataLoader._vehicle_dict(order)
    data["damages"] = [
        {
            "number": d.number,
            "panel": d.get_panel_key_display(),
            "relation": d.get_relation_display(),
            "budget_match": d.budget_match,
            "budget_match_label": (
                "Pré-existente · fora do sinistro"
                if d.budget_match == BudgetMatch.FORA_DO_ORCAMENTO
                else d.get_budget_match_display()
            ),
            # Consultor disse "sinistro" e o orçamento não tem a peça (ou o contrário).
            "divergent": (d.relation, d.budget_match)
            in (
                (DamageRelation.SINISTRO, BudgetMatch.FORA_DO_ORCAMENTO),
                (DamageRelation.PRE_EXISTENTE, BudgetMatch.NO_ORCAMENTO),
            ),
            "items": [descriptions[i] for i in d.matched_budget_items if i in descriptions],
        }
        for d in _active_damages(order)
    ]
    data["unmapped"] = [item["description"] for item in summary.unmapped]
    return data
