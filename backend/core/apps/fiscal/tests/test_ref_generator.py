"""
Testes T6: ref_generator.next_fiscal_ref().
"""

import re

import pytest

from apps.fiscal.services.ref_generator import SEQ_FIELD_BY_TYPE, next_fiscal_ref


@pytest.mark.django_db
def test_next_fiscal_ref_format_nfse(fiscal_config):
    """Ref de NFS-e deve ter formato correto: {cnpj8}-NFSE-{YYYYMMDD}-{seq6}."""
    ref, seq = next_fiscal_ref(fiscal_config, "NFSE")

    pattern = r"^\d{8}-NFSE-\d{8}-\d{6}$"
    assert re.match(pattern, ref), f"Ref inválida: {ref!r}"
    assert ref.startswith("12345678")


@pytest.mark.django_db
def test_next_fiscal_ref_format_nfe(fiscal_config):
    """Ref de NF-e deve ter formato correto: {cnpj8}-NFE-{YYYYMMDD}-{seq6}."""
    ref, seq = next_fiscal_ref(fiscal_config, "NFE")

    pattern = r"^\d{8}-NFE-\d{8}-\d{6}$"
    assert re.match(pattern, ref), f"Ref inválida: {ref!r}"


@pytest.mark.django_db
def test_next_fiscal_ref_increments_seq(fiscal_config):
    """Cada chamada deve incrementar o sequenciador."""
    ref1, seq1 = next_fiscal_ref(fiscal_config, "NFSE")
    ref2, seq2 = next_fiscal_ref(fiscal_config, "NFSE")

    assert seq2 == seq1 + 1
    assert ref1 != ref2


@pytest.mark.django_db
def test_next_fiscal_ref_independent_counters(fiscal_config):
    """Contadores de NFSE, NFE e NFCE são independentes."""
    _, seq_nfse_1 = next_fiscal_ref(fiscal_config, "NFSE")
    _, seq_nfse_2 = next_fiscal_ref(fiscal_config, "NFSE")
    _, seq_nfe_1 = next_fiscal_ref(fiscal_config, "NFE")

    # NFSE incrementou duas vezes
    fiscal_config.refresh_from_db()
    assert fiscal_config.seq_nfse == 3  # começa em 1, incrementou 2x, seq atual = 3

    # NFE incrementou uma vez
    assert fiscal_config.seq_nfe == 2

    # NFCE não foi tocado
    assert fiscal_config.seq_nfce == 1


@pytest.mark.django_db
def test_next_fiscal_ref_returns_correct_seq(fiscal_config):
    """seq retornado deve ser o valor antes do incremento (base 1)."""
    # seq_nfse começa em 1
    ref, seq = next_fiscal_ref(fiscal_config, "NFSE")

    # Primeiro seq retornado deve ser 1 (o "anterior" ao 2 que ficou no DB)
    assert seq == 1
    assert ref.endswith("-000001")


def test_next_fiscal_ref_invalid_doc_type(fiscal_config):
    """doc_type inválido deve levantar ValueError."""
    with pytest.raises(ValueError, match="doc_type não suportado"):
        next_fiscal_ref(fiscal_config, "INVALIDO")


def test_seq_field_mapping():
    """SEQ_FIELD_BY_TYPE deve conter todos os tipos suportados."""
    assert "NFSE" in SEQ_FIELD_BY_TYPE
    assert "NFE" in SEQ_FIELD_BY_TYPE
    assert "NFE_DEV" in SEQ_FIELD_BY_TYPE
    assert "NFCE" in SEQ_FIELD_BY_TYPE
    assert SEQ_FIELD_BY_TYPE["NFSE"] == "seq_nfse"
    assert SEQ_FIELD_BY_TYPE["NFE"] == "seq_nfe"
    assert SEQ_FIELD_BY_TYPE["NFCE"] == "seq_nfce"
