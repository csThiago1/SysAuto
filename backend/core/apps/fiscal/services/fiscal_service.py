"""
Paddock Solutions — Fiscal — FiscalService
Ciclo 06B: skeleton funcional (_raise_for_http, get_config)
Ciclo 06C: emit_nfse, emit_manual_nfse, cancel, consult — implementação completa
Ciclo 07A: emit_nfe, emit_manual_nfe — NF-e de produto (Regime Normal)

Responsabilidades:
- Orquestrar chamadas ao FocusNFeClient
- Persistir FiscalEvent (auditoria imutável)
- Traduzir http_status → exceção de domínio via _raise_for_http()
- Atualizar FiscalDocument conforme resposta da Focus
"""

import logging
from typing import TYPE_CHECKING, Any

from django.db import transaction
from django.utils import timezone

from apps.fiscal.clients.focus_nfe_client import FocusNFeClient, FocusResponse
from apps.fiscal.exceptions import (
    FiscalDocumentAlreadyAuthorized,
    FiscalInvalidStatus,
    FiscalValidationError,
    FocusAuthError,
    FocusConflict,
    FocusNotFoundError,
    FocusRateLimitError,
    FocusServerError,
    FocusValidationError,
    NfeBuilderError,
    NfseBuilderError,
)

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel, FiscalDocument

logger = logging.getLogger(__name__)

# Mapeamento status Focus → status local
_FOCUS_STATUS_MAP: dict[str, str] = {
    "autorizado": "authorized",
    "autorizado_fora_horario": "authorized",
    "processando_autorizacao": "pending",
    "em_homologacao": "pending",
    "erro_autorizacao": "rejected",
    "denegado": "rejected",
    "cancelado": "cancelled",
}


