import shutil
from pathlib import Path
from unittest.mock import patch

import pytest

from django.test import TestCase

from apps.vehicle_catalog.fipe_sync import derive_family, load_fipex
from apps.vehicle_catalog.models import (
    VehicleFamilyRule,
    VehicleMake,
    VehicleModel,
    VehicleYearVersion,
)
from apps.vehicle_catalog.tasks import task_sync_fipe_catalog
from apps.vehicle_catalog.tests.factories import SAMPLE, sample_without


def RULES() -> list[VehicleFamilyRule]:
    return list(VehicleFamilyRule.objects.filter(is_active=True))  # seed da 0008


@pytest.mark.parametrize(
    "make,model,fam,tipo",
    [
        ("GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.", "Onix", "carro"),
        ("GM - Chevrolet", "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut", "Onix Plus", "carro"),
        ("GM - Chevrolet", "ONIX SEDAN Plus LT 1.0 12V Flex 4p Mec.", "Onix Plus", "carro"),
        ("GM - Chevrolet", "ONIX SD. P. PR. MIDNIGHT 1.0 TB Flex Aut", "Onix Plus", "carro"),
        ("Mercedes-Benz", "C 180 Avantgarde 1.6 TB 16V Aut.", "Classe C", "carro"),
        ("Mercedes-Benz", "GLA-200 Advance 1.6 TB 16V Aut.", "Classe GLA", "carro"),
        ("GM - Chevrolet", "MONTANA RS 1.2 Turbo Flex 12V Aut.", "Montana", "carro"),
        ("Mercedes-Benz", "Sprinter 517 VAN E.L.T.A. 18L Die (E6)", "Sprinter", "carro"),
        ("Fiat", "Grand Siena 1.0 EVO Flex 8V 4p", "Grand Siena", "carro"),
        ("Honda", "HR-V Advance 1.5  Flex TB 16V 5p Aut.", "HR-V", "carro"),
        ("VW - VolksWagen", "T-Cross 1.0 TSI Flex 12V 5p Mec.", "T-Cross", "carro"),
        ("VW - VolksWagen", "Gol (novo) 1.0 Mi Total Flex 8V 4p", "Gol", "carro"),
        ("VW - VolksWagen", "New Beetle 2.0 Mi Mec./Aut.", "Beetle", "carro"),
        ("Hyundai", "HB20X Premium 1.6 Flex 16V Aut.", "HB20X", "carro"),
        ("Land Rover", "Range Rover EVOQUE HSE 2.0 Diesel Aut.", "Range Rover Evoque", "carro"),
        ("BMW", "320iA", "Série 3", "carro"),
        ("HONDA", "POP 110i", "Pop", "moto"),
    ],
)
@pytest.mark.django_db
def test_derive_family(make: str, model: str, fam: str, tipo: str) -> None:
    assert derive_family(make, model, RULES(), tipo) == fam


def test_derive_family_sem_regra_pega_primeiro_termo() -> None:
    assert derive_family("Fiat", "Grand Siena 1.0 EVO Flex 8V 4p", []) == "Grand"


class LoadFipexTest(TestCase):
    def test_carga_cria_tudo(self) -> None:
        rep = load_fipex(SAMPLE, ref="2026-10")
        v = VehicleYearVersion.objects.get(modelo__codigo_fipe="004504-7", ano=2025)
        assert v.combustivel == "flex" and v.modelo.familia.nome == "Onix Plus"
        assert v.modelo.marca.display_name == "Chevrolet" and v.valor_referencia > 0
        assert (
            VehicleYearVersion.objects.get(modelo__codigo_fipe="004519-5", zero_km=True).ano
            == 32000
        )
        assert VehicleModel.objects.get(codigo_fipe="811132-4").tipo == "moto"
        with open(SAMPLE, encoding="utf-8") as f:
            assert rep.versions["upserted"] == sum(1 for _ in f) - 1

    def test_recarga_nao_duplica(self) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        n = VehicleYearVersion.objects.count()
        load_fipex(SAMPLE, ref="2026-11")
        assert VehicleYearVersion.objects.count() == n

    def test_item_removido_vira_inativo_e_continua_legivel(self) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        load_fipex(sample_without("005275-2"), ref="2026-11")
        m = VehicleModel.objects.get(codigo_fipe="005275-2")
        assert m.is_active is False and not m.versoes.filter(is_active=True).exists()
        assert m.familia.is_active is True  # Gol segue ativo pelas outras versões

    def test_make_desativada_pelo_admin_continua_desativada(self) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        VehicleMake.objects.filter(nome="Nissan").update(is_active=False)
        load_fipex(SAMPLE, ref="2026-11")
        assert not VehicleMake.objects.get(nome="Nissan").is_active

    def test_marca_que_some_num_mes_volta_ativa(self) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        load_fipex(sample_without(marca="Hyundai"), ref="2026-11")  # 20 de 607 linhas
        hyundai = VehicleMake.objects.get(nome="Hyundai")
        assert hyundai.is_active  # sem família ativa, o Modelo já sai vazio
        assert not hyundai.familias.filter(is_active=True).exists()
        load_fipex(SAMPLE, ref="2026-12")
        hyundai.refresh_from_db()
        assert hyundai.is_active and hyundai.familias.filter(is_active=True).exists()

    def test_dump_curto_nao_desativa_o_catalogo(self) -> None:
        load_fipex(SAMPLE, ref="2026-10")
        antes = (
            list(VehicleYearVersion.objects.order_by("pk").values_list("pk", "is_active")),
            list(VehicleMake.objects.order_by("pk").values_list("pk", "is_active")),
        )
        with pytest.raises(ValueError, match="dump curto"):
            load_fipex(sample_without(marca="Mercedes-Benz"), ref="2026-11")  # 190 linhas
        depois = (
            list(VehicleYearVersion.objects.order_by("pk").values_list("pk", "is_active")),
            list(VehicleMake.objects.order_by("pk").values_list("pk", "is_active")),
        )
        assert depois == antes

    def test_task_cai_para_o_mes_anterior_em_404(self) -> None:
        pedidos: list[tuple[int, int]] = []

        def fake_download(ano: int, mes: int, dest: Path) -> bool:
            pedidos.append((ano, mes))
            if len(pedidos) == 1:
                return False  # mês corrente ainda não publicado
            shutil.copyfile(SAMPLE, dest)
            return True

        with patch("apps.vehicle_catalog.fipe_sync.download_fipex", side_effect=fake_download):
            with patch("apps.vehicle_catalog.fipe_sync.timezone.localdate") as today:
                today.return_value.year, today.return_value.month = 2026, 1
                out = task_sync_fipe_catalog.run(tenant_schema="public")
        assert pedidos == [(2026, 1), (2025, 12)]
        assert VehicleModel.objects.get(codigo_fipe="004504-7").fonte_ref == "2025-12"
        assert out["versions_upserted"] == VehicleYearVersion.objects.count()
