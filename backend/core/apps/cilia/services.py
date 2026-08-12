"""Serviços de importação e persistência de orçamentos (Cilia/XML/HDI).

Este módulo é a camada de domínio da importação. Não conhece HTTP: quem chama
decide o que fazer com o `ImportResult` (view devolve Response, task loga).

Fontes de descoberta plugáveis chamam sempre o mesmo núcleo:
    - view `import-budget`  → usuário digitou sinistro/orçamento
    - task `scan_next_versions` → sondagem de versão+1
    - (futuro) inbound de e-mail / list_budgets, quando a Cilia liberar
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from apps.cilia.dtos import ParsedBudget
    from apps.cilia.models import ImportAttempt
    from apps.service_orders.models import ServiceOrder, ServiceOrderVersion

logger = logging.getLogger(__name__)


class CiliaImportError(Exception):
    """Falha de importação, com mensagem pronta para exibição.

    Attributes:
        detail: Mensagem para o usuário final.
        error_type: Código curto para telemetria (ex.: "HTTP404", "ParseError").
        http_status: Status devolvido pela Cilia, quando houve resposta.
    """

    def __init__(
        self,
        detail: str,
        error_type: str,
        *,
        http_status: Optional[int] = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.error_type = error_type
        self.http_status = http_status


class CiliaVersionNotFound(CiliaImportError):
    """Versão ainda não existe na Cilia (404).

    Na sondagem de versões isto é o caso normal, não um erro: significa
    "a seguradora ainda não publicou a próxima versão".
    """


@dataclass
class ImportResult:
    """Resultado de uma importação.

    Attributes:
        action: "applied" (aplicada na OS), "diff" (versão criada aguardando
            revisão humana) ou "duplicate" (mesmo conteúdo já importado).
        version: Versão criada — ou a existente, no caso de duplicata.
        previous: Versão anterior, quando houve diff.
        attempt: Registro de auditoria da tentativa.
    """

    action: str
    version: Optional["ServiceOrderVersion"] = None
    previous: Optional["ServiceOrderVersion"] = None
    attempt: Optional["ImportAttempt"] = None


# Erros da Cilia traduzidos para o usuário final.
_CILIA_HTTP_DETAIL = {
    401: "Token Cilia inválido ou ausente. Verifique CILIA_AUTH_TOKEN no servidor.",
    403: "Sem permissão para acessar este orçamento na Cilia.",
    404: "Orçamento não encontrado na Cilia. Confira sinistro, orçamento e versão.",
}


def fetch_parsed_budget(
    *,
    casualty_number: str,
    budget_number: str | int,
    version_number: int | str | None = None,
) -> tuple["ParsedBudget", Any]:
    """Busca um orçamento na Cilia e devolve o DTO já parseado.

    Args:
        casualty_number: Número do sinistro.
        budget_number: Número do orçamento.
        version_number: Versão; `None` traz a mais recente.

    Returns:
        Tupla (parsed_budget, response) — a response carrega status e timing
        para auditoria no ImportAttempt.

    Raises:
        CiliaVersionNotFound: HTTP 404 (versão inexistente).
        CiliaImportError: rede, autenticação, permissão ou parse.
    """
    from apps.cilia.client import CiliaClient, CiliaError
    from apps.cilia.sources.cilia_parser import CiliaParser

    client = CiliaClient()
    try:
        response = client.get_budget(
            casualty_number=casualty_number,
            budget_number=budget_number,
            version_number=int(version_number) if version_number else None,
        )
    except CiliaError as exc:
        logger.warning("[Cilia] erro de rede: %s", exc)
        raise CiliaImportError("Erro de conexão com a Cilia.", "NetworkError") from exc

    if response.status_code == 404:
        raise CiliaVersionNotFound(
            _CILIA_HTTP_DETAIL[404], "HTTP404", http_status=404,
        )
    if response.status_code != 200:
        raise CiliaImportError(
            _CILIA_HTTP_DETAIL.get(
                response.status_code,
                f"Cilia retornou HTTP {response.status_code}.",
            ),
            f"HTTP{response.status_code}",
            http_status=response.status_code,
        )

    try:
        parsed = CiliaParser.parse(response.data)
    except Exception as exc:
        logger.exception("[Cilia] erro de parse: %s", exc)
        raise CiliaImportError("Erro ao processar orçamento.", "ParseError") from exc

    return parsed, response


def apply_parsed_budget_to_order(
    order: Any,
    parsed: Any,
    *,
    budget_number: Optional[str] = None,
    version_number: Optional[str] = None,
) -> list[str]:
    """Aplica os campos do ParsedBudget na OS. Retorna os update_fields.

    Campos de identificação só são preenchidos quando estão vazios — nunca
    sobrescreve o que o consultor digitou. Veículo (make/model/color/year)
    entra nessa regra porque a normalização do parser Cilia não fica boa: a
    descrição completa do modelo é difícil de quebrar em make+model.

    Args:
        order: ServiceOrder a atualizar (não salva — devolve os campos).
        parsed: ParsedBudget vindo de qualquer parser.
        budget_number: Número do orçamento na fonte, quando houver.
        version_number: Versão na fonte, quando houver.

    Returns:
        Lista de campos alterados, para `order.save(update_fields=...)`.
    """
    update_fields: list[str] = []

    fill_if_empty = {
        "casualty_number": parsed.casualty_number,
        "plate": parsed.vehicle_plate,
        "chassis": parsed.vehicle_chassis,
        "customer_name": parsed.segurado_name,
        "make": parsed.vehicle_brand,
        "model": getattr(parsed, "vehicle_model", "") or parsed.vehicle_description or "",
        "color": parsed.vehicle_color,
    }
    for field, value in fill_if_empty.items():
        if value and not getattr(order, field, None):
            setattr(order, field, value)
            update_fields.append(field)

    if parsed.vehicle_year and not order.year:
        order.year = parsed.vehicle_year
        update_fields.append("year")

    # Orçamento Cilia (só se fonte for Cilia/IFX/HDI com budget_number)
    if budget_number and order.cilia_budget_number != str(budget_number):
        order.cilia_budget_number = str(budget_number)
        update_fields.append("cilia_budget_number")
    if version_number is not None and str(version_number) and (
        order.cilia_budget_version != str(version_number)
    ):
        order.cilia_budget_version = str(version_number)
        update_fields.append("cilia_budget_version")

    # Seguradora
    if parsed.insurer_code:
        if order.customer_type != "insurer":
            order.customer_type = "insurer"
            update_fields.append("customer_type")
        if not order.insurer_id:
            from apps.insurers.models import Insurer

            insurer = Insurer.objects.filter(code=parsed.insurer_code).first()
            if insurer:
                order.insurer = insurer
                update_fields.append("insurer_id")
            else:
                logger.warning(
                    "Insurer code='%s' não cadastrado — OS %s fica sem FK.",
                    parsed.insurer_code,
                    order.pk,
                )

    # Franquia
    if parsed.franchise_amount:
        order.deductible_amount = parsed.franchise_amount
        update_fields.append("deductible_amount")

    # Observações técnicas
    if not order.notes and parsed.pareceres:
        obs_lines = []
        for parecer in parsed.pareceres:
            parts = [
                parecer.parecer_type.replace("_", " ").title() if parecer.parecer_type else "",
                parecer.body or "",
            ]
            line = " — ".join(p for p in parts if p)
            if line:
                obs_lines.append(line)
        if obs_lines:
            order.notes = "\n".join(obs_lines)
            update_fields.append("notes")

    return update_fields


def create_version_from_parsed(
    *,
    order: Any,
    parsed: Any,
    attempt: Any,
    applied_by: str,
) -> ImportResult:
    """Cria a ServiceOrderVersion e decide entre aplicar ou aguardar revisão.

    Regra de cobrança: o total da seguradora vem da FONTE OFICIAL
    (`source_grand_total`), não da soma dos itens do parser. Os itens
    detalham COMO se chegou no total.

    Primeira importação aplica direto — não há nada para comparar. A partir
    da segunda, a versão é criada e fica aguardando um humano aplicar, para
    não sobrescrever ajustes feitos na OS.

    Args:
        order: ServiceOrder alvo.
        parsed: ParsedBudget já validado.
        attempt: ImportAttempt de auditoria.
        applied_by: Identificação de quem aplicou (e-mail ou "Sistema").

    Returns:
        ImportResult com action "applied", "diff" ou "duplicate".
    """
    from apps.service_orders.services import ServiceOrderService

    # Dedup por conteúdo: reimportar a mesma versão é inofensivo.
    existing = order.versions.filter(content_hash=parsed.raw_hash).first()
    if existing:
        return ImportResult(action="duplicate", version=existing, attempt=attempt)

    version = ServiceOrderService.create_new_version_from_import(
        service_order=order,
        parsed_budget=parsed,
        import_attempt=attempt,
    )
    ServiceOrderService.recalculate_version_totals(
        version,
        source_grand_total=getattr(parsed, "source_grand_total", None) or None,
    )

    previous = order.versions.exclude(pk=version.pk).order_by("-version_number").first()
    if previous:
        return ImportResult(
            action="diff", version=version, previous=previous, attempt=attempt,
        )

    ServiceOrderService.apply_version_override(
        service_order=order, new_version=version, applied_by=applied_by,
    )
    return ImportResult(action="applied", version=version, attempt=attempt)


def import_from_cilia(
    *,
    order: Any,
    casualty_number: str,
    budget_number: str | int,
    version_number: int | str | None = None,
    trigger: str,
    created_by: str,
) -> ImportResult:
    """Núcleo da importação Cilia: busca, parseia, aplica e versiona.

    Este é o ponto único de entrada. Toda fonte de descoberta (usuário,
    sondagem de versões, e-mail, listagem) termina aqui.

    Args:
        order: ServiceOrder alvo.
        casualty_number: Número do sinistro.
        budget_number: Número do orçamento.
        version_number: Versão; `None` traz a mais recente.
        trigger: Origem — "user_requested", "polling" ou "upload_manual".
        created_by: Quem disparou (e-mail do usuário ou "Sistema").

    Returns:
        ImportResult.

    Raises:
        CiliaVersionNotFound: versão ainda não publicada.
        CiliaImportError: qualquer outra falha de rede, permissão ou parse.
            Antes de propagar, a falha fica registrada em ImportAttempt.
    """
    from apps.cilia.models import ImportAttempt

    try:
        parsed, response = fetch_parsed_budget(
            casualty_number=casualty_number,
            budget_number=budget_number,
            version_number=version_number,
        )
    except CiliaImportError as exc:
        # Falha também é auditoria: sem isso, um polling quebrado fica invisível.
        ImportAttempt.objects.create(
            source="cilia",
            trigger=trigger,
            created_by=created_by,
            casualty_number=casualty_number,
            budget_number=str(budget_number),
            version_number=version_number,
            http_status=exc.http_status,
            parsed_ok=False,
            error_message=exc.detail,
            error_type=exc.error_type,
            service_order=order,
        )
        raise

    update_fields = apply_parsed_budget_to_order(
        order,
        parsed,
        budget_number=str(budget_number),
        version_number=str(version_number) if version_number else None,
    )
    if update_fields:
        order.save(update_fields=update_fields)

    attempt = ImportAttempt.objects.create(
        source="cilia",
        trigger=trigger,
        created_by=created_by,
        casualty_number=casualty_number,
        budget_number=str(budget_number),
        version_number=version_number,
        http_status=response.status_code,
        duration_ms=response.duration_ms,
        raw_payload=response.data,
        raw_hash=parsed.raw_hash,
        parsed_ok=True,
        service_order=order,
    )

    return create_version_from_parsed(
        order=order, parsed=parsed, attempt=attempt, applied_by=created_by,
    )


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
