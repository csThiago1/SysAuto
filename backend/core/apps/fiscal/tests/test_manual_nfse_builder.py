"""
Testes unitários para ManualNfseBuilder e ManualNfseInputSerializer.

Ciclo 06C — Task 3: emissão manual de NFS-e (sem OS de origem).

Sem DB, sem Docker — todas as dependências de ORM são mockadas.
Exceções: testes de serializer que precisam validar lógica de validação
usam mock em Person.objects para evitar DB.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.fiscal.services.manaus_nfse import (
    ManualNfseBuilder,
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
    pk: int = 42,
    doc: MagicMock | None = None,
    address: MagicMock | None = None,
) -> MagicMock:
    """Cria mock de Person com documents e addresses QuerySet-like."""
    person = MagicMock()
    person.pk = pk
    person.full_name = full_name

    _doc = doc if doc is not None else _make_document()
    _addr = address if address is not None else _make_address()

    # Simula QuerySet.filter().first() para documents
    docs_qs = MagicMock()
    docs_qs.filter.return_value.first.return_value = _doc
    person.documents = docs_qs

    # Simula QuerySet.filter().first() e .first() para addresses
    addr_qs = MagicMock()
    addr_qs.filter.return_value.first.return_value = _addr
    addr_qs.first.return_value = _addr
    person.addresses = addr_qs

    return person


def _make_input_data(
    itens: list | None = None,
    discriminacao: str = "Polimento completo do veículo",
    codigo_servico_lc116: str = "14.01",
    aliquota_iss: Decimal | None = None,
    iss_retido: bool = False,
    data_emissao: datetime | None = None,
    observacoes_contribuinte: str = "",
    manual_reason: str = "Emissão manual aprovada pelo gerente",
) -> dict:
    """Cria dict de validated_data para ManualNfseBuilder.build()."""
    if itens is None:
        itens = [
            {
                "descricao": "Polimento completo",
                "quantidade": Decimal("1"),
                "valor_unitario": Decimal("350.00"),
                "valor_desconto": Decimal("0"),
            }
        ]
    data: dict = {
        "itens": itens,
        "discriminacao": discriminacao,
        "codigo_servico_lc116": codigo_servico_lc116,
        "iss_retido": iss_retido,
        "observacoes_contribuinte": observacoes_contribuinte,
        "manual_reason": manual_reason,
    }
    if aliquota_iss is not None:
        data["aliquota_iss"] = aliquota_iss
    if data_emissao is not None:
        data["data_emissao"] = data_emissao
    return data


# ─── testes ManualNfseBuilder ──────────────────────────────────────────────────


class TestManualNfseBuilderBuild:
    """Testes para ManualNfseBuilder.build()."""

    def test_build_returns_required_keys(self) -> None:
        """Payload deve conter todas as chaves raiz obrigatórias."""
        person = _make_person()
        config = _make_config()
        input_data = _make_input_data()

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-20260424-000001")

        assert "data_emissao" in result
        assert "prestador" in result
        assert "tomador" in result
        assert "rps" in result
        assert "servico" in result

    def test_valor_total_calculado_corretamente(self) -> None:
        """valor_servicos = sum(qty * price - desconto) para todos os itens."""
        itens = [
            {
                "descricao": "Polimento simples",
                "quantidade": Decimal("2"),
                "valor_unitario": Decimal("150.00"),
                "valor_desconto": Decimal("10.00"),
            },
            {
                "descricao": "Cristalização",
                "quantidade": Decimal("1"),
                "valor_unitario": Decimal("200.00"),
                "valor_desconto": Decimal("0"),
            },
        ]
        # Item 1: 2 * 150 - 10 = 290
        # Item 2: 1 * 200 - 0 = 200
        # Total: 490.00
        person = _make_person()
        config = _make_config()
        input_data = _make_input_data(itens=itens)

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-TEST-001")

        # str(Decimal) preserves precision — 490.00 not 490
        assert Decimal(result["servico"]["valor_servicos"]) == Decimal("490.00")

    def test_aliquota_from_input_overrides_config(self) -> None:
        """aliquota_iss do input deve ter precedência sobre config.aliquota_iss_default."""
        person = _make_person()
        # config com 2%, input com 5%
        config = _make_config(aliquota_iss=Decimal("2.00"))
        input_data = _make_input_data(aliquota_iss=Decimal("5.00"))
        # 350 * 5 / 100 = 17.50

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-TEST-002")

        assert result["servico"]["aliquota"] == "5.00"
        assert result["servico"]["valor_iss"] == "17.50"

    def test_aliquota_fallback_to_config(self) -> None:
        """Se aliquota_iss não estiver no input, usa config.aliquota_iss_default."""
        person = _make_person()
        config = _make_config(aliquota_iss=Decimal("3.00"))
        # input sem aliquota_iss
        input_data = _make_input_data()  # valor_unitario=350, aliquota_iss ausente
        # 350 * 3 / 100 = 10.50

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-TEST-003")

        assert result["servico"]["aliquota"] == "3.00"
        assert result["servico"]["valor_iss"] == "10.50"

    def test_iss_retido_propagado(self) -> None:
        """iss_retido deve vir do input_data."""
        person = _make_person()
        config = _make_config()
        input_data_false = _make_input_data(iss_retido=False)
        input_data_true = _make_input_data(iss_retido=True)

        result_false = ManualNfseBuilder.build(
            input_data_false, person, config, ref="MANUAL-ISS-FALSE"
        )
        result_true = ManualNfseBuilder.build(
            input_data_true, person, config, ref="MANUAL-ISS-TRUE"
        )

        assert result_false["servico"]["iss_retido"] is False
        assert result_true["servico"]["iss_retido"] is True

    def test_data_emissao_none_uses_now(self) -> None:
        """Quando data_emissao é None, deve usar datetime atual em ISO format."""
        person = _make_person()
        config = _make_config()
        input_data = _make_input_data()  # sem data_emissao

        before = datetime.now(tz=timezone.utc)
        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-DATE-001")
        after = datetime.now(tz=timezone.utc)

        data_str = result["data_emissao"]
        assert isinstance(data_str, str)
        # A data deve ser um ISO string válido e estar entre before e after
        parsed = datetime.fromisoformat(data_str)
        assert before <= parsed <= after

    def test_data_emissao_from_input(self) -> None:
        """Quando data_emissao é fornecida, deve ser usada no payload."""
        person = _make_person()
        config = _make_config()
        data_especifica = datetime(2026, 4, 20, 10, 30, 0, tzinfo=timezone.utc)
        input_data = _make_input_data(data_emissao=data_especifica)

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-DATE-002")

        assert result["data_emissao"] == data_especifica.isoformat()

    def test_reutiliza_tomador_de_manaus_builder(self) -> None:
        """Bloco tomador deve ser idêntico ao retornado por ManausNfseBuilder._get_tomador."""
        person = _make_person()
        config = _make_config()
        input_data = _make_input_data()

        result_manual = ManualNfseBuilder.build(
            input_data, person, config, ref="MANUAL-TOMADOR-001"
        )
        result_manaus = ManausNfseBuilder._get_tomador(person)

        assert result_manual["tomador"] == result_manaus

    def test_prestador_usa_dados_do_config(self) -> None:
        """Prestador deve usar CNPJ e inscrição municipal do FiscalConfigModel."""
        person = _make_person()
        config = _make_config(cnpj="99999999000100", inscricao_municipal="654321")
        input_data = _make_input_data()

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-PREST-001")

        assert result["prestador"]["cnpj"] == "99999999000100"
        assert result["prestador"]["inscricao_municipal"] == "654321"
        assert result["prestador"]["codigo_municipio"] == ManualNfseBuilder.MUNICIPIO_IBGE_MANAUS

    def test_servico_contém_discriminacao(self) -> None:
        """Campo discriminacao do input deve aparecer no bloco servico."""
        person = _make_person()
        config = _make_config()
        texto_discriminacao = "Serviço de polimento completo Orbis 3 etapas"
        input_data = _make_input_data(discriminacao=texto_discriminacao)

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-DISC-001")

        assert result["servico"]["discriminacao"] == texto_discriminacao

    def test_servico_codigo_municipio_manaus(self) -> None:
        """servico.codigo_municipio deve ser o IBGE de Manaus."""
        person = _make_person()
        config = _make_config()
        input_data = _make_input_data()

        result = ManualNfseBuilder.build(input_data, person, config, ref="MANUAL-MUN-001")

        assert result["servico"]["codigo_municipio"] == "1302603"


# ─── testes ManualNfseInputSerializer ──────────────────────────────────────────


class TestManualNfseInputSerializer:
    """Testes para ManualNfseInputSerializer e ManualItemInputSerializer."""

    def _get_serializer(self, data: dict) -> object:
        from apps.fiscal.serializers import ManualNfseInputSerializer

        return ManualNfseInputSerializer(data=data)

    def _valid_payload(self, **overrides: object) -> dict:
        base: dict = {
            "destinatario_id": 42,
            "itens": [
                {
                    "descricao": "Polimento completo",
                    "quantidade": "1.0000",
                    "valor_unitario": "350.0000",
                    "valor_desconto": "0.00",
                }
            ],
            "discriminacao": "Polimento completo do veículo",
            "codigo_servico_lc116": "14.01",
            "aliquota_iss": "2.00",
            "iss_retido": False,
            "data_emissao": None,
            "observacoes_contribuinte": "",
            "manual_reason": "Emissão manual autorizada pelo gerente",
        }
        base.update(overrides)
        return base

    def _mock_valid_person(self) -> MagicMock:
        """Mock de Person com documento primário e endereço com municipio_ibge."""
        person = MagicMock()
        # documents.filter(is_primary=True).exists() → True
        person.documents.filter.return_value.exists.return_value = True
        # addresses.filter(is_primary=True).exclude().exists() → True
        person.addresses.filter.return_value.exclude.return_value.exists.return_value = True
        # addresses.exclude().exists() → True (fallback)
        person.addresses.exclude.return_value.exists.return_value = True
        return person

    def test_serializer_valid_data(self) -> None:
        """Payload válido deve passar na validação do serializer."""
        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        payload = self._valid_payload()

        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert serializer.is_valid(), serializer.errors  # type: ignore[union-attr]

    def test_serializer_rejects_old_data_emissao(self) -> None:
        """data_emissao mais de 30 dias no passado deve falhar na validação."""
        data_antiga = datetime.now(tz=timezone.utc) - timedelta(days=31)
        payload = self._valid_payload(data_emissao=data_antiga.isoformat())

        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "data_emissao" in serializer.errors  # type: ignore[union-attr]
            error_str = str(serializer.errors["data_emissao"])  # type: ignore[union-attr]
            assert "30 dias" in error_str

    def test_serializer_rejects_empty_itens(self) -> None:
        """Lista de itens vazia deve falhar na validação."""
        payload = self._valid_payload(itens=[])

        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "itens" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_requires_manual_reason(self) -> None:
        """Ausência de manual_reason deve falhar na validação."""
        payload = self._valid_payload()
        del payload["manual_reason"]

        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "manual_reason" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_rejects_manual_reason_too_short(self) -> None:
        """manual_reason com menos de 5 caracteres deve falhar na validação."""
        payload = self._valid_payload(manual_reason="abc")

        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "manual_reason" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_destinatario_not_found(self) -> None:
        """Person.DoesNotExist deve resultar em erro de validação em destinatario_id."""
        from apps.persons.models import Person as RealPerson

        payload = self._valid_payload(destinatario_id=9999)
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.DoesNotExist = RealPerson.DoesNotExist
            MockPerson.objects.prefetch_related.return_value.get.side_effect = (
                RealPerson.DoesNotExist
            )

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "destinatario_id" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_destinatario_without_primary_document(self) -> None:
        """Person sem documento primário deve resultar em erro de validação."""
        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        # Sobrescreve: sem documento primário
        person.documents.filter.return_value.exists.return_value = False

        payload = self._valid_payload()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.DoesNotExist = RealPerson.DoesNotExist
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "destinatario_id" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_destinatario_without_address_municipio_ibge(self) -> None:
        """Person sem endereço com municipio_ibge deve resultar em erro de validação."""
        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        # Sobrescreve: sem endereço com municipio_ibge
        person.addresses.filter.return_value.exclude.return_value.exists.return_value = False
        person.addresses.exclude.return_value.exists.return_value = False

        payload = self._valid_payload()
        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.DoesNotExist = RealPerson.DoesNotExist
            MockPerson.objects.prefetch_related.return_value.get.return_value = person

            serializer = self._get_serializer(payload)
            assert not serializer.is_valid()  # type: ignore[union-attr]
            assert "destinatario_id" in serializer.errors  # type: ignore[union-attr]

    def test_serializer_data_emissao_none_is_allowed(self) -> None:
        """data_emissao=None deve ser aceito (gera datetime atual no builder)."""
        from apps.persons.models import Person as RealPerson

        person = self._mock_valid_person()
        payload = self._valid_payload(data_emissao=None)

        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert serializer.is_valid(), serializer.errors  # type: ignore[union-attr]
            assert serializer.validated_data["data_emissao"] is None  # type: ignore[union-attr]

    def test_serializer_data_emissao_future_is_allowed(self) -> None:
        """data_emissao no futuro próximo deve ser aceito."""
        from apps.persons.models import Person as RealPerson

        data_futura = datetime.now(tz=timezone.utc) + timedelta(days=1)
        person = self._mock_valid_person()
        payload = self._valid_payload(data_emissao=data_futura.isoformat())

        with patch("apps.fiscal.serializers.Person", autospec=False) as MockPerson:
            MockPerson.objects.prefetch_related.return_value.get.return_value = person
            MockPerson.DoesNotExist = RealPerson.DoesNotExist

            serializer = self._get_serializer(payload)
            assert serializer.is_valid(), serializer.errors  # type: ignore[union-attr]
