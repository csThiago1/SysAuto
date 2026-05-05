"""Serviços de persistência de itens importados via Cilia/XML."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apps.cilia.dtos import ParsedBudget
    from apps.service_orders.models import ServiceOrderVersion

logger = logging.getLogger(__name__)


class ImportService:
    """Persiste itens parseados (ParsedItemDTO) como ServiceOrderVersionItem."""

    @classmethod
    def persist_items(
        cls,
        *,
        parsed_budget: "ParsedBudget",
        version: "ServiceOrderVersion",
    ) -> int:
        """Cria ServiceOrderVersionItem para cada item do ParsedBudget.

        Args:
            parsed_budget: DTO com items[] já parseados.
            version: ServiceOrderVersion onde criar os itens.

        Returns:
            Quantidade de itens criados.
        """
        from apps.service_orders.models import ServiceOrderVersionItem

        items_to_create: list[ServiceOrderVersionItem] = []

        for idx, item_dto in enumerate(parsed_budget.items):
            items_to_create.append(
                ServiceOrderVersionItem(
                    version=version,
                    sort_order=idx,
                    bucket=item_dto.bucket,
                    payer_block=item_dto.payer_block,
                    impact_area=item_dto.impact_area,
                    item_type=item_dto.item_type,
                    description=item_dto.description,
                    external_code=item_dto.external_code,
                    part_type=item_dto.part_type,
                    supplier=item_dto.supplier,
                    quantity=item_dto.quantity,
                    unit_price=item_dto.unit_price,
                    discount_pct=item_dto.discount_pct,
                    net_price=item_dto.net_price,
                    flag_abaixo_padrao=item_dto.flag_abaixo_padrao,
                    flag_acima_padrao=item_dto.flag_acima_padrao,
                    flag_inclusao_manual=item_dto.flag_inclusao_manual,
                    flag_codigo_diferente=item_dto.flag_codigo_diferente,
                    flag_servico_manual=item_dto.flag_servico_manual,
                    flag_peca_da_conta=item_dto.flag_peca_da_conta,
                )
            )

        if items_to_create:
            ServiceOrderVersionItem.objects.bulk_create(items_to_create)
            logger.info(
                "Criados %d itens na versão v%d da OS #%s",
                len(items_to_create),
                version.version_number,
                version.service_order_id,
            )

        return len(items_to_create)
