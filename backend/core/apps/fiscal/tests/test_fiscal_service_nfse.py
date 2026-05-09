"""
Testes T8: FiscalService.emit_nfse + consult + cancel — Ciclo 06C.

Estratégia: mocks de ORM (MagicMock) + respx para HTTP.
Nenhum teste requer banco de dados.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, call, patch

import httpx
import pytest
import respx

from apps.fiscal.clients.focus_nfe_client import FocusNFeClient
from apps.fiscal.exceptions import (
    FiscalDocumentAlreadyAuthorized,
    FiscalInvalidStatus,
    FocusAuthError,
    FocusValidationError,
)
from apps.fiscal.services.fiscal_service import FiscalService

# ─── Base URL usada pelo FocusNFeClient em testes (FOCUS_NFE_AMBIENTE=homologacao)
FOCUS_BASE = "https://homologacao.focusnfe.com.br"

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _make_config() -> MagicMock:
    """Cria FiscalConfigModel mock com valores realistas."""
    cfg = MagicMock()
    cfg.cnpj = "12345678000195"
    cfg.inscricao_municipal = "123456"
    cfg.serie_rps = "1"
    cfg.aliquota_iss_default = Decimal("2.00")
    cfg.environment = "homologacao"
    cfg.seq_nfse = 1
    cfg.pk = 1
    return cfg


def _make_service_order() -> MagicMock:
    """Cria ServiceOrder mock com campos mínimos para ManausNfseBuilder."""
    os_mock = MagicMock()
    os_mock.pk = uuid.uuid4()
    os_mock.number = 42
    os_mock.customer_id = 99
    os_mock.services_total = Decimal("500.00")
    os_mock.parts_total = Decimal("200.00")
    os_mock.os_type = "mechanical"
    os_mock.plate = "ABC1234"
    os_mock.make = "Toyota"
    os_mock.model = "Corolla"
    os_mock.year = 2022
    os_mock.labor_items.all.return_value = []
    os_mock.parts.all.return_value = []
    return os_mock


def _make_doc(status: str = "pending", ref: str = "12345678-NFSE-20260424-000001") -> MagicMock:
    """Cria FiscalDocument mock."""
    doc = MagicMock()
    doc.pk = uuid.uuid4()
    doc.ref = ref
    doc.status = status
    doc.ultima_resposta = {}
    return doc


# ─── emit_nfse ────────────────────────────────────────────────────────────────


@respx.mock
def test_emit_nfse_with_processing_response():
    """Focus 201 + status=processando_autorizacao → doc criado com status=pending, poll agendado."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(201, json={"status": "processando_autorizacao"})
    )

    config = _make_config()
    os_mock = _make_service_order()

    doc_mock = _make_doc(status="pending")
    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None  # sem doc existente
    manager_mock.create.return_value = doc_mock

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService.get_config",
            return_value=config,
        ),
        patch(
            "apps.fiscal.models.FiscalDocument.objects",
            manager_mock,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}, "rps": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects") as fe_mock,
        patch(
            "apps.fiscal.services.fiscal_service.poll_fiscal_document",
        ) as poll_mock,
    ):
        result = FiscalService.emit_nfse(service_order=os_mock, config=config)

    assert result is doc_mock
    assert result.status == "pending"
    poll_mock.apply_async.assert_called_once()
    # verify countdown=10
    _, kwargs = poll_mock.apply_async.call_args
    assert kwargs.get("countdown") == 10


@respx.mock
def test_emit_nfse_idempotent_pending_exists():
    """Documento pending existente → retorna existente sem POST para Focus."""
    existing_doc = _make_doc(status="pending")

    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = existing_doc

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
        patch("apps.fiscal.services.fiscal_service.next_fiscal_ref") as ref_mock,
        patch("apps.fiscal.services.fiscal_service.ManausNfseBuilder.build") as build_mock,
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document") as poll_mock,
    ):
        result = FiscalService.emit_nfse(
            service_order=_make_service_order(),
            config=_make_config(),
        )

    assert result is existing_doc
    # Nenhum POST deve ter sido feito
    ref_mock.assert_not_called()
    build_mock.assert_not_called()
    poll_mock.apply_async.assert_not_called()
    assert not respx.calls


@respx.mock
def test_emit_nfse_raises_already_authorized():
    """Documento já autorizado → FiscalDocumentAlreadyAuthorized."""
    existing_doc = _make_doc(status="authorized")

    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = existing_doc

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
    ):
        with pytest.raises(FiscalDocumentAlreadyAuthorized):
            FiscalService.emit_nfse(
                service_order=_make_service_order(),
                config=_make_config(),
            )


