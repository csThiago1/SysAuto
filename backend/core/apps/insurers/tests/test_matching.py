from django.test import TestCase

from apps.insurers.matching import match_insurer
from apps.insurers.models import Insurer
from apps.insurers.serializers import InsurerSerializer


class MatchInsurerTest(TestCase):
    """O seed 0009 + 0011 já roda nas migrations."""

    def test_cnpj_exato_do_cilia(self) -> None:
        assert match_insurer(cnpj="33055146000193").code == "bradesco"

    def test_cnpj_formatado(self) -> None:
        assert match_insurer(cnpj="33.164.021/0001-00").code == "tokio"

    def test_raiz_unica_cobre_filial(self) -> None:
        # DV inválido de propósito: o casamento nunca valida DV.
        assert match_insurer(cnpj="61550141000107").code == "yelum"

    def test_raiz_compartilhada_nao_casa(self) -> None:
        assert match_insurer(cnpj="61198164009999") is None

    def test_raiz_compartilhada_cai_no_nome(self) -> None:
        assert match_insurer(cnpj="61198164009999", name="AZUL SEGUROS").code == "azul"

    def test_nome_sem_acento_e_caixa(self) -> None:
        assert match_insurer(name="yelum seguradora").code == "yelum"

    def test_codigo(self) -> None:
        assert match_insurer(code="hdi").code == "hdi"

    def test_inativa_ignorada(self) -> None:
        Insurer.objects.filter(code="suhai").update(is_active=False)
        assert match_insurer(code="suhai") is None

    def test_sem_dados_nao_casa(self) -> None:
        assert match_insurer() is None


class InsurerCnpjsTest(TestCase):
    def test_seed_preenche_cnpjs(self) -> None:
        assert Insurer.objects.get(code="bradesco").cnpjs == ["92682038000100", "33055146000193"]
        assert Insurer.objects.get(code="porto").cnpjs == ["61198164000160"]

    def test_save_inclui_principal_so_digitos(self) -> None:
        insurer = Insurer.objects.create(name="Nova Seg", cnpj="11.222.333/0001-81")
        insurer.refresh_from_db()
        assert insurer.cnpjs == ["11222333000181"]

    def test_susep_vazio_vira_null(self) -> None:
        Insurer.objects.create(name="Seg A", cnpj="11222333000181", susep_code="")
        Insurer.objects.create(name="Seg B", cnpj="11444777000161", susep_code="")
        assert Insurer.objects.filter(name__in=["Seg A", "Seg B"], susep_code=None).count() == 2

    def test_save_com_update_fields_grava_cnpjs(self) -> None:
        insurer = Insurer.objects.get(code="mapfre")
        insurer.cnpj = "11.222.333/0001-81"
        insurer.save(update_fields=["cnpj"])
        insurer.refresh_from_db()
        assert insurer.cnpjs == ["11222333000181", "61074175000138"]

    def test_cnpj_alfanumerico(self) -> None:
        insurer = Insurer.objects.create(name="Seg Alfa", cnpj="12.ABC.345/01DE-35")
        assert insurer.cnpjs == ["12ABC34501DE35"]
        assert match_insurer(cnpj="12.ABC.345/01DE-35") == insurer
        mapfre = Insurer.objects.get(code="mapfre")
        s = InsurerSerializer(mapfre, data={"cnpjs": ["12ABC34501DE35"]}, partial=True)
        assert s.is_valid(), s.errors
        assert s.validated_data["cnpjs"] == ["12ABC34501DE35"]
