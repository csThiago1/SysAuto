"""Testes unitários para MovimentacaoEstoque — imutabilidade (WMS-1)."""
import datetime
import uuid

import pytest
from django.db.models.base import ModelState

from apps.inventory.models_movement import MovimentacaoEstoque


class TestMovimentacaoEstoqueStr:
    def test_str_format(self) -> None:
        mov = MovimentacaoEstoque.__new__(MovimentacaoEstoque)
        from django.db.models.base import ModelState

        mov._state = ModelState()
        mov.tipo = "entrada_nf"
        mov.realizado_por_id = uuid.uuid4()
        mov.created_at = datetime.datetime(2026, 5, 2, 14, 30)
        result = str(mov)
        assert "entrada_nf" in result
        assert "2026-05-02 14:30" in result


class TestMovimentacaoImutabilidade:
    """WMS-1: save() bloqueia update após criação."""

    def test_save_blocks_general_update(self) -> None:
        """Após persistência, save() sem update_fields deve levantar ValueError."""
        mov = MovimentacaoEstoque.__new__(MovimentacaoEstoque)
        mov.tipo = "entrada_nf"
        mov._state = ModelState()
        mov._state.adding = False
        mov._state.db = "default"

        with pytest.raises(ValueError, match="imutável"):
            mov.save()

    def test_save_blocks_update_with_wrong_fields(self) -> None:
        """update_fields com campos não-aprovação deve levantar ValueError."""
        mov = MovimentacaoEstoque.__new__(MovimentacaoEstoque)
        mov._state = ModelState()
        mov._state.adding = False
        mov._state.db = "default"

        with pytest.raises(ValueError, match="imutável"):
            mov.save(update_fields=["motivo"])

    def test_save_allows_approval_update(self) -> None:
        """Approval fields can be updated via update_fields."""
        mov = MovimentacaoEstoque.__new__(MovimentacaoEstoque)
        mov._state = ModelState()
        mov._state.adding = False
        mov._state.db = "default"

        # This should NOT raise ValueError — but will fail at DB level (no actual DB).
        # We just verify the immutability guard does not trigger.
        try:
            mov.save(update_fields=["aprovado_por_id", "aprovado_em"])
        except ValueError:
            pytest.fail("Should allow approval field updates")
        except Exception:
            # Any other exception (DB, etc.) is fine — we only test the ValueError guard
            pass


class TestMovimentacaoTipoChoices:
    def test_all_tipos_defined(self) -> None:
        tipos = {c.value for c in MovimentacaoEstoque.Tipo}
        expected = {
            "entrada_nf",
            "entrada_manual",
            "entrada_devolucao",
            "saida_os",
            "saida_perda",
            "transferencia",
            "ajuste_inventario",
        }
        assert tipos == expected
