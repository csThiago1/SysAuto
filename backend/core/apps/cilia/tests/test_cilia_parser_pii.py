"""O parser Cilia não pode escrever o telefone do segurado no log (LGPD)."""
from __future__ import annotations

import copy
import json
import logging
from pathlib import Path

import pytest

from apps.cilia.sources.cilia_parser import CiliaParser

FIXTURES = Path(__file__).parent / "fixtures"


def test_telefone_invalido_nao_vai_para_o_log(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    # O logger "apps" tem propagate=False em base.py; o caplog fica na raiz.
    monkeypatch.setattr(logging.getLogger("apps"), "propagate", True)
    with open(FIXTURES / "cilia_yelum_insurer_supplied.json", encoding="utf-8") as fp:
        payload = copy.deepcopy(json.load(fp))
    payload.setdefault("client", {})["phone"] = {"ddd": "92", "number": "9123456"}

    with caplog.at_level(logging.WARNING, logger="apps.cilia.sources.cilia_parser"):
        CiliaParser.parse(payload)

    assert "telefone com 9 digitos" in caplog.text
    assert "929123456" not in caplog.text
    assert "9123456" not in caplog.text
