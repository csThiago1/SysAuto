import pytest

from apps.service_orders.models import Insurer


@pytest.mark.django_db
class TestInsurerSeed:

    def test_has_all_10_insurers(self):
        expected_codes = {"yelum", "porto", "azul", "itau", "hdi",
                          "mapfre", "tokio", "bradesco", "allianz", "suhai"}
        codes = set(Insurer.objects.values_list("code", flat=True))
        assert expected_codes.issubset(codes)

    def test_yelum_uses_cilia_api(self):
        yelum = Insurer.objects.get(code="yelum")
        assert yelum.import_source == "cilia_api"
        assert yelum.name == "Yelum Seguradora"

    def test_porto_uses_xml_upload(self):
        assert Insurer.objects.get(code="porto").import_source == "xml_upload"

    def test_hdi_uses_html_upload(self):
        assert Insurer.objects.get(code="hdi").import_source == "html_upload"

    def test_all_active_by_default(self):
        assert Insurer.objects.filter(is_active=False).count() == 0

    def test_str_returns_name(self):
        assert str(Insurer.objects.get(code="yelum")) == "Yelum Seguradora"
