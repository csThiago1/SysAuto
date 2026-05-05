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


# ============================================================================
# ImportService — orquestra Client + Parser + ServiceOrderService
# ============================================================================

import hashlib  # noqa: E402
import logging  # noqa: E402
import time  # noqa: E402

from django.db import transaction  # noqa: E402


logger = logging.getLogger(__name__)


class ImportService:
    """Orquestra o pipeline de importação Cilia: fetch → parse → persist."""

    @classmethod
    def fetch_cilia_budget(
        cls,
        *,
        casualty_number: str,
        budget_number: int | str,
        version_number: int | None = None,
        trigger: str = "user_requested",
        created_by: str = "Sistema",
        client: "Any | None" = None,  # CiliaClient opcional pra DI nos testes
    ) -> "Any":
        """Busca orçamento Cilia e persiste como ServiceOrderVersion se novo.

        Pipeline:
          1. Chama Cilia API via CiliaClient (com timing)
          2. Cria ImportAttempt (sucesso ou falha)
          3. 200: dedup por raw_hash, se novo → cria OS (ou reutiliza) + version
          4. 404: registra NotFound
          5. 401/403: registra AuthError
          6. Outros: registra HTTP{status}

        Returns:
            ImportAttempt (sempre — mesmo em erro). Se sucesso, tem
            service_order e version_created preenchidos.
        """
        from .models import ImportAttempt
        from .client import CiliaClient, CiliaError
        from .sources.cilia_parser import CiliaParser

        client = client or CiliaClient()

        start = time.monotonic()
        try:
            response = client.get_budget(
                casualty_number=casualty_number,
                budget_number=budget_number,
                version_number=version_number,
            )
        except CiliaError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            return ImportAttempt.objects.create(
                source="cilia",
                trigger=trigger,
                created_by=created_by,
                casualty_number=casualty_number,
                budget_number=str(budget_number),
                version_number=version_number,
                parsed_ok=False,
                error_message=str(exc),
                error_type="NetworkError",
                duration_ms=duration_ms,
            )

        attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger=trigger,
            created_by=created_by,
            casualty_number=casualty_number,
            budget_number=str(budget_number),
            version_number=version_number,
            http_status=response.status_code,
            duration_ms=response.duration_ms,
            raw_payload=response.data if response.status_code == 200 else None,
        )

        # Respostas não-200
        if response.status_code == 404:
            attempt.error_message = "Versão do orçamento não encontrada"
            attempt.error_type = "NotFound"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        if response.status_code in (401, 403):
            attempt.error_message = str((response.data or {}).get("error", "Unauthorized"))
            attempt.error_type = "AuthError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        if response.status_code != 200:
            attempt.error_message = (
                f"HTTP {response.status_code}: {response.raw_text[:500]}"
            )
            attempt.error_type = f"HTTP{response.status_code}"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        # 200 — parse
        try:
            parsed = CiliaParser.parse(response.data)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Cilia parse error")
            attempt.error_message = f"Parse error: {exc}"
            attempt.error_type = "ParseError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.raw_hash = parsed.raw_hash
        attempt.save(update_fields=["raw_hash"])

        # Dedup — mesmo hash já processado com sucesso
        previous_ok = (
            ImportAttempt.objects.filter(
                source="cilia", parsed_ok=True, raw_hash=parsed.raw_hash,
            )
            .exclude(pk=attempt.pk)
            .first()
        )
        if previous_ok:
            attempt.duplicate_of = previous_ok
            attempt.parsed_ok = False
            attempt.error_message = "Payload idêntico já processado"
            attempt.error_type = "Duplicate"
            attempt.save(
                update_fields=[
                    "duplicate_of", "parsed_ok", "error_message", "error_type",
                ],
            )
            return attempt

        # Persist
        try:
            os_instance, version = cls._persist_cilia_budget(parsed=parsed, attempt=attempt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Cilia persist error")
            attempt.error_message = f"Persist error: {exc}"
            attempt.error_type = "PersistError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.service_order = os_instance
        attempt.version_created = version
        attempt.parsed_ok = True
        attempt.save(
            update_fields=["service_order", "version_created", "parsed_ok"],
        )
        return attempt

    @classmethod
    @transaction.atomic
    def _persist_cilia_budget(
        cls, *, parsed: ParsedBudget, attempt: "Any",
    ) -> "tuple":
        """Encontra/cria OS (por insurer+casualty), depois cria version via
        ServiceOrderService.create_new_version_from_import.
        """
        from apps.items.services import NumberAllocator
        from apps.persons.models import Person
        from apps.service_orders.models import Insurer, ServiceOrder
        from apps.service_orders.services import ServiceOrderService

        insurer = Insurer.objects.filter(code=parsed.insurer_code).first()
        if insurer is None:
            trade = (parsed.raw_payload.get("insurer") or {}).get("trade", "?")
            raise ValueError(
                f"Insurer '{parsed.insurer_code}' não existe no catálogo "
                f"(Cilia trade: '{trade}'). Seed a seguradora primeiro."
            )

        os_instance = ServiceOrder.objects.filter(
            insurer=insurer, casualty_number=parsed.casualty_number,
        ).first()

        if os_instance is None:
            # Cria cliente — Person tem só full_name + person_type + phone
            customer = Person.objects.create(
                full_name=parsed.segurado_name or "Cliente Importado Cilia",
                person_type="CLIENT",
                phone=parsed.segurado_phone or "",
            )

            os_instance = ServiceOrder.objects.create(
                os_number=NumberAllocator.allocate("SERVICE_ORDER"),
                customer=customer,
                customer_type="SEGURADORA",
                insurer=insurer,
                casualty_number=parsed.casualty_number,
                external_budget_number=parsed.external_budget_number,
                franchise_amount=parsed.franchise_amount,
                vehicle_plate=parsed.vehicle_plate,
                vehicle_description=parsed.vehicle_description,
                status="reception",
            )

        # Idempotência: se já existe version com mesmo external_version_id, retorna ela
        if parsed.external_version_id:
            existing = os_instance.versions.filter(
                external_version_id=parsed.external_version_id,
            ).first()
            if existing:
                return os_instance, existing

        version = ServiceOrderService.create_new_version_from_import(
            service_order=os_instance,
            parsed_budget=parsed,
            import_attempt=attempt,
        )
        return os_instance, version

    # ------------------------------------------------------------------ XML IFX
    @classmethod
    def import_xml_ifx(
        cls,
        *,
        xml_bytes: bytes,
        insurer_code: str,
        trigger: str = "upload_manual",
        created_by: str = "Sistema",
    ) -> "Any":
        """Importa orçamento finalizado via upload XML IFX (Porto/Azul/Itaú).

        Diferenças vs Cilia:
          - Upload único (não tem polling — XML representa versão finalizada)
          - Seguradora informada explicitamente (XML não identifica)
          - Sem report_pdf/html (XML não traz)
          - Status sempre "autorizado" (XML só chega quando finaliza)
        """
        from .models import ImportAttempt
        from .sources.xml_ifx_parser import XmlIfxParser

        source = f"xml_{insurer_code.lower()}" if insurer_code else "xml_ifx"
        raw_hash = hashlib.sha256(xml_bytes).hexdigest() if xml_bytes else ""

        attempt = ImportAttempt.objects.create(
            source=source if source in {
                "xml_porto", "xml_azul", "xml_itau",
            } else "xml_porto",  # fallback
            trigger=trigger,
            created_by=created_by,
            raw_hash=raw_hash,
        )

        try:
            parsed = XmlIfxParser.parse(xml_bytes, insurer_code=insurer_code)
        except Exception as exc:  # noqa: BLE001
            logger.exception("XML IFX parse error")
            attempt.error_message = f"Parse error: {exc}"
            attempt.error_type = "ParseError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.casualty_number = parsed.casualty_number
        attempt.budget_number = parsed.external_budget_number
        attempt.raw_payload = parsed.raw_payload
        attempt.raw_hash = parsed.raw_hash
        attempt.save(update_fields=[
            "casualty_number", "budget_number", "raw_payload", "raw_hash",
        ])

        # Dedup — mesmo hash já processado
        previous_ok = (
            ImportAttempt.objects.filter(
                parsed_ok=True, raw_hash=parsed.raw_hash,
            )
            .exclude(pk=attempt.pk)
            .first()
        )
        if previous_ok:
            attempt.duplicate_of = previous_ok
            attempt.parsed_ok = False
            attempt.error_message = "Payload idêntico já processado"
            attempt.error_type = "Duplicate"
            attempt.save(update_fields=[
                "duplicate_of", "parsed_ok", "error_message", "error_type",
            ])
            return attempt

        # Persist — reutiliza mesma lógica do Cilia (parser-agnóstico)
        try:
            os_instance, version = cls._persist_cilia_budget(
                parsed=parsed, attempt=attempt,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("XML IFX persist error")
            attempt.error_message = f"Persist error: {exc}"
            attempt.error_type = "PersistError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.service_order = os_instance
        attempt.version_created = version
        attempt.parsed_ok = True
        attempt.save(update_fields=[
            "service_order", "version_created", "parsed_ok",
        ])
        return attempt
