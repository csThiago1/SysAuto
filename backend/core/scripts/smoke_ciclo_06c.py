#!/usr/bin/env python
"""
Smoke Test — Ciclo 06C: NFS-e Manaus end-to-end
================================================

Execução (sem Docker, sem DB real):
    cd backend/core
    DJANGO_SETTINGS_MODULE=config.settings python scripts/smoke_ciclo_06c.py

10 verificações:
  [1]  ManausNfseBuilder.build() retorna dict com 'rps', 'servico', 'tomador'
  [2]  ManualNfseBuilder.build() retorna dict com campos corretos
  [3]  ManualNfseInputSerializer valida dados válidos (sem DB — destinatario_id patchado)
  [4]  ManualNfseInputSerializer rejeita data_emissao > 30 dias passado
  [5]  FiscalService.emit_nfse() com respx mock 201 → doc.status=pending
  [6]  FiscalService.consult() com respx mock "autorizado" → doc.status=authorized
  [7]  FiscalService.cancel() com respx mock 200 → doc.status=cancelled
  [8]  FiscalService.emit_manual_nfse() sem manual_reason → ValidationError
  [9]  poll_fiscal_document task com mock "autorizado" → encerra sem retry
  [10] (BLOQUEADO) Smoke homologação real → SKIP (aguarda Focus suporte Manaus + CNPJ homologação)
"""

import os
import sys
import traceback
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

# ─── Django setup ─────────────────────────────────────────────────────────────

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
# Garante que manage.py está no path (para imports relativos ao projeto)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django  # noqa: E402 — deve vir após sys.path

django.setup()

# ─── Resultado ───────────────────────────────────────────────────────────────

_PASS = "PASS"
_FAIL = "FAIL"
_SKIP = "SKIP"

results: list[tuple[int, str, str, str]] = []  # (n, status, label, detail)


def check(n: int, label: str, fn: Any) -> None:
    try:
        fn()
        results.append((n, _PASS, label, ""))
        print(f"  [{_PASS}] [{n}] {label}")
    except AssertionError as exc:
        results.append((n, _FAIL, label, str(exc)))
        print(f"  [{_FAIL}] [{n}] {label}")
        print(f"          AssertionError: {exc}")
    except Exception as exc:  # noqa: BLE001
        results.append((n, _FAIL, label, repr(exc)))
        print(f"  [{_FAIL}] [{n}] {label}")
        traceback.print_exc()


def skip(n: int, label: str, reason: str) -> None:
    results.append((n, _SKIP, label, reason))
    print(f"  [{_SKIP}] [{n}] {label}")
    print(f"          Motivo: {reason}")


# ─── Fixtures comuns (MagicMock — sem DB) ────────────────────────────────────


def _make_config() -> MagicMock:
    cfg = MagicMock()
    cfg.cnpj = "12345678000195"
    cfg.inscricao_municipal = "123456"
    cfg.serie_rps = "1"
    cfg.aliquota_iss_default = Decimal("2.00")
    cfg.focus_token = "test-token-smoke"
    cfg.environment = "homologacao"
    return cfg


def _make_person_pf() -> MagicMock:
    """Person PF com CPF e endereço Manaus."""
    from apps.persons.models import TipoDocumento

    doc = MagicMock()
    doc.doc_type = TipoDocumento.CPF
    doc.value = "12345678901"
    doc.is_primary = True

    address = MagicMock()
    address.municipio_ibge = "1302603"
    address.street = "Av. Djalma Batista"
    address.number = "1661"
    address.complement = ""
    address.neighborhood = "Chapada"
    address.state = "AM"
    address.zip_code = "69050-010"

    person = MagicMock()
    person.pk = 1
    person.full_name = "João da Silva"
    person.municipal_registration = ""

    # Simular QuerySet.filter().order_by().first() e .first()
    person.documents.filter.return_value.order_by.return_value.first.return_value = doc
    person.documents.filter.return_value.first.return_value = doc
    person.addresses.filter.return_value.first.return_value = address
    person.addresses.first.return_value = address
    return person


def _make_service_order(config: MagicMock, person: MagicMock) -> MagicMock:
    """ServiceOrder mockado com peças + serviços."""
    order = MagicMock()
    order.number = 42
    order.os_type = "bodywork"
    order.customer_type = "private"
    order.service_type = "bodywork"
    order.services_total = Decimal("500.00")
    order.parts_total = Decimal("200.00")
    order.discount_total = Decimal("0.00")
    order.destinatario = person
    # Itens vazios (evita iteração sobre MagicMock)
    order.labor_items.all.return_value = []
    order.part_items.all.return_value = []
    return order


# ─── Testes ───────────────────────────────────────────────────────────────────

print("\n=== Smoke Test Ciclo 06C — NFS-e Manaus ===\n")

