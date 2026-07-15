"""Testes da listagem global de apontamentos (tela mobile de apontamento)."""
import hashlib
from datetime import timedelta

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.persons.models import Person, PersonRole
from apps.service_orders.models import ServiceOrder, ServiceOrderStatus
from apps.service_orders.models.capacity import ApontamentoHoras


class ApontamentoGlobalListTest(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        email = "gestor@dscar.com"
        self.user = GlobalUser.objects.create_user(
            email=email,
            email_hash=hashlib.sha256(email.encode()).hexdigest(),
            password="x",
            role="MANAGER",
        )
        tec_email = "tecnico@dscar.com"
        self.tecnico = GlobalUser.objects.create_user(
            email=tec_email,
            email_hash=hashlib.sha256(tec_email.encode()).hexdigest(),
            password="x",
        )
        person = Person.objects.create(person_kind="PF", full_name="Cliente Apto")
        PersonRole.objects.create(person=person, role="CLIENT")
        self.order = ServiceOrder.objects.create(
            number=9902,
            plate="APT1O23",
            model="Corolla Cross",
            customer=person,
            customer_name=person.full_name,
            customer_type="private",
            status=ServiceOrderStatus.REPAIR,
            created_by=self.user,
        )
        now = timezone.now()
        self.aberto = ApontamentoHoras.objects.create(
            service_order=self.order, tecnico=self.tecnico,
            iniciado_em=now, status="iniciado",
        )
        self.ontem = ApontamentoHoras.objects.create(
            service_order=self.order, tecnico=self.tecnico,
            iniciado_em=now - timedelta(days=2),
            encerrado_em=now - timedelta(days=2) + timedelta(hours=1),
            horas_apontadas=1, status="encerrado",
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def test_lista_global_inclui_snapshot_da_os(self) -> None:
        resp = self.client.get("/api/v1/service-orders/apontamentos/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["os_numero"] == 9902
        assert data[0]["os_plate"] == "APT1O23"
        assert data[0]["os_model"] == "Corolla Cross"

    def test_filtro_status_iniciado_reidrata_timer(self) -> None:
        resp = self.client.get(
            f"/api/v1/service-orders/apontamentos/?tecnico={self.tecnico.pk}&status=iniciado"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert [a["id"] for a in data] == [str(self.aberto.pk)]

    def test_filtro_hoje_exclui_antigos(self) -> None:
        resp = self.client.get("/api/v1/service-orders/apontamentos/?hoje=1")
        assert resp.status_code == 200
        data = resp.json()
        assert [a["id"] for a in data] == [str(self.aberto.pk)]