@respx.mock
def test_emit_nfse_focus_400_raises_validation_error():
    """Focus retorna 400 → FocusValidationError levantada após gravar eventos."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(
            400, json={"mensagem": "CNPJ inválido", "codigo": "requisicao_invalida"}
        )
    )

    doc_mock = _make_doc()
    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None
    manager_mock.create.return_value = doc_mock

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document"),
    ):
        with pytest.raises(FocusValidationError):
            FiscalService.emit_nfse(
                service_order=_make_service_order(),
                config=_make_config(),
            )


@respx.mock
def test_emit_nfse_focus_401_raises_auth_error():
    """Focus retorna 401 → FocusAuthError."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(401, json={"mensagem": "Token inválido"})
    )

    doc_mock = _make_doc()
    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None
    manager_mock.create.return_value = doc_mock

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document"),
    ):
        with pytest.raises(FocusAuthError):
            FiscalService.emit_nfse(
                service_order=_make_service_order(),
                config=_make_config(),
            )


@respx.mock
def test_emit_nfse_creates_emit_request_event():
    """emit_nfse cria FiscalEvent(EMIT_REQUEST) antes da chamada HTTP."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(201, json={"status": "processando_autorizacao"})
    )

    doc_mock = _make_doc()
    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None
    manager_mock.create.return_value = doc_mock

    events_created: list[dict] = []

    def capture_event_create(**kwargs: object) -> MagicMock:
        events_created.append(kwargs)
        return MagicMock()

    fe_manager = MagicMock()
    fe_manager.create.side_effect = capture_event_create

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects", fe_manager),
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document"),
    ):
        FiscalService.emit_nfse(service_order=_make_service_order(), config=_make_config())

    event_types = [e["event_type"] for e in events_created]
    # FiscalEvent.EventType.EMIT_REQUEST value is "EMIT_REQUEST"
    assert any("EMIT_REQUEST" in str(et) for et in event_types), (
        f"EMIT_REQUEST not found in events: {event_types}"
    )


@respx.mock
def test_emit_nfse_creates_emit_response_event():
    """emit_nfse cria FiscalEvent(EMIT_RESPONSE) com http_status e duration_ms após chamada HTTP."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(201, json={"status": "processando_autorizacao"})
    )

    doc_mock = _make_doc()
    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None
    manager_mock.create.return_value = doc_mock

    events_created: list[dict] = []

    def capture_event_create(**kwargs: object) -> MagicMock:
        events_created.append(kwargs)
        return MagicMock()

    fe_manager = MagicMock()
    fe_manager.create.side_effect = capture_event_create

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects", fe_manager),
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document"),
    ):
        FiscalService.emit_nfse(service_order=_make_service_order(), config=_make_config())

    event_types = [e["event_type"] for e in events_created]
    assert any("EMIT_RESPONSE" in str(et) for et in event_types), (
        f"EMIT_RESPONSE not found in events: {event_types}"
    )
    # Verificar que EMIT_RESPONSE tem http_status
    response_events = [e for e in events_created if "EMIT_RESPONSE" in str(e.get("event_type", ""))]
    assert len(response_events) >= 1
    assert response_events[0]["http_status"] == 201


# ─── consult ──────────────────────────────────────────────────────────────────


@respx.mock
def test_consult_autorizado_updates_doc():
    """consult com status 'autorizado' → doc.status = AUTHORIZED com key, number, caminho_xml."""
    ref = "12345678-NFSE-20260424-000001"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "autorizado",
                "numero": "100",
                "protocolo": "PROT123",
                "caminho_xml_nota_fiscal": "/path/to/xml",
                "caminho_danfe": "/path/to/pdf",
            },
        )
    )

    doc = _make_doc(status="pending", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    from apps.fiscal.models import FiscalDocument

    assert result.status == FiscalDocument.Status.AUTHORIZED
    assert result.number == "100"
    assert result.protocolo == "PROT123"
    assert result.caminho_xml == "/path/to/xml"
    assert result.caminho_pdf == "/path/to/pdf"
    assert result.authorized_at is not None


@respx.mock
def test_consult_processando_no_change():
    """consult com status 'processando_autorizacao' → doc permanece PENDING."""
    ref = "12345678-NFSE-20260424-000002"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={"status": "processando_autorizacao"},
        )
    )

    doc = _make_doc(status="pending", ref=ref)
    original_status = doc.status

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    assert result.status == original_status
    # save não deve ter sido chamado para mudança de status
    doc.save.assert_not_called()


