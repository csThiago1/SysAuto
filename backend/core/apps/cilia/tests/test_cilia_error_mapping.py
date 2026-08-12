"""Tradução de resposta da Cilia em exceção tipada.

O 404 precisa ser distinguível dos demais erros: na sondagem de versões ele
significa "a seguradora ainda não publicou a próxima", não falha. Confundir
os dois faria o polling tratar token inválido como "sem novidade" e ficar
mudo para sempre.
"""
from __future__ import annotations

from unittest.mock import patch

from django.test import SimpleTestCase

from apps.cilia.client import CiliaError, CiliaResponse
from apps.cilia.services import (
    CiliaImportError,
    CiliaVersionNotFound,
    fetch_parsed_budget,
)


class FetchParsedBudgetTest(SimpleTestCase):
    def _fetch_with_status(self, status_code: int) -> None:
        response = CiliaResponse(
            status_code=status_code, data={}, duration_ms=10, raw_text="",
        )
        with patch(
            "apps.cilia.client.CiliaClient.get_budget", return_value=response,
        ):
            fetch_parsed_budget(casualty_number="1", budget_number="2", version_number=3)

    def test_404_vira_version_not_found(self) -> None:
        with self.assertRaises(CiliaVersionNotFound) as ctx:
            self._fetch_with_status(404)
        self.assertEqual(ctx.exception.http_status, 404)

    def test_403_nao_e_confundido_com_versao_inexistente(self) -> None:
        with self.assertRaises(CiliaImportError) as ctx:
            self._fetch_with_status(403)
        self.assertNotIsInstance(ctx.exception, CiliaVersionNotFound)
        self.assertEqual(ctx.exception.error_type, "HTTP403")

    def test_erro_de_rede_nao_e_confundido_com_versao_inexistente(self) -> None:
        with patch(
            "apps.cilia.client.CiliaClient.get_budget",
            side_effect=CiliaError("timeout"),
        ):
            with self.assertRaises(CiliaImportError) as ctx:
                fetch_parsed_budget(casualty_number="1", budget_number="2")
        self.assertNotIsInstance(ctx.exception, CiliaVersionNotFound)
        self.assertEqual(ctx.exception.error_type, "NetworkError")
