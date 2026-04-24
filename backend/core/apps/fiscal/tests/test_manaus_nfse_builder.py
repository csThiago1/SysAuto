"""
Testes unitários para ManausNfseBuilder.

Sem DB, sem Docker — apenas unittest.mock.
Todas as dependências de ORM são mockadas.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.fiscal.services.manaus_nfse import (
    LC116_DEFAULT,
    LC116_MAP,
    ManausNfseBuilder,
    NfseBuilderError,
)


# ─── helpers ──────────────────────────────────────────────────────────────────


def _make_config(
    cnpj: str = "12345678000195",
    inscricao_municipal: str = "123456",
    serie_rps: str = "1",
    aliquota_iss: Decimal | None = None,
) -> MagicMock:
    """Cria mock de FiscalConfigModel com valores padrão."""
    cfg = MagicMock()
    cfg.cnpj = cnpj
    cfg.inscricao_municipal = inscricao_municipal
    cfg.serie_rps = serie_rps
    cfg.aliquota_iss_default = aliquota_iss if aliquota_iss is not None else Decimal("2.00")
    return cfg


def _make_address(
    municipio_ibge: str = "1302603",
    street: str = "Av. Djalma Batista",
    number: str = "1000",
    complement: str = "Sala 1",
    neighborhood: str = "Chapada",
    state: str = "AM",
    zip_code: str = "69050010",
    is_primary: bool = True,
) -> MagicMock:
    addr = MagicMock()
    addr.municipio_ibge = municipio_ibge
    addr.street = street
    addr.number = number
    addr.complement = complement
    addr.neighborhood = neighborhood
    addr.state = state
    addr.zip_code = zip_code
    addr.is_primary = is_primary
    return addr


def _make_document(
    doc_type: str = "CPF",
    value: str = "12345678901",
    is_primary: bool = True,
) -> MagicMock:
    doc = MagicMock()
    doc.doc_type = doc_type
    doc.value = value
    doc.is_primary = is_primary
    return doc


def _make_person(
    full_name: str = "João da Silva",
    doc: MagicMock | None = None,
    address: MagicMock | None = None,
) -> MagicMock:
    """Cria mock de Person com documents e addresses QuerySet-like."""
    person = MagicMock()
    person.pk = 42
    person.full_name = full_name

    _doc = doc if doc is not None else _make_document()
    _addr = address if address is not None else _make_address()

    # Simula QuerySet.filter().first() para documents
    docs_qs = MagicMock()
    docs_qs.filter.return_value.first.return_value = _doc
    person.documents = docs_qs

    # Simula QuerySet.filter().first() e .first() para addresses
    addr_primary_qs = MagicMock()
    addr_primary_qs.filter.return_value.first.return_value = _addr
    addr_primary_qs.first.return_value = _addr
    person.addresses = addr_primary_qs

    return person


def _make_service_order(
    pk: int = 1,
    number: int = 42,
    customer_id: int = 42,
    services_total: Decimal | None = None,
    parts_total: Decimal | None = None,
    os_type: str = "mechanical",
    make: str = "Toyota",
    model: str = "Corolla",
    year: int = 2022,
    plate: str = "ABC1D23",
    labor_items: list | None = None,
    parts: list | None = None,
) -> MagicMock:
    os = MagicMock()
    os.pk = pk
    os.number = number
    os.customer_id = customer_id
    os.services_total = services_total if services_total is not None else Decimal("500.00")
    os.parts_total = parts_total if parts_total is not None else Decimal("200.00")
    os.os_type = os_type
    os.make = make
    os.model = model
    os.year = year
    os.plate = plate

    # labor_items related manager
    labor_qs = MagicMock()
    labor_qs.all.return_value = labor_items if labor_items is not None else []
    os.labor_items = labor_qs

    # parts related manager
    parts_qs = MagicMock()
    parts_qs.all.return_value = parts if parts is not None else []
    os.parts = parts_qs

    return os


# ─── testes ───────────────────────────────────────────────────────────────────


class TestManausNfseBuilderBuild:
    """Testes para ManausNfseBuilder.build()."""

    def test_build_pf_returns_dict_with_required_keys(self) -> None:
        """Payload deve conter todas as chaves raiz obrigatórias."""
        person = _make_person()
        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            result = ManausNfseBuilder.build(os, config, ref="12345678-NFSE-20260424-000001")

        assert "data_emissao" in result
        assert "prestador" in result
        assert "tomador" in result
        assert "rps" in result
        assert "servico" in result

    def test_build_pf_cpf_in_tomador(self) -> None:
        """Pessoa Física → tomador deve conter chave 'cpf'."""
        doc = _make_document(doc_type="CPF", value="12345678901")
        person = _make_person(doc=doc)
        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            result = ManausNfseBuilder.build(os, config, ref="REF-001")

        assert "cpf" in result["tomador"]
        assert result["tomador"]["cpf"] == "12345678901"
        assert "cnpj" not in result["tomador"]

    def test_build_pj_cnpj_in_tomador(self) -> None:
        """Pessoa Jurídica → tomador deve conter chave 'cnpj'."""
        doc = _make_document(doc_type="CNPJ", value="12345678000195")
        person = _make_person(doc=doc)
        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            result = ManausNfseBuilder.build(os, config, ref="REF-002")

        assert "cnpj" in result["tomador"]
        assert result["tomador"]["cnpj"] == "12345678000195"
        assert "cpf" not in result["tomador"]

    def test_build_no_primary_document_raises(self) -> None:
        """Person sem documento primário deve levantar NfseBuilderError."""
        person = _make_person()
        # Sobrescreve: filter().first() retorna None
        person.documents.filter.return_value.first.return_value = None

        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            with pytest.raises(NfseBuilderError, match="não tem PersonDocument primário"):
                ManausNfseBuilder.build(os, config, ref="REF-003")

    def test_build_no_address_raises(self) -> None:
        """Person sem endereço algum deve levantar NfseBuilderError."""
        person = _make_person()
        # filter().first() → None e .first() → None
        person.addresses.filter.return_value.first.return_value = None
        person.addresses.first.return_value = None

        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            with pytest.raises(NfseBuilderError, match="não tem PersonAddress"):
                ManausNfseBuilder.build(os, config, ref="REF-004")

    def test_build_address_no_municipio_ibge_raises(self) -> None:
        """Endereço com municipio_ibge vazio deve levantar NfseBuilderError."""
        addr = _make_address(municipio_ibge="")
        person = _make_person(address=addr)

        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            with pytest.raises(NfseBuilderError, match="não tem PersonAddress com municipio_ibge"):
                ManausNfseBuilder.build(os, config, ref="REF-005")

    def test_prestador_uses_config_cnpj_and_inscricao_municipal(self) -> None:
        """Prestador deve ter os dados do FiscalConfigModel."""
        person = _make_person()
        os = _make_service_order()
        config = _make_config(cnpj="99999999000100", inscricao_municipal="654321")

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            result = ManausNfseBuilder.build(os, config, ref="REF-006")

        assert result["prestador"]["cnpj"] == "99999999000100"
        assert result["prestador"]["inscricao_municipal"] == "654321"
        assert result["prestador"]["codigo_municipio"] == ManausNfseBuilder.MUNICIPIO_IBGE_MANAUS


class TestManausNfseBuilderServico:
    """Testes para o bloco servico."""

    def _build_servico(
        self,
        services_total: Decimal,
        parts_total: Decimal,
        parts_as_service: bool = True,
        os_type: str = "mechanical",
        aliquota: Decimal | None = None,
    ) -> dict:
        person = _make_person()
        os = _make_service_order(
            services_total=services_total,
            parts_total=parts_total,
            os_type=os_type,
        )
        config = _make_config(aliquota_iss=aliquota)

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(
                os, config, ref="REF-TEST", parts_as_service=parts_as_service
            )

        return result["servico"]

    def test_parts_as_service_true_includes_parts_total(self) -> None:
        """parts_as_service=True → valor_servicos = services_total + parts_total."""
        servico = self._build_servico(
            services_total=Decimal("500.00"),
            parts_total=Decimal("200.00"),
            parts_as_service=True,
        )
        assert servico["valor_servicos"] == "700.00"

    def test_parts_as_service_false_excludes_parts_total(self) -> None:
        """parts_as_service=False → valor_servicos = apenas services_total."""
        servico = self._build_servico(
            services_total=Decimal("500.00"),
            parts_total=Decimal("200.00"),
            parts_as_service=False,
        )
        assert servico["valor_servicos"] == "500.00"

    def test_valor_iss_calculado_corretamente(self) -> None:
        """ISS = valor_total * aliquota / 100, arredondado em 2 casas."""
        servico = self._build_servico(
            services_total=Decimal("1000.00"),
            parts_total=Decimal("0.00"),
            parts_as_service=True,
            aliquota=Decimal("2.00"),
        )
        # 1000 * 2 / 100 = 20.00
        assert servico["valor_iss"] == "20.00"

    def test_lc116_vidracaria(self) -> None:
        """OS do tipo 'vidracaria' → item_lista_servico = '14.05'."""
        servico = self._build_servico(
            services_total=Decimal("300.00"),
            parts_total=Decimal("0.00"),
            os_type="vidracaria",
        )
        assert servico["item_lista_servico"] == "14.05"

    def test_lc116_default_mecanica(self) -> None:
        """OS do tipo 'mechanical' (desconhecido no mapa) → item_lista_servico = '14.01'."""
        servico = self._build_servico(
            services_total=Decimal("300.00"),
            parts_total=Decimal("0.00"),
            os_type="mechanical",
        )
        assert servico["item_lista_servico"] == LC116_DEFAULT

    def test_codigo_municipio_manaus_em_servico(self) -> None:
        """servico.codigo_municipio deve ser o IBGE de Manaus."""
        servico = self._build_servico(
            services_total=Decimal("100.00"),
            parts_total=Decimal("0.00"),
        )
        assert servico["codigo_municipio"] == "1302603"

    def test_iss_retido_sempre_false(self) -> None:
        """iss_retido deve ser False (padrão Manaus)."""
        servico = self._build_servico(
            services_total=Decimal("100.00"),
            parts_total=Decimal("0.00"),
        )
        assert servico["iss_retido"] is False


class TestManausNfseBuilderRps:
    """Testes para o bloco RPS."""

    def test_rps_numero_extracted_from_ref(self) -> None:
        """ref com sufixo numérico com zeros → numero sem zeros à esquerda."""
        person = _make_person()
        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(
                os, config, ref="12345678-NFSE-20260424-000042"
            )

        assert result["rps"]["numero"] == "42"

    def test_rps_serie_from_config(self) -> None:
        """rps.serie deve vir de config.serie_rps."""
        person = _make_person()
        os = _make_service_order()
        config = _make_config(serie_rps="RPS")

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(os, config, ref="X-001")

        assert result["rps"]["serie"] == "RPS"

    def test_rps_tipo_sempre_1(self) -> None:
        """rps.tipo deve ser '1' (padrão ABRASF)."""
        person = _make_person()
        os = _make_service_order()
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(os, config, ref="REF-007")

        assert result["rps"]["tipo"] == "1"


class TestManausNfseBuilderDiscriminacao:
    """Testes para _format_discriminacao."""

    def test_discriminacao_truncation(self) -> None:
        """OS com muito texto deve ter discriminacao truncada em 2000 chars com aviso de log."""
        # Cria muitos labor_items com descrição longa para forçar o truncamento
        labor_items = []
        for i in range(100):
            labor = MagicMock()
            labor.description = f"Serviço muito detalhado número {i:03d} com descrição bastante extensa para encher o buffer"
            labor.quantity = 1
            labor.unit_price = Decimal("50.00")
            labor_items.append(labor)

        person = _make_person()
        os = _make_service_order(labor_items=labor_items)
        config = _make_config()

        # Verifica que o logger.warning foi chamado ao truncar
        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            with patch("apps.fiscal.services.manaus_nfse.logger") as mock_logger:
                result = ManausNfseBuilder.build(os, config, ref="REF-TRUNC")

        discriminacao = result["servico"]["discriminacao"]
        # O texto deve estar truncado em DISCRIMINACAO_MAX
        assert len(discriminacao) <= ManausNfseBuilder.DISCRIMINACAO_MAX
        # logger.warning deve ter sido chamado com "truncada"
        mock_logger.warning.assert_called_once()
        warning_msg = mock_logger.warning.call_args[0][0]
        assert "truncada" in warning_msg

    def test_discriminacao_inclui_numero_os(self) -> None:
        """discriminacao deve incluir o número da OS."""
        person = _make_person()
        os = _make_service_order(number=12345)
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(os, config, ref="REF-008")

        assert "OS #12345" in result["servico"]["discriminacao"]

    def test_discriminacao_inclui_veiculo(self) -> None:
        """discriminacao deve incluir marca, modelo e placa do veículo."""
        person = _make_person()
        os = _make_service_order(make="Honda", model="Civic", plate="XYZ1A23")
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(os, config, ref="REF-009")

        disc = result["servico"]["discriminacao"]
        assert "Honda" in disc
        assert "Civic" in disc
        assert "XYZ1A23" in disc

    def test_discriminacao_inclui_pecas_quando_parts_as_service_true(self) -> None:
        """parts_as_service=True → peças listadas na discriminacao."""
        part = MagicMock()
        part.description = "Para-choque dianteiro"
        part.quantity = Decimal("1")
        part.unit_price = Decimal("350.00")

        person = _make_person()
        os = _make_service_order(parts=[part])
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(
                os, config, ref="REF-010", parts_as_service=True
            )

        assert "Para-choque dianteiro" in result["servico"]["discriminacao"]

    def test_discriminacao_exclui_pecas_quando_parts_as_service_false(self) -> None:
        """parts_as_service=False → peças NÃO listadas na discriminacao."""
        part = MagicMock()
        part.description = "Para-choque traseiro"
        part.quantity = Decimal("1")
        part.unit_price = Decimal("280.00")

        person = _make_person()
        os = _make_service_order(parts=[part])
        config = _make_config()

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            result = ManausNfseBuilder.build(
                os, config, ref="REF-011", parts_as_service=False
            )

        assert "Para-choque traseiro" not in result["servico"]["discriminacao"]


class TestManausNfseBuilderLc116:
    """Testes unitários para _get_lc116_code."""

    def test_lc116_vidracaria_key(self) -> None:
        assert ManausNfseBuilder._get_lc116_code("vidracaria") == "14.05"

    def test_lc116_vidracaria_uppercase(self) -> None:
        """Deve ser case-insensitive."""
        assert ManausNfseBuilder._get_lc116_code("VIDRACARIA") == "14.05"

    def test_lc116_default_for_unknown_type(self) -> None:
        assert ManausNfseBuilder._get_lc116_code("bodywork") == LC116_DEFAULT

    def test_lc116_empty_string(self) -> None:
        assert ManausNfseBuilder._get_lc116_code("") == LC116_DEFAULT


class TestManausNfseBuilderGetPerson:
    """Testes para _get_person."""

    def test_customer_id_none_raises(self) -> None:
        """OS sem customer associado deve levantar NfseBuilderError."""
        os = _make_service_order()
        os.customer_id = None

        with pytest.raises(NfseBuilderError, match="não tem customer associado"):
            ManausNfseBuilder._get_person(os)

    def test_person_does_not_exist_raises(self) -> None:
        """Person.DoesNotExist → NfseBuilderError com customer_id na mensagem."""
        from apps.persons.models import Person as RealPerson

        os = _make_service_order(customer_id=999)

        with patch("apps.fiscal.services.manaus_nfse.Person") as MockPerson:
            MockPerson.DoesNotExist = RealPerson.DoesNotExist
            MockPerson.objects.prefetch_related.return_value.get.side_effect = (
                RealPerson.DoesNotExist
            )

            with pytest.raises(NfseBuilderError, match="customer_id=999"):
                ManausNfseBuilder._get_person(os)
