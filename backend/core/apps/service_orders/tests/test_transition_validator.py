"""
Unit tests for TransitionValidator, ValidationResult and ValidationBlock.

These tests are pure unit tests — no database access required.
ServiceOrder instances are replaced with MagicMock objects to isolate
the validator logic from ORM dependencies.
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from apps.service_orders.transition_validator import (
    TransitionValidator,
    ValidationBlock,
    ValidationResult,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_order(**kwargs) -> MagicMock:
    """Cria mock de ServiceOrder com defaults razoáveis para testes.

    Todos os campos que o TransitionValidator lê diretamente são configurados
    para valores que passam nas validações por padrão, salvo override via kwargs.
    """
    order = MagicMock()
    order.status = kwargs.get("status", "reception")
    order.plate = kwargs.get("plate", "ABC1D23")
    order.make = kwargs.get("make", "Toyota")
    order.model = kwargs.get("model", "Corolla")
    order.customer_type = kwargs.get("customer_type", "private")
    order.customer_id = kwargs.get("customer_id", 1)
    order.customer_uuid = kwargs.get("customer_uuid", None)
    order.insurer_id = kwargs.get("insurer_id", None)
    order.insured_type = kwargs.get("insured_type", None)
    order.year = kwargs.get("year", 2024)
    order.color = kwargs.get("color", "Branco")
    order.fuel_type = kwargs.get("fuel_type", "Flex")
    order.mileage_in = kwargs.get("mileage_in", 50000)
    order.mileage_out = kwargs.get("mileage_out", None)
    order.entry_date = kwargs.get("entry_date", None)
    order.authorization_date = kwargs.get("authorization_date", None)
    order.casualty_number = kwargs.get("casualty_number", "")
    order.deductible_amount = kwargs.get("deductible_amount", None)
    order.number = kwargs.get("number", 1234)

    # Related managers — configurados para retornar defaults seguros
    _photos = MagicMock()
    _photos.filter.return_value.count.return_value = kwargs.get("photo_count", 0)
    order.photos = _photos

    _parts = MagicMock()
    _parts.filter.return_value.exists.return_value = kwargs.get("has_parts", False)
    _parts.filter.return_value.count.return_value = 0
    order.parts = _parts

    _labor = MagicMock()
    _labor.filter.return_value.exists.return_value = kwargs.get("has_labor", False)
    order.labor_items = _labor

    _checklist = MagicMock()
    _checklist.filter.return_value.exists.return_value = kwargs.get("has_checklist", False)
    order.checklist_items = _checklist

    _apontamentos = MagicMock()
    _apontamentos.filter.return_value.exists.return_value = False
    _apontamentos.count.return_value = 0
    _apontamentos.filter.return_value.count.return_value = 0
    order.apontamentos = _apontamentos

    _overrides = MagicMock()
    _overrides.filter.return_value.exists.return_value = False
    order.override_requests = _overrides

    _versions = MagicMock()
    _versions.filter.return_value.exists.return_value = False
    order.versions = _versions

    _fiscal_docs = MagicMock()
    _fiscal_docs.filter.return_value.exists.return_value = False
    order.fiscal_documents = _fiscal_docs

    return order


# ── TestValidationBlock ───────────────────────────────────────────────────────


class TestValidationBlock:
    def test_to_dict_returns_code_and_message(self) -> None:
        block = ValidationBlock(code="PHOTOS_MIN_12", message="Fotos insuficientes")
        result = block.to_dict()
        assert result == {"code": "PHOTOS_MIN_12", "message": "Fotos insuficientes"}

    def test_fields_accessible_as_attributes(self) -> None:
        block = ValidationBlock(code="TEST_CODE", message="Mensagem de teste")
        assert block.code == "TEST_CODE"
        assert block.message == "Mensagem de teste"


# ── TestValidationResult ──────────────────────────────────────────────────────


class TestValidationResult:
    def test_can_proceed_when_no_blocks(self) -> None:
        """Sem hard blocks e sem soft blocks — can_proceed é True."""
        result = ValidationResult(
            hard_blocks=[],
            soft_blocks=[],
            warnings=[ValidationBlock(code="WARN", message="apenas aviso")],
        )
        assert result.can_proceed is True

    def test_cannot_proceed_with_hard_blocks(self) -> None:
        """Com hard block — can_proceed é False."""
        result = ValidationResult(
            hard_blocks=[ValidationBlock(code="HARD", message="bloqueio duro")],
        )
        assert result.can_proceed is False

    def test_cannot_proceed_with_soft_blocks(self) -> None:
        """Com soft block — can_proceed é False (requer override)."""
        result = ValidationResult(
            soft_blocks=[ValidationBlock(code="SOFT", message="bloqueio suave")],
        )
        assert result.can_proceed is False

    def test_cannot_proceed_with_both_blocks(self) -> None:
        """Com hard e soft blocks simultâneos — can_proceed é False."""
        result = ValidationResult(
            hard_blocks=[ValidationBlock(code="H", message="hard")],
            soft_blocks=[ValidationBlock(code="S", message="soft")],
        )
        assert result.can_proceed is False

    def test_empty_result_can_proceed(self) -> None:
        """ValidationResult vazio — can_proceed é True."""
        result = ValidationResult()
        assert result.can_proceed is True

    def test_to_dict_structure(self) -> None:
        """to_dict() serializa todos os campos corretamente."""
        result = ValidationResult(
            hard_blocks=[ValidationBlock(code="H", message="hard block")],
            soft_blocks=[ValidationBlock(code="S", message="soft block")],
            warnings=[ValidationBlock(code="W", message="aviso")],
            has_pending_override=True,
        )
        d = result.to_dict()

        assert d["can_proceed"] is False
        assert len(d["hard_blocks"]) == 1
        assert d["hard_blocks"][0] == {"code": "H", "message": "hard block"}
        assert len(d["soft_blocks"]) == 1
        assert d["soft_blocks"][0] == {"code": "S", "message": "soft block"}
        assert len(d["warnings"]) == 1
        assert d["warnings"][0] == {"code": "W", "message": "aviso"}
        assert d["has_pending_override"] is True

    def test_to_dict_can_proceed_true(self) -> None:
        """to_dict() com can_proceed=True quando sem blocks."""
        result = ValidationResult(warnings=[ValidationBlock(code="W", message="aviso")])
        d = result.to_dict()
        assert d["can_proceed"] is True
        assert d["hard_blocks"] == []
        assert d["soft_blocks"] == []
        assert len(d["warnings"]) == 1

    def test_has_pending_override_default_false(self) -> None:
        """has_pending_override começa como False por padrão."""
        result = ValidationResult()
        assert result.has_pending_override is False


# ── TestValidateNoRulesForTarget ──────────────────────────────────────────────


class TestValidateNoRulesForTarget:
    def test_unknown_target_status_returns_empty_result(self) -> None:
        """Status sem validador específico retorna ValidationResult vazio (permissivo)."""
        order = _make_order()
        result = TransitionValidator.validate(order, "some_unknown_status")
        assert result.can_proceed is True
        assert result.hard_blocks == []
        assert result.soft_blocks == []


# ── TestValidateToInitialSurvey ───────────────────────────────────────────────


class TestValidateToInitialSurvey:
    def test_passes_with_complete_private_data(self) -> None:
        """OS particular completa não gera bloqueios."""
        order = _make_order(customer_type="private", customer_id=1)
        result = TransitionValidator.validate(order, "initial_survey")
        assert result.hard_blocks == []

    def test_hard_block_missing_plate(self) -> None:
        """Placa ausente gera VEHICLE_BASIC_DATA."""
        order = _make_order(plate="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "VEHICLE_BASIC_DATA" in codes

    def test_hard_block_missing_make(self) -> None:
        """Marca ausente gera VEHICLE_BASIC_DATA."""
        order = _make_order(make="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "VEHICLE_BASIC_DATA" in codes

    def test_hard_block_missing_model(self) -> None:
        """Modelo ausente gera VEHICLE_BASIC_DATA."""
        order = _make_order(model="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "VEHICLE_BASIC_DATA" in codes

    def test_hard_block_message_lists_missing_fields(self) -> None:
        """Mensagem de VEHICLE_BASIC_DATA lista os campos faltantes."""
        order = _make_order(plate="", make="")
        result = TransitionValidator.validate(order, "initial_survey")
        block = next(b for b in result.hard_blocks if b.code == "VEHICLE_BASIC_DATA")
        assert "placa" in block.message
        assert "marca" in block.message

    def test_hard_block_missing_customer_type(self) -> None:
        """customer_type ausente gera CUSTOMER_TYPE_SET."""
        order = _make_order(customer_type=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "CUSTOMER_TYPE_SET" in codes

    def test_hard_block_missing_customer_no_id_no_uuid(self) -> None:
        """Sem customer_id nem customer_uuid gera CUSTOMER_LINKED."""
        order = _make_order(customer_id=None, customer_uuid=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "CUSTOMER_LINKED" in codes

    def test_no_customer_block_when_uuid_present(self) -> None:
        """customer_uuid sem customer_id não gera CUSTOMER_LINKED."""
        import uuid

        order = _make_order(customer_id=None, customer_uuid=uuid.uuid4())
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "CUSTOMER_LINKED" not in codes

    def test_hard_block_insurer_missing_insurer_and_type(self) -> None:
        """Tipo 'insurer' sem seguradora nem insured_type gera INSURER_DATA."""
        order = _make_order(customer_type="insurer", insurer_id=None, insured_type=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "INSURER_DATA" in codes

    def test_hard_block_insurer_missing_only_insurer(self) -> None:
        """Tipo 'insurer' sem insurer_id mas com insured_type ainda gera INSURER_DATA."""
        order = _make_order(
            customer_type="insurer",
            insurer_id=None,
            insured_type="insured",
        )
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "INSURER_DATA" in codes

    def test_no_insurer_block_for_private_type(self) -> None:
        """Tipo 'private' nunca gera INSURER_DATA."""
        order = _make_order(customer_type="private", insurer_id=None, insured_type=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [b.code for b in result.hard_blocks]
        assert "INSURER_DATA" not in codes

    def test_warning_missing_year(self) -> None:
        """Ano ausente gera aviso VEHICLE_YEAR."""
        order = _make_order(year=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [w.code for w in result.warnings]
        assert "VEHICLE_YEAR" in codes

    def test_warning_missing_color(self) -> None:
        """Cor ausente gera aviso VEHICLE_COLOR."""
        order = _make_order(color="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [w.code for w in result.warnings]
        assert "VEHICLE_COLOR" in codes

    def test_warning_missing_fuel_type(self) -> None:
        """Combustível ausente gera aviso FUEL_TYPE."""
        order = _make_order(fuel_type="")
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [w.code for w in result.warnings]
        assert "FUEL_TYPE" in codes

    def test_warning_missing_mileage_in(self) -> None:
        """KM de entrada ausente gera aviso MILEAGE_IN."""
        order = _make_order(mileage_in=None)
        result = TransitionValidator.validate(order, "initial_survey")
        codes = [w.code for w in result.warnings]
        assert "MILEAGE_IN" in codes

    def test_all_optional_fields_present_no_warnings(self) -> None:
        """OS com todos os campos opcionais preenchidos não gera warnings."""
        order = _make_order(
            year=2022, color="Prata", fuel_type="Gasolina", mileage_in=30000
        )
        result = TransitionValidator.validate(order, "initial_survey")
        assert result.warnings == []

    def test_warnings_do_not_block_transition(self) -> None:
        """Warnings não impedem a transição — can_proceed permanece True."""
        order = _make_order(year=None, color="", fuel_type="", mileage_in=None)
        result = TransitionValidator.validate(order, "initial_survey")
        # Deve ter warnings mas nenhum hard ou soft block
        assert len(result.warnings) > 0
        assert result.can_proceed is True


# ── TestValidateToBudget ──────────────────────────────────────────────────────


class TestValidateToBudget:
    def test_soft_block_insufficient_photos(self) -> None:
        """Menos de 12 fotos gera soft block PHOTOS_MIN_12."""
        order = _make_order()
        order.photos.filter.return_value.count.return_value = 5
        result = TransitionValidator.validate(order, "budget")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" in codes

    def test_soft_block_zero_photos(self) -> None:
        """Sem nenhuma foto gera soft block PHOTOS_MIN_12."""
        order = _make_order()
        order.photos.filter.return_value.count.return_value = 0
        result = TransitionValidator.validate(order, "budget")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" in codes

    def test_no_soft_block_with_exactly_12_photos(self) -> None:
        """Exatamente 12 fotos não gera PHOTOS_MIN_12."""
        order = _make_order()
        order.photos.filter.return_value.count.return_value = 12
        result = TransitionValidator.validate(order, "budget")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" not in codes

    def test_no_soft_block_with_more_than_12_photos(self) -> None:
        """Mais de 12 fotos não gera PHOTOS_MIN_12."""
        order = _make_order()
        order.photos.filter.return_value.count.return_value = 20
        result = TransitionValidator.validate(order, "budget")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" not in codes

    def test_photos_block_message_shows_count(self) -> None:
        """Mensagem de PHOTOS_MIN_12 informa quantas fotos existem e faltam."""
        order = _make_order()
        order.photos.filter.return_value.count.return_value = 7
        result = TransitionValidator.validate(order, "budget")
        block = next(b for b in result.soft_blocks if b.code == "PHOTOS_MIN_12")
        assert "7" in block.message
        assert "5" in block.message  # faltam 5

    def test_warning_entry_date_not_set(self) -> None:
        """Data de entrada ausente gera aviso ENTRY_DATE_SET."""
        order = _make_order(entry_date=None)
        order.photos.filter.return_value.count.return_value = 12
        result = TransitionValidator.validate(order, "budget")
        codes = [w.code for w in result.warnings]
        assert "ENTRY_DATE_SET" in codes

    def test_no_warning_when_entry_date_set(self) -> None:
        """Data de entrada preenchida não gera ENTRY_DATE_SET."""
        from django.utils import timezone

        order = _make_order(entry_date=timezone.now())
        order.photos.filter.return_value.count.return_value = 12
        result = TransitionValidator.validate(order, "budget")
        codes = [w.code for w in result.warnings]
        assert "ENTRY_DATE_SET" not in codes


# ── TestValidateToWaitingAuth ─────────────────────────────────────────────────


class TestValidateToWaitingAuth:
    def test_insurer_hard_block_no_budget_pdf(self) -> None:
        """OS de seguradora sem PDF de orçamento gera BUDGET_PDF_INSURER."""
        order = _make_order(
            customer_type="insurer",
            status="budget",
        )
        # Sem fotos na pasta 'orcamentos'
        order.photos.filter.return_value.count.return_value = 0
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.hard_blocks]
        assert "BUDGET_PDF_INSURER" in codes

    def test_private_hard_block_empty_budget(self) -> None:
        """OS particular sem peças nem serviços gera BUDGET_ITEMS_PRIVATE."""
        order = _make_order(customer_type="private", status="initial_survey")
        order.photos.filter.return_value.count.return_value = 12
        order.parts.filter.return_value.exists.return_value = False
        order.labor_items.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.hard_blocks]
        assert "BUDGET_ITEMS_PRIVATE" in codes

    def test_private_no_block_when_has_parts(self) -> None:
        """OS particular com peças não gera BUDGET_ITEMS_PRIVATE."""
        order = _make_order(customer_type="private", status="budget")
        order.photos.filter.return_value.count.return_value = 12
        order.parts.filter.return_value.exists.return_value = True
        order.labor_items.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.hard_blocks]
        assert "BUDGET_ITEMS_PRIVATE" not in codes

    def test_inherits_photo_soft_block_from_initial_survey(self) -> None:
        """Vindo de initial_survey herda soft block PHOTOS_MIN_12."""
        order = _make_order(
            customer_type="insurer",
            status="initial_survey",
            casualty_number="SIN-001",
        )
        order.photos.filter.return_value.count.return_value = 5
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [b.code for b in result.soft_blocks]
        assert "PHOTOS_MIN_12" in codes

    def test_insurer_warning_missing_casualty_number(self) -> None:
        """OS de seguradora sem número de sinistro gera aviso CASUALTY_NUMBER."""
        order = _make_order(
            customer_type="insurer",
            status="budget",
            casualty_number="",
        )
        order.photos.filter.return_value.count.return_value = 1  # PDF presente
        result = TransitionValidator.validate(order, "waiting_auth")
        codes = [w.code for w in result.warnings]
        assert "CASUALTY_NUMBER" in codes


# ── TestValidateToAuthorized ──────────────────────────────────────────────────


class TestValidateToAuthorized:
    def test_hard_block_missing_authorization_date(self) -> None:
        """Sem data de autorização gera AUTH_DATE_SET."""
        order = _make_order(customer_type="private", authorization_date=None)
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "AUTH_DATE_SET" in codes

    def test_insurer_hard_block_no_authorized_version(self) -> None:
        """OS de seguradora sem versão autorizada gera VERSION_AUTHORIZED."""
        from django.utils import timezone

        order = _make_order(
            customer_type="insurer",
            authorization_date=timezone.now(),
            casualty_number="SIN-001",
        )
        order.versions.filter.return_value.exists.return_value = False
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "VERSION_AUTHORIZED" in codes

    def test_insurer_hard_block_missing_casualty_number(self) -> None:
        """OS de seguradora sem sinistro gera CASUALTY_NUMBER_REQUIRED."""
        from django.utils import timezone

        order = _make_order(
            customer_type="insurer",
            authorization_date=timezone.now(),
            casualty_number="",
        )
        order.versions.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "CASUALTY_NUMBER_REQUIRED" in codes

    def test_insurer_hard_block_deductible_missing_for_insured(self) -> None:
        """Segurado sem franquia cadastrada gera DEDUCTIBLE_SET."""
        from django.utils import timezone

        order = _make_order(
            customer_type="insurer",
            authorization_date=timezone.now(),
            casualty_number="SIN-001",
            insured_type="insured",
            deductible_amount=None,
        )
        order.versions.filter.return_value.exists.return_value = True
        result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "DEDUCTIBLE_SET" in codes

    def test_private_hard_block_missing_signature(self) -> None:
        """OS particular sem assinatura de aprovação gera SIGNATURE_APPROVAL."""
        from django.utils import timezone

        order = _make_order(
            customer_type="private",
            authorization_date=timezone.now(),
        )
        with patch.object(TransitionValidator, "_has_signature", return_value=False):
            result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "SIGNATURE_APPROVAL" in codes

    def test_private_no_block_when_signature_present(self) -> None:
        """OS particular com assinatura de aprovação não gera SIGNATURE_APPROVAL."""
        from django.utils import timezone

        order = _make_order(
            customer_type="private",
            authorization_date=timezone.now(),
        )
        with patch.object(TransitionValidator, "_has_signature", return_value=True):
            result = TransitionValidator.validate(order, "authorized")
        codes = [b.code for b in result.hard_blocks]
        assert "SIGNATURE_APPROVAL" not in codes


# ── TestValidateToDelivered ───────────────────────────────────────────────────


class TestValidateToDelivered:
    @patch.object(TransitionValidator, "_has_nfce", return_value=False)
    @patch.object(TransitionValidator, "_has_signature", return_value=False)
    @patch.object(TransitionValidator, "_has_receivables", return_value=False)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_private_all_hard_blocks_missing(
        self, mock_comp, mock_recv, mock_sig, mock_nfce
    ) -> None:
        """OS particular com todos os requisitos faltando gera todos os hard blocks."""
        order = _make_order(
            status="ready",
            customer_type="private",
            mileage_out=None,
        )
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "NFCE_ISSUED" in codes
        assert "CLIENT_SIGNATURE" in codes
        assert "MILEAGE_OUT" in codes
        assert "RECEIVABLE_CREATED" in codes

    @patch.object(TransitionValidator, "_has_nfce", return_value=True)
    @patch.object(TransitionValidator, "_has_signature", return_value=True)
    @patch.object(TransitionValidator, "_has_receivables", return_value=True)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_private_no_blocks_when_all_requirements_met(
        self, mock_comp, mock_recv, mock_sig, mock_nfce
    ) -> None:
        """OS particular com todos os requisitos atendidos não gera hard blocks."""
        order = _make_order(
            status="ready",
            customer_type="private",
            mileage_out=55000,
        )
        result = TransitionValidator.validate(order, "delivered")
        assert result.hard_blocks == []
        assert result.can_proceed is True

    @patch.object(TransitionValidator, "_has_signature", return_value=False)
    @patch.object(TransitionValidator, "_has_receivables", return_value=True)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_insurer_no_nfce_block(
        self, mock_comp, mock_recv, mock_sig
    ) -> None:
        """OS de seguradora não exige NFC-e (sem NFCE_ISSUED)."""
        order = _make_order(
            status="ready",
            customer_type="insurer",
            mileage_out=55000,
        )
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "NFCE_ISSUED" not in codes

    @patch.object(TransitionValidator, "_has_nfce", return_value=True)
    @patch.object(TransitionValidator, "_has_signature", return_value=True)
    @patch.object(TransitionValidator, "_has_receivables", return_value=True)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=False)
    def test_hard_block_complement_not_billed(
        self, mock_comp, mock_recv, mock_sig, mock_nfce
    ) -> None:
        """Itens de complemento não faturados geram COMPLEMENT_BILLED."""
        order = _make_order(
            status="ready",
            customer_type="private",
            mileage_out=55000,
        )
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "COMPLEMENT_BILLED" in codes

    @patch.object(TransitionValidator, "_has_nfce", return_value=True)
    @patch.object(TransitionValidator, "_has_signature", return_value=True)
    @patch.object(TransitionValidator, "_has_receivables", return_value=False)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_hard_block_no_receivable(
        self, mock_comp, mock_recv, mock_sig, mock_nfce
    ) -> None:
        """Sem contas a receber gera RECEIVABLE_CREATED."""
        order = _make_order(
            status="ready",
            customer_type="private",
            mileage_out=55000,
        )
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "RECEIVABLE_CREATED" in codes

    @patch.object(TransitionValidator, "_has_nfce", return_value=True)
    @patch.object(TransitionValidator, "_has_signature", return_value=True)
    @patch.object(TransitionValidator, "_has_receivables", return_value=True)
    @patch.object(TransitionValidator, "_complement_all_billed", return_value=True)
    def test_hard_block_mileage_out_zero(
        self, mock_comp, mock_recv, mock_sig, mock_nfce
    ) -> None:
        """KM de saída 0 (falsy) também gera MILEAGE_OUT."""
        order = _make_order(
            status="ready",
            customer_type="private",
            mileage_out=0,
        )
        result = TransitionValidator.validate(order, "delivered")
        codes = [b.code for b in result.hard_blocks]
        assert "MILEAGE_OUT" in codes


# ── TestValidateToCancelled ───────────────────────────────────────────────────


class TestValidateToCancelled:
    def test_hard_block_no_justification(self) -> None:
        """Sem justificativa gera CANCEL_JUSTIFICATION."""
        order = _make_order(status="reception")
        result = TransitionValidator.validate(order, "cancelled")
        codes = [b.code for b in result.hard_blocks]
        assert "CANCEL_JUSTIFICATION" in codes

    def test_hard_block_empty_string_justification(self) -> None:
        """Justificativa vazia gera CANCEL_JUSTIFICATION."""
        order = _make_order(status="reception")
        result = TransitionValidator.validate(order, "cancelled", justification="")
        codes = [b.code for b in result.hard_blocks]
        assert "CANCEL_JUSTIFICATION" in codes

    def test_hard_block_whitespace_only_justification(self) -> None:
        """Justificativa apenas com espaços gera CANCEL_JUSTIFICATION."""
        order = _make_order(status="reception")
        result = TransitionValidator.validate(order, "cancelled", justification="   ")
        codes = [b.code for b in result.hard_blocks]
        assert "CANCEL_JUSTIFICATION" in codes

    def test_passes_with_valid_justification(self) -> None:
        """Justificativa válida não gera hard blocks."""
        order = _make_order(status="reception")
        result = TransitionValidator.validate(order, "cancelled", justification="Cliente desistiu")
        assert result.hard_blocks == []
        assert result.can_proceed is True

    def test_cancelled_allowed_from_any_non_terminal_status(self) -> None:
        """Cancelamento com justificativa é permitido em qualquer status ativo."""
        for status in ["reception", "initial_survey", "budget", "waiting_auth", "authorized"]:
            order = _make_order(status=status)
            result = TransitionValidator.validate(
                order, "cancelled", justification="Motivo válido"
            )
            assert result.can_proceed is True, f"Deveria permitir cancelamento de status '{status}'"


# ── TestValidateWorkshopTransition ────────────────────────────────────────────


class TestValidateWorkshopTransition:
    @pytest.mark.parametrize(
        "target",
        ["mechanic", "bodywork", "painting", "assembly", "polishing", "washing"],
    )
    def test_soft_block_no_timesheet(self, target: str) -> None:
        """Sem apontamento encerrado gera TIMESHEET_CLOSED em transições de oficina."""
        order = _make_order(status="repair")
        order.apontamentos.filter.return_value.exists.return_value = False
        order.photos.filter.return_value.count.return_value = 1  # tem foto de acompanhamento
        result = TransitionValidator.validate(order, target)
        codes = [b.code for b in result.soft_blocks]
        assert "TIMESHEET_CLOSED" in codes

    @pytest.mark.parametrize(
        "target",
        ["mechanic", "bodywork", "painting", "assembly", "polishing", "washing"],
    )
    def test_soft_block_no_progress_photo(self, target: str) -> None:
        """Sem foto de acompanhamento gera PROGRESS_PHOTO em transições de oficina."""
        order = _make_order(status="repair")
        order.apontamentos.filter.return_value.exists.return_value = True
        order.photos.filter.return_value.count.return_value = 0  # sem foto
        result = TransitionValidator.validate(order, target)
        codes = [b.code for b in result.soft_blocks]
        assert "PROGRESS_PHOTO" in codes

    def test_no_soft_blocks_when_all_workshop_requirements_met(self) -> None:
        """Com apontamento encerrado e foto de acompanhamento — sem soft blocks."""
        order = _make_order(status="repair")
        order.apontamentos.filter.return_value.exists.return_value = True
        order.photos.filter.return_value.count.return_value = 3
        result = TransitionValidator.validate(order, "bodywork")
        assert result.soft_blocks == []


# ── TestValidateAllTargets ────────────────────────────────────────────────────


class TestValidateAllTargets:
    def test_returns_dict_with_allowed_transitions(self) -> None:
        """validate_all_targets retorna dict com todas as transições permitidas."""
        order = _make_order(status="reception")
        order.photos.filter.return_value.count.return_value = 0
        results = TransitionValidator.validate_all_targets(order)
        # reception permite initial_survey e cancelled
        assert "initial_survey" in results
        assert "cancelled" in results

    def test_each_result_has_required_keys(self) -> None:
        """Cada entry no resultado tem as chaves padrão de ValidationResult.to_dict()."""
        order = _make_order(status="reception")
        order.photos.filter.return_value.count.return_value = 0
        results = TransitionValidator.validate_all_targets(order)
        for target, result_dict in results.items():
            assert "can_proceed" in result_dict, f"Falta 'can_proceed' para target '{target}'"
            assert "hard_blocks" in result_dict, f"Falta 'hard_blocks' para target '{target}'"
            assert "soft_blocks" in result_dict, f"Falta 'soft_blocks' para target '{target}'"
            assert "warnings" in result_dict, f"Falta 'warnings' para target '{target}'"
            assert "has_pending_override" in result_dict, (
                f"Falta 'has_pending_override' para target '{target}'"
            )

    def test_terminal_statuses_return_empty_dict(self) -> None:
        """OS em status terminal (delivered/cancelled) retorna dict vazio."""
        for terminal in ["delivered", "cancelled"]:
            order = _make_order(status=terminal)
            results = TransitionValidator.validate_all_targets(order)
            assert results == {}, f"Esperava dict vazio para status '{terminal}'"

    def test_errors_in_individual_validators_dont_crash(self) -> None:
        """Erro em um validador individual retorna resultado neutro sem estourar."""
        order = _make_order(status="reception")
        # Simula erro no validador de initial_survey
        with patch.object(
            TransitionValidator,
            "_validate_to_initial_survey",
            side_effect=RuntimeError("erro simulado"),
        ):
            results = TransitionValidator.validate_all_targets(order)
        # Deve retornar resultado neutro para initial_survey
        assert "initial_survey" in results
        assert results["initial_survey"]["can_proceed"] is True