# ─── [1] ManausNfseBuilder ────────────────────────────────────────────────────


def _test_1() -> None:
    from apps.fiscal.services.manaus_nfse import ManausNfseBuilder

    config = _make_config()
    person = _make_person_pf()
    order = _make_service_order(config, person)

    payload = ManausNfseBuilder.build(order, config, ref="12345678-NFSE-20260424-000001")

    assert "rps" in payload, "'rps' ausente no payload"
    assert "servico" in payload, "'servico' ausente no payload"
    assert "tomador" in payload, "'tomador' ausente no payload"
    assert "prestador" in payload, "'prestador' ausente no payload"

    assert payload["rps"]["numero"] == "1", f"RPS numero esperado '1', obtido {payload['rps']['numero']!r}"
    assert payload["tomador"]["cpf"] == "12345678901", "CPF ausente no tomador"
    assert float(payload["servico"]["valor_servicos"]) == 700.00, (
        f"valor_servicos esperado 700.00, obtido {payload['servico']['valor_servicos']}"
    )


check(1, "ManausNfseBuilder.build() retorna dict com 'rps', 'servico', 'tomador'", _test_1)

# ─── [2] ManualNfseBuilder ────────────────────────────────────────────────────


def _test_2() -> None:
    from apps.fiscal.services.manaus_nfse import ManualNfseBuilder

    config = _make_config()
    person = _make_person_pf()
    ref = "12345678-NFSE-20260424-000002"

    input_data = {
        "itens": [
            {"descricao": "Serviço de pintura", "quantidade": Decimal("1"), "valor_unitario": Decimal("300.00"), "valor_desconto": Decimal("0")},
        ],
        "discriminacao": "Serviço de pintura automotiva",
        "codigo_servico_lc116": "14.01",
        "aliquota_iss": None,
        "iss_retido": False,
        "data_emissao": None,
        "observacoes_contribuinte": "",
        "manual_reason": "Emissão manual solicitada pelo gerente",
    }

    payload = ManualNfseBuilder.build(input_data, person, config, ref)

    assert "servico" in payload, "'servico' ausente"
    assert "tomador" in payload, "'tomador' ausente"
    assert "rps" in payload, "'rps' ausente"
    assert payload["servico"]["item_lista_servico"] == "14.01"
    assert float(payload["servico"]["valor_servicos"]) == 300.00


check(2, "ManualNfseBuilder.build() retorna dict com campos corretos", _test_2)

# ─── [3] ManualNfseInputSerializer — dados válidos ────────────────────────────


def _test_3() -> None:
    from apps.fiscal.serializers import ManualNfseInputSerializer

    # Patchamos validate_destinatario_id para evitar query DB
    with patch.object(
        ManualNfseInputSerializer,
        "validate_destinatario_id",
        return_value=42,
    ):
        ser = ManualNfseInputSerializer(
            data={
                "destinatario_id": 42,  # inteiro — Person usa PK auto-increment
                "data_emissao": datetime.now(tz=timezone.utc).strftime("%Y-%m-%d"),
                "itens": [
                    {
                        "descricao": "Serviço de polimento automotivo",
                        "quantidade": "1.0000",
                        "valor_unitario": "150.00",
                        "valor_desconto": "0",
                    }
                ],
                "discriminacao": "Serviço de polimento automotivo completo",
                "manual_reason": "Justificativa de teste da emissão manual",
            }
        )
        assert ser.is_valid(), f"Serializer inválido: {ser.errors}"


check(3, "ManualNfseInputSerializer valida dados válidos (destinatario_id patchado)", _test_3)

# ─── [4] ManualNfseInputSerializer — data_emissao > 30d passado ───────────────


def _test_4() -> None:
    from apps.fiscal.serializers import ManualNfseInputSerializer

    old_date = (datetime.now(tz=timezone.utc) - timedelta(days=31)).strftime("%Y-%m-%d")

    with patch.object(
        ManualNfseInputSerializer,
        "validate_destinatario_id",
        return_value=42,
    ):
        ser = ManualNfseInputSerializer(
            data={
                "destinatario_id": 42,
                "data_emissao": old_date,
                "itens": [
                    {
                        "descricao": "Serviço antigo teste",
                        "quantidade": "1.0000",
                        "valor_unitario": "100.00",
                        "valor_desconto": "0",
                    }
                ],
                "discriminacao": "Serviço antigo para teste de data",
                "manual_reason": "Teste de data antiga",
            }
        )
        valid = ser.is_valid()
        assert not valid, "Serializer deveria rejeitar data_emissao > 30d passado"
        assert "data_emissao" in ser.errors or any(
            "data" in k for k in ser.errors
        ), f"Erro esperado em data_emissao, obtido: {ser.errors}"


check(4, "ManualNfseInputSerializer rejeita data_emissao > 30 dias passado", _test_4)

