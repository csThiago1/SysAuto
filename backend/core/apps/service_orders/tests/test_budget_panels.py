"""Dicionário de peças do orçamento — normalização, casamento de regra e seed."""

from django.test import SimpleTestCase
from django_tenants.test.cases import TenantTestCase

from apps.service_orders.checklist_constants import PANEL_KEYS
from apps.service_orders.models import BudgetPanelRule
from apps.service_orders.services.budget_panels import (
    normalize_description,
    panels_for_description,
    seed_rules,
)


class BudgetPanelsTest(SimpleTestCase):
    def setUp(self) -> None:
        self.rules = seed_rules()

    def test_normalize_variants(self) -> None:
        self.assertEqual(normalize_description("PARA-CHOQUE DIANT."), "PARACHOQUE DIANTEIRO")
        self.assertEqual(normalize_description("Parachoque dianteiro"), "PARACHOQUE DIANTEIRO")

    def test_door_gender_and_abbrev(self) -> None:
        self.assertEqual(
            panels_for_description("PORTA DIANTEIRA ESQ", self.rules), ["porta_diant_e"]
        )

    def test_more_specific_rule_wins(self) -> None:
        rules = [("PORTA", ["x"]), ("PORTA DIANTEIRO ESQUERDO", ["porta_diant_e"])]
        self.assertEqual(panels_for_description("Porta diant. esq.", rules), ["porta_diant_e"])

    def test_tie_unites_panels(self) -> None:
        rules = [("FAROL", ["farol_e"]), ("LANTERNA", ["lanterna_e"])]
        self.assertEqual(panels_for_description("FAROL LANTERNA", rules), ["farol_e", "lanterna_e"])

    def test_two_parts_in_one_description_keep_both(self) -> None:
        self.assertCountEqual(
            panels_for_description("SOLEIRA PORTA TRAS ESQ", self.rules),
            ["porta_tras_e", "soleira_e"],
        )
        self.assertCountEqual(
            panels_for_description("PARACHOQUE DIANT GRADE", self.rules),
            ["parachoque_diant", "grade"],
        )

    def test_fog_light_is_not_headlight(self) -> None:
        self.assertEqual(panels_for_description("FAROL DE MILHA LE", self.rules), [])
        self.assertEqual(panels_for_description("FAROL MILHA LD", self.rules), [])

    def test_unknown_returns_empty(self) -> None:
        self.assertEqual(panels_for_description("MAO DE OBRA FUNILARIA", self.rules), [])


class BudgetPanelSeedTest(TenantTestCase):
    def test_seed_covers_every_panel(self) -> None:
        seeded = {
            key
            for keys in BudgetPanelRule.objects.filter(source="seed").values_list(
                "panel_keys", flat=True
            )
            for key in keys
        }
        self.assertEqual(set(PANEL_KEYS) - seeded, set())
