"""Escolha de (orçamento, versão) a sondar na próxima varredura.

Errar esse número é silencioso: pede uma versão que não existe, leva 404 e o
polling conclui "sem novidade" para sempre.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from django.test import SimpleTestCase

from apps.imports.tasks import _next_cilia_target


@dataclass
class FakeVersion:
    external_version: str
    version_number: int = 1
    status: str = "pending"
    source: str = "cilia"


class FakeVersions:
    """Imita o related manager `order.versions` só no que a função usa."""

    def __init__(self, versions: list[FakeVersion]) -> None:
        self._versions = versions

    def filter(self, **kwargs: object) -> "FakeVersions":
        return FakeVersions(
            [v for v in self._versions if v.source == kwargs.get("source", v.source)]
        )

    def exclude(self, **kwargs: object) -> "FakeVersions":
        return FakeVersions(
            [v for v in self._versions if v.external_version != kwargs.get("external_version")]
        )

    def order_by(self, *args: object) -> "FakeVersions":
        return FakeVersions(
            sorted(self._versions, key=lambda v: v.version_number, reverse=True)
        )

    def first(self) -> FakeVersion | None:
        return self._versions[0] if self._versions else None


@dataclass
class FakeOrder:
    versions: FakeVersions = field(default_factory=lambda: FakeVersions([]))
    cilia_budget_number: str = ""
    cilia_budget_version: str = ""


class NextCiliaTargetTest(SimpleTestCase):
    def test_usa_external_version_da_ultima_versao_cilia(self) -> None:
        order = FakeOrder(versions=FakeVersions([FakeVersion("905433.2")]))
        self.assertEqual(_next_cilia_target(order), ("905433", 3))

    def test_ignora_contador_interno_da_os(self) -> None:
        """version_number 7 com external_version .2 → sonda .3, não .8."""
        order = FakeOrder(
            versions=FakeVersions([FakeVersion("905433.2", version_number=7)])
        )
        self.assertEqual(_next_cilia_target(order), ("905433", 3))

    def test_versao_terminal_nao_e_sondada(self) -> None:
        for status in ("autorizado", "negado"):
            with self.subTest(status=status):
                order = FakeOrder(
                    versions=FakeVersions([FakeVersion("905433.2", status=status)])
                )
                self.assertIsNone(_next_cilia_target(order))

    def test_sem_versao_cilia_cai_para_os_campos_da_os(self) -> None:
        order = FakeOrder(cilia_budget_number="905433", cilia_budget_version="1")
        self.assertEqual(_next_cilia_target(order), ("905433", 2))

    def test_orcamento_conhecido_sem_versao_comeca_da_primeira(self) -> None:
        for valor in ("", "   ", "v2"):
            with self.subTest(valor=valor):
                order = FakeOrder(
                    cilia_budget_number="905433", cilia_budget_version=valor
                )
                self.assertEqual(_next_cilia_target(order), ("905433", 1))

    def test_sem_orcamento_conhecido_nao_sonda(self) -> None:
        self.assertIsNone(_next_cilia_target(FakeOrder()))
