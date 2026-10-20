import pytest

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from apps.vehicle_catalog.models import VehicleFamilyRule, VehicleMake, VehicleYearVersion
from apps.vehicle_catalog.tests.factories import make_catalog


class CatalogModelsTest(TestCase):
    def test_mesmo_nome_em_tipos_diferentes(self) -> None:
        VehicleMake.objects.create(
            tipo="carro", nome="Honda", nome_normalizado="HONDA", display_name="Honda"
        )
        VehicleMake.objects.create(
            tipo="moto", nome="HONDA", nome_normalizado="HONDA", display_name="Honda"
        )
        assert VehicleMake.objects.filter(nome_normalizado="HONDA").count() == 2

    def test_versao_unica_por_modelo_ano_combustivel(self) -> None:
        v = make_catalog()
        with pytest.raises(IntegrityError):
            VehicleYearVersion.objects.create(
                modelo=v.modelo, ano=2025, combustivel="flex", descricao="dup"
            )

    def test_label_zero_km(self) -> None:
        v = make_catalog(
            codigo="004519-5",
            model="ONIX HATCH 1.0 12V Flex 5p Mec.",
            family="Onix",
            ano=32000,
            zero_km=True,
        )
        assert v.label == "Zero km Flex"

    def test_label_com_ano(self) -> None:
        assert make_catalog().label == "2025 Flex"

    def test_regra_com_regex_invalida_nao_valida(self) -> None:
        with pytest.raises(ValidationError):
            VehicleFamilyRule(
                marca_nome_normalizado="BMW", tipo="carro", padrao="^(", familia="x"
            ).full_clean()

    def test_seed_de_regras_existe(self) -> None:
        assert VehicleFamilyRule.objects.filter(
            marca_nome_normalizado="GM - CHEVROLET", padrao="^ONIX SED"
        ).exists()
