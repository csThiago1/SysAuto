from django.test import TestCase

from apps.insurers.models import Insurer
from apps.insurers.serializers import InsurerMinimalSerializer, InsurerSerializer


class InsurerSerializerTest(TestCase):
    def test_cnpj_novo_invalido_400(self) -> None:
        s = InsurerSerializer(data={"name": "Outra Azul", "cnpj": "61198164001142"})
        assert not s.is_valid()
        assert s.errors["cnpj"] == ["CNPJ inválido."]

    def test_seed_invalido_editado_em_outro_campo_ok(self) -> None:
        azul = Insurer.objects.get(code="azul")
        s = InsurerSerializer(azul, data={"brand_color": "#111111"}, partial=True)
        assert s.is_valid(), s.errors
        s.save()
        azul.refresh_from_db()
        assert azul.brand_color == "#111111"

    def test_seed_invalido_reenviado_sem_mudar_ok(self) -> None:
        azul = Insurer.objects.get(code="azul")
        s = InsurerSerializer(azul, data={"cnpj": "61198164001142"}, partial=True)
        assert s.is_valid(), s.errors

    def test_cnpj_alterado_invalido_400(self) -> None:
        azul = Insurer.objects.get(code="azul")
        s = InsurerSerializer(azul, data={"cnpj": "61198164001143"}, partial=True)
        assert not s.is_valid()
        assert s.errors["cnpj"] == ["CNPJ inválido."]

    def test_cnpjs_so_digitos_e_novo_validado(self) -> None:
        azul = Insurer.objects.get(code="azul")
        ok = InsurerSerializer(
            azul, data={"cnpjs": ["61198164001142", "11222333000181"]}, partial=True
        )
        assert ok.is_valid(), ok.errors
        assert ok.validated_data["cnpjs"] == ["61198164001142", "11222333000181"]
        bad = InsurerSerializer(azul, data={"cnpjs": ["11222333000182"]}, partial=True)
        assert not bad.is_valid()
        assert "cnpjs" in bad.errors

    def test_code_read_only_e_campos_expostos(self) -> None:
        azul = Insurer.objects.get(code="azul")
        s = InsurerSerializer(azul, data={"code": "outro"}, partial=True)
        assert s.is_valid(), s.errors
        assert "code" not in s.validated_data
        data = InsurerSerializer(azul).data
        assert data["code"] == "azul"
        assert data["trade_names"] == ["Azul Seguros"]
        assert data["cnpjs"] == ["61198164001142"]
        assert data["susep_code"] is None

    def test_minimal_expoe_code_e_cnpjs(self) -> None:
        data = InsurerMinimalSerializer(Insurer.objects.get(code="yelum")).data
        assert data["code"] == "yelum"
        assert data["cnpjs"] == ["61589370000186", "61550141009129"]
