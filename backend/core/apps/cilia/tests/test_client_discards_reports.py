"""O cliente descarta os relatórios base64 na entrada.

São 96% do payload (report_html ~0,9 MB, report_pdf ~0,1 MB) e nada no
import os consome. Em produção o worker roda com MemoryMax=250M, então
carregar isso por todo o pipeline — e gravá-lo no raw_payload do
ImportAttempt — é desperdício com risco de OOM.
"""
from __future__ import annotations

import json
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase

from apps.cilia.client import CiliaClient
from apps.cilia.sources.cilia_parser import CiliaParser


def _payload(**extra: object) -> dict:
    return {
        "budget_number": 905433,
        "version_number": 2,
        "casualty_number": "22575391",
        "totals": {"total_liquid": 2985.05},
        **extra,
    }


class ClientDiscardsReportsTest(SimpleTestCase):
    def _get_budget(self, payload: dict) -> dict | None:
        response = httpx.Response(
            200,
            content=json.dumps(payload).encode(),
            headers={"content-type": "application/json"},
            request=httpx.Request("GET", "https://sistema.cilia.com.br"),
        )
        with patch("httpx.Client.get", return_value=response):
            return CiliaClient(auth_token="t").get_budget(
                casualty_number="22575391", budget_number=905433,
            ).data

    def test_descarta_relatorios_pesados(self) -> None:
        data = self._get_budget(
            _payload(report_html="A" * 5000, report_pdf="B" * 5000)
        )
        assert data is not None
        self.assertNotIn("report_html", data)
        self.assertNotIn("report_pdf", data)

    def test_preserva_os_dados_uteis(self) -> None:
        data = self._get_budget(_payload(report_html="A" * 5000))
        assert data is not None
        self.assertEqual(data["budget_number"], 905433)
        self.assertEqual(data["casualty_number"], "22575391")
        self.assertEqual(data["totals"], {"total_liquid": 2985.05})

    def test_payload_sem_os_campos_nao_quebra(self) -> None:
        data = self._get_budget(_payload())
        assert data is not None
        self.assertEqual(data["budget_number"], 905433)

    def test_hash_da_versao_nao_muda_com_o_descarte(self) -> None:
        """O dedup não pode enxergar diferença — senão reimporta tudo uma vez."""
        com_relatorios = CiliaParser._compute_hash(
            _payload(report_html="A" * 5000, report_pdf="B" * 5000)
        )
        sem_relatorios = CiliaParser._compute_hash(_payload())
        self.assertEqual(com_relatorios, sem_relatorios)