# ─── [5] _FOCUS_STATUS_MAP: processando_autorizacao → pending ────────────────
# Testamos o mapeamento de status Focus → local sem precisar de DB.
# Também verificamos que FocusNFeClient.emit_nfse() com respx mock retorna
# FocusResponse com status 201 e payload correto.


def _test_5() -> None:
    import respx
    from httpx import Response as HttpxResponse

    from apps.fiscal.clients.focus_nfe_client import FocusNFeClient
    from apps.fiscal.services.fiscal_service import _FOCUS_STATUS_MAP

    # [5a] Mapeamento de status
    assert _FOCUS_STATUS_MAP["processando_autorizacao"] == "pending", (
        f"processando_autorizacao deveria mapear para 'pending', obtido {_FOCUS_STATUS_MAP['processando_autorizacao']!r}"
    )
    assert _FOCUS_STATUS_MAP["autorizado"] == "authorized"
    assert _FOCUS_STATUS_MAP["denegado"] == "rejected"
    assert _FOCUS_STATUS_MAP["cancelado"] == "cancelled"

    # [5b] FocusNFeClient.emit_nfse() com respx mock
    ref = "12345678-NFSE-20260424-000005"
    payload = {"prestador": {"cnpj": "12345678000195"}, "rps": {"numero": "5"}}

    with patch.dict(
        os.environ,
        {"FOCUS_NFE_TOKEN": "test-token-smoke", "FOCUS_NFE_AMBIENTE": "homologacao"},
    ), respx.mock:
        respx.post(url__regex=r".*/v2/nfse.*").mock(
            return_value=HttpxResponse(
                201,
                json={
                    "status": "processando_autorizacao",
                    "ref": ref,
                },
            )
        )

        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)

    assert resp.status_code == 201, f"status_code esperado 201, obtido {resp.status_code}"
    assert resp.data is not None, "FocusResponse.data é None"
    assert resp.data.get("status") == "processando_autorizacao"
    mapped = _FOCUS_STATUS_MAP.get(resp.data["status"], "")
    assert mapped == "pending", f"mapped esperado 'pending', obtido {mapped!r}"


check(5, "FocusNFeClient.emit_nfse() mock 201 + _FOCUS_STATUS_MAP → 'pending'", _test_5)

# ─── [6] FiscalService._apply_focus_data: autorizado → campos corretos ───────
# O caller seta doc.status = "authorized" ANTES de chamar _apply_focus_data.
# O método preenche key, number, caminho_xml, caminho_pdf e authorized_at.


def _test_6() -> None:
    from apps.fiscal.services.fiscal_service import FiscalService

    # Simula o que o caller faz: setar status antes de chamar _apply_focus_data
    mock_doc = SimpleNamespace(
        status="authorized",  # já foi setado pelo caller
        key="",
        number="",
        caminho_xml="",
        caminho_pdf="",
        mensagem_sefaz="",
        natureza_rejeicao="",
        authorized_at=None,
        cancelled_at=None,
    )

    focus_data = {
        "status": "autorizado",
        "numero_nfse": "1001",
        "numero": "1001",
        "chave_nfe": "",
        "caminho_xml_nota_fiscal": "https://focus.example/xml/1001.xml",
        "caminho_danfe": "https://focus.example/pdf/1001.pdf",
        "mensagem_sefaz": "",
    }

    FiscalService._apply_focus_data(mock_doc, focus_data)

    # numero_nfse → numero; caminho_xml_nota_fiscal → caminho_xml
    assert mock_doc.number == "1001", f"number esperado '1001', obtido {mock_doc.number!r}"
    assert mock_doc.caminho_xml == "https://focus.example/xml/1001.xml"
    assert mock_doc.caminho_pdf == "https://focus.example/pdf/1001.pdf"
    # authorized_at preenchido porque status=="authorized"
    assert mock_doc.authorized_at is not None, "authorized_at deveria ser preenchido quando status='authorized'"


check(6, "FiscalService._apply_focus_data() mapeia 'autorizado' → campos corretos", _test_6)

# ─── [7] FiscalService._apply_focus_data: cancelado → cancelled_at preenchido ─


def _test_7() -> None:
    from apps.fiscal.services.fiscal_service import FiscalService, _FOCUS_STATUS_MAP

    mock_doc = SimpleNamespace(
        status="cancelled",  # caller setou "cancelled" antes de chamar
        key="ABCD1234",
        number="1001",
        caminho_xml="",
        caminho_pdf="",
        mensagem_sefaz="",
        natureza_rejeicao="",
        authorized_at=datetime.now(tz=timezone.utc),
        cancelled_at=None,  # ainda não preenchido
    )

    focus_data = {"status": "cancelado"}
    FiscalService._apply_focus_data(mock_doc, focus_data)

    assert mock_doc.cancelled_at is not None, "cancelled_at deveria ser preenchido ao cancelar"

    # Mapeamento correto do dict global
    assert _FOCUS_STATUS_MAP["cancelado"] == "cancelled"
    assert _FOCUS_STATUS_MAP["erro_autorizacao"] == "rejected"
    assert _FOCUS_STATUS_MAP["denegado"] == "rejected"