class FiscalService:
    """Serviço de emissão e gerenciamento de documentos fiscais.

    Todos os métodos de emissão são @transaction.atomic.
    _raise_for_http() é o único ponto de mapeamento HTTP → exceção de domínio.
    """

    @classmethod
    def get_config(cls) -> "FiscalConfigModel":
        """Retorna a configuração fiscal ativa.

        Raises:
            FiscalConfigModel.DoesNotExist: Nenhum emissor cadastrado.
        """
        from apps.fiscal.models import FiscalConfigModel

        return FiscalConfigModel.objects.get(is_active=True)

    @classmethod
    @transaction.atomic
    def emit_nfse(
        cls,
        service_order: Any,
        config: "FiscalConfigModel | None" = None,
        triggered_by: str = "USER",
        parts_as_service: bool = True,
    ) -> "FiscalDocument":
        """Emite NFS-e a partir de uma OS.

        Idempotente:
        - Se já existe FiscalDocument(service_order=os, status=authorized) → FiscalDocumentAlreadyAuthorized
        - Se já existe FiscalDocument(service_order=os, status=pending) → retorna existente

        Args:
            service_order: OS com customer_type='private' e destinatario FK preenchida.
            config: emissor fiscal; se None, usa get_config().
            triggered_by: "USER" | "USER_MANUAL" | "CELERY" | "WEBHOOK".

        Returns:
            FiscalDocument criado ou existente (se idempotente).

        Raises:
            FiscalDocumentAlreadyAuthorized: OS já tem NFS-e autorizada.
            NfseBuilderError: dados insuficientes para construir o payload.
            FocusValidationError: payload inválido rejeitado pela Focus.
            FocusAuthError: token Focus inválido.
            FocusServerError: erro 5xx na Focus.
        """
        from apps.fiscal.models import FiscalDocument, FiscalEvent
        from apps.fiscal.services.manaus_nfse import ManausNfseBuilder
        from apps.fiscal.services.ref_generator import next_fiscal_ref

        if config is None:
            config = cls.get_config()

        # Verificar idempotência — já existe NFS-e para essa OS?
        existing = (
            FiscalDocument.objects.filter(
                service_order=service_order,
                document_type=FiscalDocument.DocumentType.NFSE,
            )
            .select_for_update()
            .order_by("-created_at")
            .first()
        )
        if existing:
            if existing.status == FiscalDocument.Status.AUTHORIZED:
                raise FiscalDocumentAlreadyAuthorized(
                    f"OS #{service_order.number} já possui NFS-e autorizada (doc pk={existing.pk})."
                )
            if existing.status == FiscalDocument.Status.PENDING:
                logger.info(
                    "emit_nfse idempotente: doc pk=%s já em pending para OS #%s",
                    existing.pk,
                    service_order.number,
                )
                return existing

        # Carregar destinatário
        person = cls._get_person_for_os(service_order)

        # Gerar ref de idempotência
        ref, _seq = next_fiscal_ref(config, "NFSE")

        # Construir payload
        service_order.destinatario = person  # injetar para o builder
        payload = ManausNfseBuilder.build(
            service_order, config, ref, parts_as_service=parts_as_service,
        )
        if parts_as_service:
            total_value = (service_order.services_total or 0) + (service_order.parts_total or 0)
        else:
            total_value = service_order.services_total or 0

        # Criar FiscalDocument ANTES da chamada HTTP (para garantir audit trail)
        doc = FiscalDocument.objects.create(
            document_type=FiscalDocument.DocumentType.NFSE,
            status=FiscalDocument.Status.PENDING,
            ref=ref,
            config=config,
            service_order=service_order,
            destinatario=person,
            payload_enviado=payload,
            total_value=total_value,
            environment=config.environment,
        )

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_REQUEST,
            payload=payload,
            triggered_by=triggered_by,
        )

        # Chamar Focus
        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_RESPONSE,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=triggered_by,
        )

        cls._raise_for_http(resp)

        # Atualizar snapshot de resposta
        doc.ultima_resposta = resp.data or {}
        if resp.data:
            focus_status = resp.data.get("status", "")
            new_status = _FOCUS_STATUS_MAP.get(focus_status, "")
            if new_status and new_status != "pending":
                doc.status = new_status
                cls._apply_focus_data(doc, resp.data)
        doc.save(update_fields=["ultima_resposta", "status", "key", "number",
                                 "caminho_xml", "caminho_pdf", "mensagem_sefaz",
                                 "authorized_at", "cancelled_at"])

        # Agendar polling se ainda pendente
        if doc.status == FiscalDocument.Status.PENDING:
            from apps.fiscal.tasks import poll_fiscal_document
            poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)

        return doc

    @classmethod
    @transaction.atomic
    def emit_manual_nfse(
        cls,
        input_data: dict[str, Any],
        user: Any,
        config: "FiscalConfigModel | None" = None,
    ) -> "FiscalDocument":
        """Emite NFS-e manual (ad-hoc, sem OS vinculada).

        Args:
            input_data: validated_data de ManualNfseInputSerializer.
            user: usuário autenticado (GlobalUser) — salvo em created_by.
            config: emissor; se None, usa get_config().

        Returns:
            FiscalDocument criado.

        Raises:
            NfseBuilderError: Person sem documento ou endereço adequado.
            FiscalValidationError: manual_reason vazio.
        """
        from apps.fiscal.models import FiscalDocument, FiscalEvent
        from apps.fiscal.services.manaus_nfse import ManualNfseBuilder
        from apps.fiscal.services.ref_generator import next_fiscal_ref
        from apps.persons.models import Person

        if config is None:
            config = cls.get_config()

        manual_reason = input_data.get("manual_reason", "").strip()
        if not manual_reason:
            raise FiscalValidationError("manual_reason é obrigatório para emissão manual.")

        person = Person.objects.prefetch_related("documents", "addresses").get(
            pk=input_data["destinatario_id"]
        )

        ref, _seq = next_fiscal_ref(config, "NFSE")
        payload = ManualNfseBuilder.build(input_data, person, config, ref)

        from decimal import Decimal

        itens = input_data.get("itens", [])
        total_value = sum(
            Decimal(str(i.get("valor_unitario", 0))) * Decimal(str(i.get("quantidade", 1)))
            - Decimal(str(i.get("valor_desconto", 0)))
            for i in itens
        )

        doc = FiscalDocument.objects.create(
            document_type=FiscalDocument.DocumentType.NFSE,
            status=FiscalDocument.Status.PENDING,
            ref=ref,
            config=config,
            service_order=None,
            destinatario=person,
            manual_reason=manual_reason,
            payload_enviado=payload,
            total_value=total_value,
            environment=config.environment,
            created_by=user,
        )

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_REQUEST,
            payload=payload,
            triggered_by=FiscalEvent.TriggeredBy.USER_MANUAL,
        )

        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_RESPONSE,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=FiscalEvent.TriggeredBy.USER_MANUAL,
        )

        cls._raise_for_http(resp)

        doc.ultima_resposta = resp.data or {}
        if resp.data:
            focus_status = resp.data.get("status", "")
            new_status = _FOCUS_STATUS_MAP.get(focus_status, "")
            if new_status and new_status != "pending":
                doc.status = new_status
                cls._apply_focus_data(doc, resp.data)
        doc.save(update_fields=["ultima_resposta", "status", "key", "number",
                                 "caminho_xml", "caminho_pdf", "mensagem_sefaz",
                                 "authorized_at", "cancelled_at"])

        if doc.status == FiscalDocument.Status.PENDING:
            from apps.fiscal.tasks import poll_fiscal_document
            poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)

        return doc

    @classmethod
    @transaction.atomic
    def consult(cls, doc: "FiscalDocument") -> "FiscalDocument":
        """Consulta status de documento fiscal na Focus e atualiza o FiscalDocument.

        Mapeamento Focus → local:
        - "autorizado" / "autorizado_fora_horario" → authorized
        - "processando_autorizacao" / "em_homologacao" → pending (sem alteração)
        - "erro_autorizacao" / "denegado" → rejected
        - "cancelado" → cancelled

        Returns:
            FiscalDocument atualizado.
        """
        from apps.fiscal.models import FiscalEvent

        with FocusNFeClient() as client:
            if doc.document_type == "nfe":
                resp = client.consult_nfe(doc.ref)
            else:
                resp = client.consult_nfse(doc.ref)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.CONSULT,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=FiscalEvent.TriggeredBy.CELERY,
        )

        if resp.status_code == 404:
            # Documento ainda não chegou à Focus — manter pending
            return doc

        cls._raise_for_http(resp)

        data = resp.data or {}
        focus_status = data.get("status", "")
        new_status = _FOCUS_STATUS_MAP.get(focus_status, "")

        if new_status and new_status != doc.status:
            doc.status = new_status
            cls._apply_focus_data(doc, data)
            doc.ultima_resposta = data
            doc.save(update_fields=["status", "key", "number", "caminho_xml", "caminho_pdf",
                                     "mensagem_sefaz", "natureza_rejeicao",
                                     "authorized_at", "cancelled_at", "ultima_resposta"])

        return doc

    @classmethod
    @transaction.atomic
    def cancel(cls, doc: "FiscalDocument", justificativa: str) -> "FiscalDocument":
        """Cancela documento fiscal autorizado.

        Args:
            doc: FiscalDocument com status=authorized.
            justificativa: mínimo 15 caracteres.

        Raises:
            FiscalInvalidStatus: documento não está em status=authorized.
            FiscalValidationError: justificativa muito curta.
            FocusServerError: erro 5xx na Focus.
        """
        from apps.fiscal.models import FiscalDocument, FiscalEvent

        if doc.status != FiscalDocument.Status.AUTHORIZED:
            raise FiscalInvalidStatus(
                f"Cancelamento inválido: status atual é '{doc.status}', esperado 'authorized'."
            )
        if not justificativa or len(justificativa) < 15:
            raise FiscalValidationError(
                "justificativa deve ter pelo menos 15 caracteres."
            )

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.CANCEL_REQUEST,
            payload={"justificativa": justificativa},
            triggered_by=FiscalEvent.TriggeredBy.USER,
        )

        with FocusNFeClient() as client:
            if doc.document_type == "nfe":
                resp = client.cancel_nfe(doc.ref, justificativa)
            else:
                resp = client.cancel_nfse(doc.ref, justificativa)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.CANCEL_REQUEST,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=FiscalEvent.TriggeredBy.USER,
        )

        cls._raise_for_http(resp)

        doc.status = FiscalDocument.Status.CANCELLED
        doc.cancelled_at = timezone.now()
        doc.ultima_resposta = resp.data or {}
        doc.save(update_fields=["status", "cancelled_at", "ultima_resposta"])

        return doc

    # ── NF-e de Produto (Ciclo 07A) ──────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def emit_nfe(
        cls,
        service_order: Any,
        tax_config: Any = None,  # NFeTaxConfig | None
        config: "FiscalConfigModel | None" = None,
        forma_pagamento: str = "01",
    ) -> "FiscalDocument":
        """Emite NF-e de produto a partir de uma OS.

        Monta itens a partir das peças da OS (ServiceOrderPart).
        NCM obrigatório em cada PecaCanonica — lança NfeBuilderError se ausente.

        Idempotente: mesmo comportamento de emit_nfse (pending retorna existente;
        authorized lança FiscalDocumentAlreadyAuthorized).
        """
        from apps.fiscal.models import FiscalDocument, FiscalEvent
        from apps.fiscal.services.nfe_builder import NFeBuilder, NFeItem
        from apps.fiscal.services.ref_generator import next_fiscal_ref

        if config is None:
            config = cls.get_config()

        # Idempotência
        existing = (
            FiscalDocument.objects.filter(
                service_order=service_order,
                document_type=FiscalDocument.DocumentType.NFE,
            )
            .select_for_update()
            .order_by("-created_at")
            .first()
        )
        if existing:
            if existing.status == FiscalDocument.Status.AUTHORIZED:
                raise FiscalDocumentAlreadyAuthorized(
                    f"OS #{service_order.number} já possui NF-e autorizada (doc pk={existing.pk})."
                )
            if existing.status == FiscalDocument.Status.PENDING:
                return existing

        person = cls._get_person_for_os(service_order)
        items = cls._items_from_os(service_order)

        if tax_config is None:
            tax_config = NFeBuilder.tax_config_from_fiscal_config(config)

        ref, _seq = next_fiscal_ref(config, "NFE")
        payload = NFeBuilder.build(items, config, person, tax_config, ref,
                                   forma_pagamento=forma_pagamento)

        from decimal import Decimal
        total_value = sum(
            item.quantidade * item.valor_unitario - item.valor_desconto
            for item in items
        )

        doc = FiscalDocument.objects.create(
            document_type=FiscalDocument.DocumentType.NFE,
            status=FiscalDocument.Status.PENDING,
            ref=ref,
            config=config,
            service_order=service_order,
            destinatario=person,
            payload_enviado=payload,
            total_value=total_value,
            environment=config.environment,
        )

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_REQUEST,
            payload=payload,
            triggered_by=FiscalEvent.TriggeredBy.USER,
        )

        with FocusNFeClient() as client:
            resp = client.emit_nfe(ref, payload)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_RESPONSE,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=FiscalEvent.TriggeredBy.USER,
        )

        cls._raise_for_http(resp)

        doc.ultima_resposta = resp.data or {}
        if resp.data:
            focus_status = resp.data.get("status", "")
            new_status = _FOCUS_STATUS_MAP.get(focus_status, "")
            if new_status and new_status != "pending":
                doc.status = new_status
                cls._apply_focus_data(doc, resp.data)
        doc.save(update_fields=["ultima_resposta", "status", "key", "number",
                                 "caminho_xml", "caminho_pdf", "mensagem_sefaz",
                                 "authorized_at", "cancelled_at"])

        if doc.status == FiscalDocument.Status.PENDING:
            from apps.fiscal.tasks import poll_fiscal_document
            poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)

        return doc

    @classmethod
    @transaction.atomic
    def emit_manual_nfe(
        cls,
        input_data: dict[str, Any],
        user: Any,
        config: "FiscalConfigModel | None" = None,
    ) -> "FiscalDocument":
        """Emite NF-e de produto manual (ad-hoc, sem OS vinculada).

        Args:
            input_data: validated_data de ManualNfeInputSerializer.
            user: usuário autenticado — salvo em created_by.
            config: emissor; se None, usa get_config().
        """
        from apps.fiscal.models import FiscalDocument, FiscalEvent
        from apps.fiscal.services.nfe_builder import NFeBuilder, NFeItem, NFeTaxConfig
        from apps.fiscal.services.ref_generator import next_fiscal_ref
        from apps.persons.models import Person

        if config is None:
            config = cls.get_config()

        manual_reason = input_data.get("manual_reason", "").strip()
        if not manual_reason:
            raise FiscalValidationError("manual_reason é obrigatório para emissão manual.")

        person = Person.objects.prefetch_related("documents", "addresses").get(
            pk=input_data["destinatario_id"]
        )

        # Monta NFeTaxConfig: respeita override do usuário, senão usa config defaults
        from decimal import Decimal
        tax_config = NFeTaxConfig(
            cst_icms=input_data.get("cst_icms") or config.cst_icms_saida,
            icms_aliquota=Decimal(str(input_data["icms_aliquota"])) if input_data.get("icms_aliquota") else config.icms_aliquota_intraestadual,
            icms_modalidade_base_calculo=config.icms_modalidade_base_calculo,
            cst_pis=config.cst_pis_saida,
            pis_aliquota=config.aliquota_pis,
            cst_cofins=config.cst_cofins_saida,
            cofins_aliquota=config.aliquota_cofins,
        )

        items = [
            NFeItem(
                codigo_produto=it.get("codigo_produto", ""),
                descricao=it["descricao"],
                ncm=it["ncm"],
                unidade=it.get("unidade", "UN"),
                quantidade=Decimal(str(it["quantidade"])),
                valor_unitario=Decimal(str(it["valor_unitario"])),
                valor_desconto=Decimal(str(it.get("valor_desconto", 0))),
            )
            for it in input_data.get("itens", [])
        ]

        ref, _seq = next_fiscal_ref(config, "NFE")
        payload = NFeBuilder.build(
            items, config, person, tax_config, ref,
            forma_pagamento=input_data.get("forma_pagamento", "01"),
            observacoes=input_data.get("observacoes", ""),
        )

        total_value = sum(
            item.quantidade * item.valor_unitario - item.valor_desconto
            for item in items
        )

        doc = FiscalDocument.objects.create(
            document_type=FiscalDocument.DocumentType.NFE,
            status=FiscalDocument.Status.PENDING,
            ref=ref,
            config=config,
            service_order=None,
            destinatario=person,
            manual_reason=manual_reason,
            payload_enviado=payload,
            total_value=total_value,
            environment=config.environment,
            created_by=user,
        )

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_REQUEST,
            payload=payload,
            triggered_by=FiscalEvent.TriggeredBy.USER_MANUAL,
        )

        with FocusNFeClient() as client:
            resp = client.emit_nfe(ref, payload)

        FiscalEvent.objects.create(
            document=doc,
            event_type=FiscalEvent.EventType.EMIT_RESPONSE,
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=FiscalEvent.TriggeredBy.USER_MANUAL,
        )

        cls._raise_for_http(resp)

        doc.ultima_resposta = resp.data or {}
        if resp.data:
            focus_status = resp.data.get("status", "")
            new_status = _FOCUS_STATUS_MAP.get(focus_status, "")
            if new_status and new_status != "pending":
                doc.status = new_status
                cls._apply_focus_data(doc, resp.data)
        doc.save(update_fields=["ultima_resposta", "status", "key", "number",
                                 "caminho_xml", "caminho_pdf", "mensagem_sefaz",
                                 "authorized_at", "cancelled_at"])

        if doc.status == FiscalDocument.Status.PENDING:
            from apps.fiscal.tasks import poll_fiscal_document
            poll_fiscal_document.apply_async(args=[str(doc.pk)], countdown=10)

        return doc

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _get_person_for_os(service_order: Any) -> Any:
        """Resolve Person a partir da OS.

        Usa destinatario FK se já preenchida; caso contrário tenta via customer_uuid.

        Raises:
            NfseBuilderError: não foi possível resolver Person.
        """
        from apps.persons.models import Person

        # FK direta (06C+)
        if hasattr(service_order, "destinatario_id") and service_order.destinatario_id:
            return (
                Person.objects.prefetch_related("documents", "addresses")
                .get(pk=service_order.destinatario_id)
            )

        # Fallback: customer_uuid → UnifiedCustomer → Person via CPF hash
        if service_order.customer_uuid:
            try:
                from apps.customers.models import UnifiedCustomer
                from apps.persons.models import PersonDocument
                from apps.persons.utils import sha256_hex

                uc = UnifiedCustomer.objects.get(id=service_order.customer_uuid)
                if uc.cpf:
                    cpf_hash = sha256_hex(str(uc.cpf).replace(".", "").replace("-", ""))
                    doc_qs = (
                        PersonDocument.objects.filter(value_hash=cpf_hash, is_primary=True)
                        .select_related("person")
                    )
                    if doc_qs.exists():
                        person_pk = doc_qs.first().person_id
                        return (
                            Person.objects.prefetch_related("documents", "addresses")
                            .get(pk=person_pk)
                        )
            except Exception as exc:
                logger.warning("_get_person_for_os: falha ao resolver via customer_uuid: %s", exc)

        raise NfseBuilderError(
            f"OS #{service_order.number} não tem destinatario vinculado. "
            f"Vincule um Person ao cliente desta OS ou emita a NF-e pela página manual."
        )

    @staticmethod
    def _apply_focus_data(doc: "FiscalDocument", data: dict[str, Any]) -> None:
        """Aplica campos da resposta Focus ao FiscalDocument (sem salvar)."""
        doc.key = data.get("chave_nfe", "") or data.get("numero_nfse", "") or ""
        doc.number = data.get("numero_nfse", "") or data.get("numero", "") or ""
        doc.caminho_xml = data.get("caminho_xml_nota_fiscal", "") or ""
        doc.caminho_pdf = data.get("caminho_danfe", "") or data.get("caminho_pdf", "") or ""
        doc.mensagem_sefaz = data.get("mensagem_sefaz", "") or ""
        doc.natureza_rejeicao = data.get("natureza_operacao", "") or ""

        if doc.status == "authorized" and not doc.authorized_at:
            doc.authorized_at = timezone.now()
        if doc.status == "cancelled" and not doc.cancelled_at:
            doc.cancelled_at = timezone.now()

    @staticmethod
    def _items_from_os(service_order: Any) -> list:
        """Monta lista de NFeItem a partir das peças da OS.

        Tenta puxar NCM de PecaCanonica; se ausente, ncm="".
        A validação de NCM vazio é responsabilidade do NFeBuilder.

        Raises:
            NfeBuilderError: OS sem peças cadastradas.
        """
        from apps.fiscal.services.nfe_builder import NFeItem
        from decimal import Decimal

        # ServiceOrderPart está em service_orders — import lazy
        try:
            from apps.service_orders.models import ServiceOrderPart
        except ImportError:
            raise NfeBuilderError("Modelo ServiceOrderPart não encontrado.")

        parts = ServiceOrderPart.objects.filter(
            service_order=service_order, is_active=True
        ).select_related("product")

        if not parts.exists():
            raise NfeBuilderError(
                f"OS #{service_order.number} não tem peças cadastradas para emitir NF-e."
            )

        items = []
        for part in parts:
            # NCM: tenta product.ncm → part.ncm → part_number (fallback)
            ncm = ""
            if part.product_id:
                ncm = getattr(part.product, "ncm", "") or ""
            if not ncm:
                ncm = getattr(part, "ncm", "") or ""
            if not ncm:
                ncm = part.part_number or ""

            # Unidade vem do Product vinculado, se houver
            unidade = "UN"
            if part.product_id:
                unidade = getattr(part.product, "unit", "UN") or "UN"

            items.append(
                NFeItem(
                    codigo_produto=part.part_number or str(part.pk)[:8],
                    descricao=part.description or "Peça automotiva",
                    ncm=ncm,
                    unidade=unidade,
                    quantidade=Decimal(str(part.quantity or 1)),
                    valor_unitario=Decimal(str(part.unit_price or 0)),
                    valor_desconto=Decimal(str(part.discount or 0)),
                )
            )

        return items

    @staticmethod
    def _raise_for_http(resp: FocusResponse) -> None:
        """Traduz http_status_code em exceção de domínio.

        Chamado após cada resposta HTTP da Focus.
        2xx: retorna normalmente (sem exceção).
        4xx/5xx: levanta a exceção adequada com o payload de erro.

        Args:
            resp: FocusResponse retornado pelo FocusNFeClient.

        Raises:
            FocusAuthError: 401 ou 403 — token inválido/sem permissão.
            FocusNotFoundError: 404 — ref não encontrada na Focus.
            FocusConflict: 409 — conflito de ref.
            FocusRateLimitError: 429 — rate limit excedido.
            FocusValidationError: 400/415/422 — payload inválido (não fazer retry).
            FocusServerError: 5xx — erro interno Focus/SEFAZ (fazer retry).
        """
        sc = resp.status_code
        if 200 <= sc < 300:
            return

        error_payload: Any = resp.data or {"raw": resp.raw_text}

        if sc in (401, 403):
            raise FocusAuthError(error_payload)
        if sc == 404:
            raise FocusNotFoundError(error_payload)
        if sc == 409:
            raise FocusConflict(error_payload)
        if sc == 429:
            raise FocusRateLimitError(error_payload)
        if 400 <= sc < 500:
            raise FocusValidationError(error_payload)
        if sc >= 500:
            raise FocusServerError(error_payload)

        # Status desconhecido — tratar como erro de servidor
        logger.warning("FiscalService: status_code inesperado %d", sc)
        raise FocusServerError(error_payload)