@respx.mock
def test_consult_erro_autorizacao_sets_rejected():
    """consult com status 'erro_autorizacao' → doc.status = REJECTED com mensagem_sefaz."""
    ref = "12345678-NFSE-20260424-000003"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "erro_autorizacao",
                "mensagem_sefaz": "CNPJ do tomador inválido",
                "natureza_rejeicao": "REJEICAO",
            },
        )
    )

    doc = _make_doc(status="pending", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    from apps.fiscal.models import FiscalDocument

    assert result.status == FiscalDocument.Status.REJECTED
    assert result.mensagem_sefaz == "CNPJ do tomador inválido"
    assert result.rejection_reason == "CNPJ do tomador inválido"
    assert result.natureza_rejeicao == "REJEICAO"


@respx.mock
def test_consult_cancelado_updates_doc():
    """consult com status 'cancelado' → doc.status = CANCELLED com cancelled_at."""
    ref = "12345678-NFSE-20260424-000004"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={"status": "cancelado"},
        )
    )

    doc = _make_doc(status="authorized", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    from apps.fiscal.models import FiscalDocument

    assert result.status == FiscalDocument.Status.CANCELLED
    assert result.cancelled_at is not None


@respx.mock
def test_consult_creates_fiscal_event():
    """consult cria FiscalEvent(CONSULT) com http_status e response."""
    ref = "12345678-NFSE-20260424-000005"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={"status": "processando_autorizacao"},
        )
    )

    doc = _make_doc(status="pending", ref=ref)

    events_created: list[dict] = []

    def capture(**kwargs: object) -> MagicMock:
        events_created.append(kwargs)
        return MagicMock()

    fe_manager = MagicMock()
    fe_manager.create.side_effect = capture

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects", fe_manager),
    ):
        FiscalService.consult(doc)

    assert len(events_created) == 1
    ev = events_created[0]
    assert "CONSULT" in str(ev["event_type"])
    assert ev["http_status"] == 200
    assert ev["response"] == {"status": "processando_autorizacao"}


# ─── cancel ───────────────────────────────────────────────────────────────────


@respx.mock
def test_cancel_authorized_doc_success():
    """cancel de doc autorizado com justificativa válida → doc.status = CANCELLED."""
    ref = "12345678-NFSE-20260424-000006"
    respx.delete(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(200, json={"status": "cancelado"})
    )

    doc = _make_doc(status="authorized", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.cancel(doc, "Cancelamento solicitado pelo cliente")

    from apps.fiscal.models import FiscalDocument

    assert result.status == FiscalDocument.Status.CANCELLED
    assert result.cancelled_at is not None


@respx.mock
def test_cancel_non_authorized_raises():
    """cancel de doc não autorizado (pending) → FiscalInvalidStatus."""
    doc = _make_doc(status="pending", ref="12345678-NFSE-20260424-000007")

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
    ):
        with pytest.raises(FiscalInvalidStatus):
            FiscalService.cancel(doc, "Justificativa qualquer longa o suficiente")


@respx.mock
def test_cancel_short_justificativa_raises():
    """cancel com justificativa < 15 chars → FocusValidationError."""
    doc = _make_doc(status="authorized", ref="12345678-NFSE-20260424-000008")

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
    ):
        with pytest.raises(FocusValidationError):
            FiscalService.cancel(doc, "curta")


@respx.mock
def test_cancel_creates_fiscal_event():
    """cancel cria FiscalEvent(CANCEL_REQUEST) com justificativa no payload."""
    ref = "12345678-NFSE-20260424-000009"
    respx.delete(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(200, json={"status": "cancelado"})
    )

    doc = _make_doc(status="authorized", ref=ref)
    justificativa = "Cancelamento por solicitação do cliente após revisão"

    events_created: list[dict] = []

    def capture(**kwargs: object) -> MagicMock:
        events_created.append(kwargs)
        return MagicMock()

    fe_manager = MagicMock()
    fe_manager.create.side_effect = capture

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects", fe_manager),
    ):
        FiscalService.cancel(doc, justificativa)

    assert len(events_created) == 1
    ev = events_created[0]
    assert "CANCEL_REQUEST" in str(ev["event_type"])
    assert ev["payload"] == {"justificativa": justificativa}
    assert ev["http_status"] == 200


# ─── Extras para garantir cobertura ≥ 15 testes ───────────────────────────────