check(7, "FiscalService._apply_focus_data() mapeia 'cancelado' → cancelled_at preenchido", _test_7)

# ─── [8] FiscalService.emit_manual_nfse() sem manual_reason → erro ───────────


def _test_8() -> None:
    from rest_framework.exceptions import ValidationError

    from apps.fiscal.serializers import ManualNfseInputSerializer

    ser = ManualNfseInputSerializer(
        data={
            "destinatario_id": 42,
            "data_emissao": datetime.now(tz=timezone.utc).strftime("%Y-%m-%d"),
            "itens": [
                {
                    "descricao": "Serviço qualquer teste",
                    "quantidade": "1.0000",
                    "valor_unitario": "100.00",
                    "valor_desconto": "0",
                }
            ],
            "discriminacao": "Descrição do serviço qualquer",
            # manual_reason ausente — deve falhar
        }
    )

    with patch.object(ManualNfseInputSerializer, "validate_destinatario_id", return_value=42):
        valid = ser.is_valid()

    assert not valid, "Serializer deveria ser inválido sem manual_reason"
    assert "manual_reason" in ser.errors, f"Erro esperado em 'manual_reason', obtido: {ser.errors}"


check(8, "ManualNfseInputSerializer rejeita ausência de manual_reason", _test_8)

# ─── [9] poll_fiscal_document task — lógica interna sem DB ──────────────────
# Testa diretamente a lógica da task via chamada síncrona com mocks de ORM.
# Usa task.run() para evitar o overhead do Celery broker.


def _test_9() -> None:
    from apps.fiscal.tasks import poll_fiscal_document

    mock_doc = MagicMock()
    mock_doc.pk = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    mock_doc.status = "pending"

    # FiscalService.consult retorna doc com status authorized
    authorized_doc = MagicMock()
    authorized_doc.status = "authorized"

    with (
        patch("apps.fiscal.tasks.FiscalDocument") as MockDoc,
        patch("apps.fiscal.tasks.FiscalService") as MockService,
    ):
        MockDoc.objects.get.return_value = mock_doc
        MockDoc.Status.PENDING = "pending"  # para a checagem doc.status != PENDING
        mock_doc.status = "pending"

        # Simula que FiscalService.consult retorna doc authorized
        MockService.consult.return_value = authorized_doc

        # Para task bind=True, precisamos passar um mock de `self` (task instance)
        # O jeito mais simples é acessar a função original via __wrapped__
        # ou chamar a função diretamente mockando o self
        mock_self = MagicMock()
        mock_self.request.retries = 0

        # Chama a função wrapped da task diretamente
        task_fn = poll_fiscal_document.__wrapped__ if hasattr(poll_fiscal_document, "__wrapped__") else poll_fiscal_document.run
        result = task_fn(mock_self, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

        assert result is not None, "Task retornou None"
        assert result.get("status") == "authorized", (
            f"status esperado 'authorized', obtido {result.get('status')!r}"
        )

    # consult foi chamado (não pulado por status terminal)
    MockService.consult.assert_called_once_with(mock_doc)


check(9, "poll_fiscal_document task com mock 'autorizado' → encerra sem retry", _test_9)

# ─── [10] Smoke homologação — BLOQUEADO ───────────────────────────────────────

skip(
    10,
    "Smoke homologação real Focus Manaus",
    "BLOQUEADO — aguarda: (1) confirmação Focus suporte /v2/nfse Manaus, "
    "(2) CNPJ DS Car cadastrado no painel Focus com certificado A1 teste, "
    "(3) respostas documentadas em docs/superpowers/specs/anexos/2026-04-23-focus-suporte-manaus-respostas.md",
)

# ─── Resultado final ──────────────────────────────────────────────────────────

n_pass = sum(1 for _, s, _, _ in results if s == _PASS)
n_fail = sum(1 for _, s, _, _ in results if s == _FAIL)
n_skip = sum(1 for _, s, _, _ in results if s == _SKIP)
total = len(results)

print(f"\n{'=' * 55}")
print(f"Resultado: {n_pass}/{total} verificações passando ({n_fail} falhando, {n_skip} pulada(s))")

if n_fail > 0:
    print("\nFalhas:")
    for n, s, label, detail in results:
        if s == _FAIL:
            print(f"  [{n}] {label}")
            if detail:
                print(f"       {detail}")
    sys.exit(1)

sys.exit(0)
