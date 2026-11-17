"""Cruzamento do checklist de entrada com o orçamento ativo da OS."""

import hashlib
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.cilia.dtos import ParsedBudget, ParsedItemDTO
from apps.cilia.models import ImportAttempt
from apps.cilia.services import create_version_from_parsed
from apps.documents.models import DocumentGeneration
from apps.followups.models import FollowUp
from apps.service_orders.checklist_constants import EXTERIOR_STOPS
from apps.service_orders.models import (
    ChecklistDamage,
    EntryChecklist,
    ServiceOrder,
    ServiceOrderPhoto,
    ServiceOrderStatus,
    ServiceOrderVersion,
    ServiceOrderVersionItem,
)
from apps.service_orders.services.budget_match import run_budget_match
from apps.service_orders.tasks import task_run_budget_match
from apps.service_orders.tests.test_checklist_finalize import IN_MEMORY_STORAGE, SNAPSHOTS


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class BudgetMatchTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "budget-match@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9971,
            plate="CRZ0A11",
            customer_name="Cliente Cruzamento",
            customer_type="insurer",
            status=ServiceOrderStatus.RECEPTION,
            consultant=self.user,
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})
        self.base = f"/api/v1/service-orders/{self.order.id}/checklist/budget-match/"

    def _damage(self, number: int, panel_key: str) -> ChecklistDamage:
        return ChecklistDamage.objects.create(
            service_order=self.order,
            number=number,
            panel_key=panel_key,
            damage_type="amassado",
            severity="moderada",
            relation="sinistro",
        )

    def _version(self, *descriptions: tuple[str, str]) -> list[ServiceOrderVersionItem]:
        version = ServiceOrderVersion.objects.create(
            service_order=self.order, version_number=1, source="cilia"
        )
        return [
            ServiceOrderVersionItem.objects.create(
                version=version,
                description=description,
                item_type=item_type,
                unit_price=Decimal("100"),
                quantity=Decimal("1"),
                net_price=Decimal("100"),
            )
            for description, item_type in descriptions
        ]

    def test_private_os_all_sem_orcamento(self) -> None:
        ServiceOrder.objects.filter(pk=self.order.pk).update(customer_type="private")
        self.order.refresh_from_db()
        self._version(("PORTA DIANTEIRA ESQ", "PART"))
        damage = self._damage(1, "porta_diant_e")
        ChecklistDamage.objects.filter(pk=damage.pk).update(
            budget_match="no_orcamento", matched_budget_items=[1]
        )
        self._damage(2, "capo")

        summary = run_budget_match(self.order)

        assert summary.inside == 0
        assert summary.outside == []
        assert set(
            ChecklistDamage.objects.filter(service_order=self.order).values_list(
                "budget_match", flat=True
            )
        ) == {"sem_orcamento"}
        damage.refresh_from_db()
        assert damage.matched_budget_items == []
        assert FollowUp.objects.count() == 0

    def test_insurer_inside_and_outside(self) -> None:
        (door,) = self._version(("PORTA DIANTEIRA ESQ", "PART"))
        self._damage(1, "porta_diant_e")
        self._damage(2, "capo")

        response = self.client.post(self.base, format="json")

        assert response.status_code == 200, response.content
        assert response.json() == {"inside": 1, "outside": ["Capô"], "unmapped": []}
        porta = ChecklistDamage.objects.get(service_order=self.order, panel_key="porta_diant_e")
        capo = ChecklistDamage.objects.get(service_order=self.order, panel_key="capo")
        assert porta.budget_match == "no_orcamento"
        assert porta.matched_budget_items == [door.id]
        assert capo.budget_match == "fora_do_orcamento"
        assert capo.matched_budget_items == []
        followup = FollowUp.objects.get(service_order=self.order)
        assert "Capô" in followup.notes

    def test_unmapped_items_reported(self) -> None:
        _, labor, _fee = self._version(
            ("PORTA DIANTEIRA ESQ", "PART"), ("MAO DE OBRA", "SERVICE"), ("TAXA", "FEE")
        )
        self._damage(1, "porta_diant_e")

        summary = run_budget_match(self.order)

        # FEE não é peça nem serviço: fica fora do cruzamento e da lista de não mapeados.
        assert summary.unmapped == [{"item_id": labor.id, "description": "MAO DE OBRA"}]

    def test_manual_rule_rematches(self) -> None:
        (tampa,) = self._version(("TAMPA COMPARTIMENTO", "PART"))
        self._damage(1, "tampa_tras")
        run_budget_match(self.order)
        damage = ChecklistDamage.objects.get(service_order=self.order)
        assert damage.budget_match == "fora_do_orcamento"

        response = self.client.post(
            "/api/v1/service-orders/checklist/panel-rules/",
            {
                "pattern": "Tampa compartimento",
                "panel_keys": ["tampa_tras"],
                "service_order_id": str(self.order.id),
            },
            format="json",
        )

        assert response.status_code == 201, response.content
        assert response.json()["pattern"] == "TAMPA COMPARTIMENTO"
        assert response.json()["source"] == "manual"
        damage.refresh_from_db()
        assert damage.budget_match == "no_orcamento"
        assert damage.matched_budget_items == [tampa.id]

    def test_panel_rules_require_admin(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})
        response = self.client.get("/api/v1/service-orders/checklist/panel-rules/")
        assert response.status_code == 403, response.content

    def test_panel_rules_reject_unknown_panel(self) -> None:
        response = self.client.post(
            "/api/v1/service-orders/checklist/panel-rules/",
            {"pattern": "X", "panel_keys": ["nao_existe"]},
            format="json",
        )
        assert response.status_code == 400, response.content

    def test_report_does_not_touch_signed_pdf(self) -> None:
        self._version(("PORTA DIANTEIRA ESQ", "PART"), ("MAO DE OBRA", "SERVICE"))
        damage = self._damage(1, "porta_diant_e")
        photo = ServiceOrderPhoto.objects.create(
            service_order=self.order,
            folder="checklist_entrada",
            checklist_type="entrada",
            s3_key="service_orders/x/checklist_entrada/porta.jpg",
            uploaded_by_id=self.user.id,
        )
        damage.photos.add(photo)
        EntryChecklist.objects.create(
            service_order=self.order,
            body_type="sedan",
            stops_done={stop: "sem_dano" for stop in EXTERIOR_STOPS},
        )
        finalize = self.client.post(
            f"/api/v1/service-orders/{self.order.id}/checklist/entrada/finalize/",
            {"snapshots": SNAPSHOTS},
            format="json",
        )
        assert finalize.status_code == 200, finalize.content
        # Finalizar roda o cruzamento.
        damage.refresh_from_db()
        assert damage.budget_match == "no_orcamento"
        checklist = EntryChecklist.objects.get(service_order=self.order)
        signed_sha, signed_pdf = checklist.pdf_sha256, checklist.pdf_id

        response = self.client.post(f"{self.base}report/", format="json")

        assert response.status_code == 200, response.content
        doc = DocumentGeneration.objects.get(document_type="checklist_cruzamento")
        assert response.json() == {"pdf_url": f"/api/v1/documents/{doc.pk}/download/"}
        assert doc.data_snapshot["damages"][0]["items"] == ["PORTA DIANTEIRA ESQ"]
        assert doc.data_snapshot["unmapped"] == ["MAO DE OBRA"]
        checklist.refresh_from_db()
        assert checklist.pdf_sha256 == signed_sha
        assert checklist.pdf_id == signed_pdf

    def test_generic_generate_endpoint_rejects_cruzamento(self) -> None:
        response = self.client.post(
            f"/api/v1/documents/os/{self.order.id}/generate/",
            {"document_type": "checklist_cruzamento", "data": {"damages": []}},
            format="json",
        )
        assert response.status_code == 400, response.content
        assert not DocumentGeneration.objects.filter(document_type="checklist_cruzamento").exists()

    def test_import_hook_enqueues_match(self) -> None:
        damage = self._damage(1, "porta_diant_e")
        parsed = ParsedBudget(
            source="cilia",
            raw_hash="d" * 64,
            items=[
                ParsedItemDTO(
                    description="PORTA DIANTEIRA ESQ",
                    item_type="PART",
                    quantity=Decimal("1"),
                    unit_price=Decimal("100"),
                    net_price=Decimal("100"),
                )
            ],
        )
        attempt = ImportAttempt.objects.create(source="cilia", trigger="user_requested")

        # O app Celery não lê CELERY_TASK_ALWAYS_EAGER (config/celery.py não é carregado no
        # boot): o delay roda a task em linha para provar o hook de ponta a ponta.
        with mock.patch.object(
            task_run_budget_match, "delay", side_effect=task_run_budget_match
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                result = create_version_from_parsed(
                    order=self.order, parsed=parsed, attempt=attempt, applied_by="Sistema"
                )

        assert result.action == "applied"
        delay.assert_called_once_with(str(self.order.id), self.tenant.schema_name)
        damage.refresh_from_db()
        assert damage.budget_match == "no_orcamento"