@respx.mock
def test_cancel_rejected_doc_raises():
    """cancel de doc rejeitado → FiscalInvalidStatus."""
    doc = _make_doc(status="rejected", ref="12345678-NFSE-20260424-000010")

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
    ):
        with pytest.raises(FiscalInvalidStatus):
            FiscalService.cancel(doc, "Justificativa longa o suficiente para passar")


@respx.mock
def test_consult_denegado_sets_rejected():
    """consult com status 'denegado' (alias de erro_autorizacao) → REJECTED."""
    ref = "12345678-NFSE-20260424-000011"
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "denegado",
                "mensagem_sefaz": "Documento denegado pela SEFAZ",
            },
        )
    )

    doc = _make_doc(status="pending", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    from apps.fiscal.models import FiscalDocument

    assert result.status == FiscalDocument.Status.REJECTED
    assert result.mensagem_sefaz == "Documento denegado pela SEFAZ"


@respx.mock
def test_emit_nfse_poll_scheduled_with_doc_pk():
    """poll_fiscal_document.apply_async é chamado com o pk do documento como string."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(201, json={"status": "processando_autorizacao"})
    )

    doc_pk = uuid.uuid4()
    doc_mock = _make_doc(status="pending")
    doc_mock.pk = doc_pk

    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None
    manager_mock.create.return_value = doc_mock

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
        patch(
            "apps.fiscal.services.fiscal_service.poll_fiscal_document",
        ) as poll_mock,
    ):
        FiscalService.emit_nfse(service_order=_make_service_order(), config=_make_config())

    poll_mock.apply_async.assert_called_once_with(
        args=[str(doc_pk)], countdown=10
    )


@respx.mock
def test_emit_nfse_doc_created_with_correct_type_and_status():
    """emit_nfse cria FiscalDocument com document_type=NFSE e status=PENDING."""
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=httpx.Response(201, json={"status": "processando_autorizacao"})
    )

    doc_mock = _make_doc(status="pending")
    create_kwargs: dict = {}

    manager_mock = MagicMock()
    manager_mock.filter.return_value.first.return_value = None

    def capture_create(**kwargs: object) -> MagicMock:
        create_kwargs.update(kwargs)
        return doc_mock

    manager_mock.create.side_effect = capture_create

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.models.FiscalDocument.objects", manager_mock),
        patch(
            "apps.fiscal.services.fiscal_service.FiscalService._get_person_for_os",
            return_value=None,
        ),
        patch(
            "apps.fiscal.services.fiscal_service.next_fiscal_ref",
            return_value=("12345678-NFSE-20260424-000001", 1),
        ),
        patch(
            "apps.fiscal.services.fiscal_service.ManausNfseBuilder.build",
            return_value={"servico": {}},
        ),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
        patch("apps.fiscal.services.fiscal_service.poll_fiscal_document"),
    ):
        FiscalService.emit_nfse(service_order=_make_service_order(), config=_make_config())

    from apps.fiscal.models import FiscalDocument

    assert create_kwargs["document_type"] == FiscalDocument.DocumentType.NFSE
    assert create_kwargs["status"] == FiscalDocument.Status.PENDING
    assert create_kwargs["ref"] == "12345678-NFSE-20260424-000001"


@respx.mock
def test_cancel_empty_justificativa_raises():
    """cancel com justificativa vazia (após strip) → FocusValidationError."""
    doc = _make_doc(status="authorized", ref="12345678-NFSE-20260424-000012")

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
    ):
        with pytest.raises(FocusValidationError):
            FiscalService.cancel(doc, "   ")


@respx.mock
def test_consult_autorizado_sets_ultima_resposta():
    """consult com 'autorizado' atualiza ultima_resposta com o payload completo da Focus."""
    ref = "12345678-NFSE-20260424-000013"
    focus_payload = {
        "status": "autorizado",
        "numero": "200",
        "protocolo": "PROT456",
        "caminho_xml_nota_fiscal": "/xml/path",
    }
    respx.get(f"{FOCUS_BASE}/v2/nfse/{ref}").mock(
        return_value=httpx.Response(200, json=focus_payload)
    )

    doc = _make_doc(status="pending", ref=ref)

    with (
        patch("apps.fiscal.services.fiscal_service.transaction.atomic", lambda f: f),
        patch("apps.fiscal.services.fiscal_service.FiscalEvent.objects"),
    ):
        result = FiscalService.consult(doc)

    assert result.ultima_resposta == focus_payload
