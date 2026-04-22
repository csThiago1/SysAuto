import pytest
from apps.items.models import ItemOperationType, LaborCategory


@pytest.mark.django_db
class TestOperationTypesSeed:
    def test_has_all_expected_codes(self):
        expected = {"TROCA", "RECUPERACAO", "OVERLAP", "R_I", "PINTURA",
                    "MONTAGEM_DESMONTAGEM", "DNC"}
        codes = set(ItemOperationType.objects.values_list("code", flat=True))
        assert expected.issubset(codes)

    def test_all_active(self):
        assert ItemOperationType.objects.filter(is_active=False).count() == 0

    def test_str(self):
        op = ItemOperationType.objects.get(code="TROCA")
        assert str(op) == "TROCA — Troca"


@pytest.mark.django_db
class TestLaborCategoriesSeed:
    def test_has_all_expected_codes(self):
        expected = {"FUNILARIA", "PINTURA", "MECANICA", "ELETRICA", "TAPECARIA",
                    "ACABAMENTO", "VIDRACARIA", "REPARACAO", "SERVICOS"}
        codes = set(LaborCategory.objects.values_list("code", flat=True))
        assert expected.issubset(codes)
