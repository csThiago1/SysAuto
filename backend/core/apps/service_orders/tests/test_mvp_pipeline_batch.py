"""Batch de 10 OS variadas ponta-a-ponta — validação pós-fix (2026-07-20).

Cobre cenários que o test_mvp_pipeline.py original não cobre: soft blocks
satisfeitos de verdade (sem force=True), pipeline de compras completo,
seguradora terceiro sem franquia, cancelamento, complemento particular,
checklist com status não-OK, e faturamento real via BillingService (o
caminho que expôs o bug do _has_nfce — NFS-e nunca satisfazia o hard block).
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.accounts_receivable.models import ReceivableOrigin
from apps.accounts_receivable.services import ReceivableDocumentService
from apps.authentication.models import GlobalUser
from apps.fiscal.models import FiscalDocument
from apps.insurers.models import Insurer
from apps.persons.models import Person, PersonRole, RolePessoa, TipoPessoa
from apps.purchasing.services import OrdemCompraService, PedidoCompraService
from apps.service_orders.billing import BillingService
from apps.service_orders.models import (
    ApontamentoHoras,
    ChecklistItem,
    ChecklistItemStatus,
    OSPhotoFolder,
    ServiceOrder,
    ServiceOrderLabor,
    ServiceOrderPart,
    ServiceOrderPhoto,
    ServiceOrderVersion,
)
from apps.service_orders.services import ServiceOrderService
from apps.signatures.models import Signature


class ServiceOrderBatch10Test(TenantTestCase):
    """10 OS variadas — cada test_* é uma OS independente, ponta-a-ponta."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = "Tenant DS Car Batch10"
        tenant.slug = "dscar_batch10"
        tenant.client_slug = "grupo-dscar_batch10"
        return tenant

    @classmethod
    def setup_domain(cls, domain):
        domain.domain = "batch10.paddock.solutions"
        domain.is_primary = True
        return domain

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create(
            email=f"batch10_{uuid.uuid4()}@paddock.solutions",
            name="Batch10 Tester",
        )
        self.tecnico = GlobalUser.objects.create(
            email=f"tecnico_{uuid.uuid4()}@paddock.solutions",
            name="Técnico Batch10",
        )
        self.customer = Person.objects.create(
            full_name="Cliente Batch10",
            person_kind=TipoPessoa.FISICA,
        )
        PersonRole.objects.create(person=self.customer, role=RolePessoa.CLIENTE)
        self.insurer = Insurer.objects.create(
            name=f"Seguradora Batch10 {uuid.uuid4()}",
            trade_name="Seguradora Batch10",
            code=f"B10_{uuid.uuid4().hex[:8]}",
            cnpj=f"{uuid.uuid4().int % 10**14:014d}",
        )

    # ─── Helpers (espelham test_mvp_pipeline.py) ────────────────────────────

    def _create_order(self, plate: str, **kwargs) -> ServiceOrder:
        data = {
            "customer_id": self.customer.pk,
            "customer_type": "private",
            "plate": plate,
            "make": "Honda",
            "model": "Civic",
            "year": 2023,
            "color": "Prata",
            "fuel_type": "Flex",
            "mileage_in": 5000,
        }
        data.update(kwargs)
        return ServiceOrderService.create(data=data, created_by_id=str(self.user.id))

    def _transition(self, order: ServiceOrder, status: str, *, force: bool = False, justification: str = "") -> ServiceOrder:
        return ServiceOrderService.transition(
            order_id=str(order.id),
            new_status=status,
            changed_by_id=str(self.user.id),
            force=force,
            justification=justification,
        )

    def _add_labor(self, order: ServiceOrder, *, payer: str = "customer", source_type: str = "manual", desc: str = "Mão de obra") -> ServiceOrderLabor:
        return ServiceOrderLabor.objects.create(
            service_order=order,
            description=desc,
            quantity=Decimal("1"),
            unit_price=Decimal("300.00"),
            payer=payer,
            source_type=source_type,
            billing_status="pending",
        )

    def _add_signature(self, order: ServiceOrder, document_type: str) -> None:
        Signature.objects.create(
            service_order=order,
            document_type=document_type,
            method="CANVAS_TABLET",
            signer_name="Cliente Batch10",
            signature_png_base64="data:image/png;base64,ZmFrZQ==",
            signature_hash="a" * 64,
        )

    def _add_photos(self, order: ServiceOrder, folder: str, count: int) -> None:
        for i in range(count):
            ServiceOrderPhoto.objects.create(
                service_order=order,
                folder=folder,
                s3_key=f"tests/batch10/{order.id}/{folder}/{i}.jpg",
                uploaded_by_id=self.user.id,
            )

    def _add_closed_timesheet(self, order: ServiceOrder, hours: str = "2.0") -> ApontamentoHoras:
        return ApontamentoHoras.objects.create(
            service_order=order,
            tecnico=self.tecnico,
            iniciado_em=timezone.now() - timedelta(hours=float(hours)),
            encerrado_em=timezone.now(),
            horas_apontadas=Decimal(hours),
            status="encerrado",
            created_by=self.user,
        )

    def _run_workshop_realistic(self, order: ServiceOrder) -> ServiceOrder:
        """Percorre repair→...→final_survey satisfazendo os soft blocks de verdade
        (apontamento fechado + foto de acompanhamento) em vez de force=True."""
        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing"):
            self._add_closed_timesheet(order)
            self._add_photos(order, OSPhotoFolder.REPAIR_PROGRESS, 1)
            order = self._transition(order, target, force=False)
        return order

    def _add_nfce(self, order: ServiceOrder) -> None:
        FiscalDocument.objects.create(
            service_order=order,
            destinatario=order.customer,
            document_type="nfce",
            status="authorized",
            number=f"{order.number}",
            total_value=Decimal("1500.00"),
        )

    def _add_receivable(self, order: ServiceOrder, *, origin: str = ReceivableOrigin.OS) -> None:
        today = timezone.now().date()
        ReceivableDocumentService.create_receivable(
            customer_id=str(order.customer_id),
            customer_name=order.customer_name,
            description=f"OS {order.number} Batch10",
            amount=Decimal("300.00"),
            due_date=today,
            competence_date=today,
            origin=origin,
            service_order_id=str(order.id),
            user=self.user,
        )

    # ─── 1. Private, fluxo 100% realista (sem force=True em nenhuma etapa) ──

    def test_01_private_soft_blocks_satisfeitos_de_verdade(self) -> None:
        order = self._create_order("BT01A11")
        self._add_photos(order, OSPhotoFolder.INITIAL_SURVEY, 12)
        order = self._transition(order, "initial_survey")
        order = self._transition(order, "budget")
        self._add_labor(order)
        order = self._transition(order, "waiting_auth")

        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized")

        order = self._run_workshop_realistic(order)
        ChecklistItem.objects.create(
            service_order=order, checklist_type="saida", category="bodywork",
            item_key="pintura_geral", status=ChecklistItemStatus.OK,
        )
        self._add_photos(order, OSPhotoFolder.FINAL_SURVEY, 12)
        order = self._transition(order, "final_survey")
        order = self._transition(order, "ready")

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5200},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order, origin=ReceivableOrigin.NFCE)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")

        self.assertEqual(order.status, "delivered")
        self.assertIsNotNone(order.delivered_at)

    # ─── 2. Private, peça origem estoque (bloqueada direto) ─────────────────

    def test_02_private_peca_origem_estoque(self) -> None:
        order = self._create_order("BT02A22")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        ServiceOrderPart.objects.create(
            service_order=order, description="Retrovisor esquerdo",
            quantity=Decimal("1"), unit_price=Decimal("280.00"),
            origem="estoque", status_peca="bloqueada", payer="customer",
            source_type="manual", billing_status="pending",
        )
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=True)
        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        order = self._transition(order, "waiting_parts")
        order = self._transition(order, "repair")
        for target in ("bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5100},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")

    # ─── 3. Private, pipeline de compras completo (solicitar→OC→aprovar→receber) ──

    def test_03_private_pipeline_compras_completo(self) -> None:
        order = self._create_order("BT03A33")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)

        part = ServiceOrderPart.objects.create(
            service_order=order, description="Farol dianteiro direito",
            quantity=Decimal("1"), unit_price=Decimal("450.00"),
            origem="compra", tipo_qualidade="genuina",
            status_peca="aguardando_cotacao", payer="customer",
            source_type="manual", billing_status="pending",
        )
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=True)
        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized")

        pedido = PedidoCompraService.solicitar(
            service_order_part_id=part.id, descricao=part.description,
            tipo_qualidade="genuina", quantidade=Decimal("1"),
            valor_cobrado_cliente=part.unit_price, user_id=self.user.id,
        )
        oc = OrdemCompraService.criar_oc(service_order_id=order.id, user_id=self.user.id)
        item = OrdemCompraService.adicionar_item(
            oc_id=oc.id, pedido_compra_id=pedido.id,
            fornecedor_nome="Fornecedor Batch10", descricao=part.description,
            tipo_qualidade="genuina", quantidade=Decimal("1"),
            valor_unitario=Decimal("380.00"),
        )
        OrdemCompraService.enviar_para_aprovacao(oc_id=oc.id, user_id=self.user.id)
        OrdemCompraService.aprovar(oc_id=oc.id, user_id=self.user.id)
        item, unidade = OrdemCompraService.receber_item_com_estoque(
            item_id=item.id, nivel_id=None, valor_nf=Decimal("380.00"),
            user_id=self.user.id, destino="os_direta",
        )
        part.refresh_from_db()
        self.assertEqual(part.status_peca, "recebida")

        order = self._transition(order, "waiting_parts")
        order = self._transition(order, "repair")
        for target in ("bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5050},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")

    # ─── 4. Seguradora, segurado com franquia ────────────────────────────────

    def test_04_insurer_segurado_com_franquia(self) -> None:
        order = self._create_order(
            "BT04A44", customer_type="insurer", insurer=self.insurer,
            insured_type="insured", casualty_number="SIN-B10-004",
            deductible_amount=Decimal("500.00"),
        )
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        ServiceOrderPhoto.objects.create(
            service_order=order, folder=OSPhotoFolder.BUDGETS,
            s3_key=f"tests/batch10/{order.id}/orcamento.pdf",
            uploaded_by_id=self.user.id,
        )
        order = self._transition(order, "waiting_auth", force=True)
        ServiceOrderPart.objects.create(
            service_order=order, description="Parachoque traseiro",
            quantity=Decimal("1"), unit_price=Decimal("900.00"),
            origem="seguradora", status_peca="recebida", payer="insurer",
            source_type="import", billing_status="pending",
        )
        self._add_labor(order, payer="insurer", source_type="import")
        ServiceOrderVersion.objects.create(
            service_order=order, version_number=1, source="cilia", status="autorizado",
        )
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized")

        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5300},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_receivable(order, origin=ReceivableOrigin.NFE)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")
        # Segurado com franquia: nenhuma NFC-e exigida (customer_type=insurer)
        self.assertFalse(order.fiscal_documents.filter(document_type="nfce").exists())

    # ─── 5. Seguradora, terceiro (sem franquia obrigatória) ─────────────────

    def test_05_insurer_terceiro_sem_franquia(self) -> None:
        order = self._create_order(
            "BT05A55", customer_type="insurer", insurer=self.insurer,
            insured_type="third", casualty_number="SIN-B10-005",
        )
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        ServiceOrderPhoto.objects.create(
            service_order=order, folder=OSPhotoFolder.BUDGETS,
            s3_key=f"tests/batch10/{order.id}/orcamento.pdf",
            uploaded_by_id=self.user.id,
        )
        order = self._transition(order, "waiting_auth", force=True)
        self._add_labor(order, payer="insurer", source_type="import")
        ServiceOrderVersion.objects.create(
            service_order=order, version_number=1, source="cilia", status="autorizado",
        )
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "authorized", "insured_type=third não deveria exigir franquia")

        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5400},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_receivable(order, origin=ReceivableOrigin.NFE)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")

    # ─── 6. Cancelamento na recepção ─────────────────────────────────────────

    def test_06_cancelar_na_recepcao(self) -> None:
        order = self._create_order("BT06A66")
        # sem justificativa → bloqueado
        with self.assertRaises(Exception):
            self._transition(order, "cancelled", justification="")
        order = self._transition(order, "cancelled", justification="Cliente desistiu antes da vistoria")
        self.assertEqual(order.status, "cancelled")

    # ─── 7. Cancelamento em waiting_auth (orçamento reprovado) ──────────────

    def test_07_cancelar_em_waiting_auth(self) -> None:
        order = self._create_order("BT07A77")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=True)
        order = self._transition(order, "cancelled", justification="Cliente reprovou o orçamento")
        self.assertEqual(order.status, "cancelled")

    # ─── 8. Complemento particular precisa ser faturado antes de entregar ──

    def test_08_complemento_particular_precisa_faturar(self) -> None:
        order = self._create_order("BT08A88")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=True)
        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()

        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        # Dano adicional encontrado durante o reparo — complemento particular
        self._add_labor(order, source_type="complement", desc="Reparo adicional encontrado")

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5150},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order, origin=ReceivableOrigin.NFCE)
        self._add_signature(order, "OS_DELIVERY")

        # Complemento não faturado ainda → hard block
        with self.assertRaises(Exception):
            self._transition(order, "delivered")

        result = BillingService.bill_complement(order, billed_by=self.user)
        self.assertTrue(result.get("billed"))

        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")

    # ─── 9. Checklist de saída com item "Atenção"/"Crítico" ainda libera ────

    def test_09_checklist_saida_com_status_nao_ok(self) -> None:
        order = self._create_order("BT09A99")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        self._add_labor(order)
        order = self._transition(order, "waiting_auth", force=True)
        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()

        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing", "final_survey"):
            order = self._transition(order, target, force=True)

        ChecklistItem.objects.create(
            service_order=order, checklist_type="saida", category="tires",
            item_key="desgaste", status=ChecklistItemStatus.ATTENTION,
        )
        ChecklistItem.objects.create(
            service_order=order, checklist_type="saida", category="mechanical",
            item_key="freios", status=ChecklistItemStatus.CRITICAL,
        )
        order = self._transition(order, "ready", force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5250},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()
        self._add_nfce(order)
        self._add_receivable(order)
        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")
        self.assertTrue(
            order.checklist_items.filter(checklist_type="saida", status="critical").exists()
        )

    # ─── 10. Faturamento realista via BillingService — regressão do bug NFC-e ──

    def test_10_faturamento_realista_gera_nfse_nao_nfce(self) -> None:
        """Regressão do bug: billing.py nunca emite 'nfce' (só nfse/nfe), mas o
        hard block de entrega antes só aceitava document_type='nfce' — nenhuma OS
        particular faturada pelo fluxo real do sistema conseguia ser entregue.
        Aqui NÃO uso _add_nfce (o atalho manual) — chamo BillingService.bill()
        de verdade e crio o documento com o tipo que o Focus realmente teria
        retornado (nfse, já que é 100% serviço), confirmando que a entrega
        aceita isso.
        """
        order = self._create_order("BT10A10")
        order = self._transition(order, "initial_survey", force=True)
        order = self._transition(order, "budget", force=True)
        self._add_labor(order, desc="Revisão completa")
        order = self._transition(order, "waiting_auth", force=True)
        self._add_signature(order, "BUDGET_APPROVAL")
        ServiceOrderService.update(
            order_id=str(order.id), data={"authorization_date": timezone.now()},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()

        for target in ("repair", "bodywork", "painting", "assembly", "polishing", "washing", "final_survey", "ready"):
            order = self._transition(order, target, force=True)

        ServiceOrderService.update(
            order_id=str(order.id), data={"mileage_out": 5060},
            updated_by_id=str(self.user.id),
        )
        order.refresh_from_db()

        preview = BillingService.preview(order)
        self.assertTrue(preview["can_bill"])
        result = BillingService.bill(order=order, items=preview["items"], user=self.user)
        # Sem token Focus válido em teste — fiscal falha, mas o receivable
        # é criado do mesmo jeito (comportamento real, já coberto por bill()).
        self.assertEqual(result["summary"]["receivables_count"], 1)

        # Simula o que o Focus teria retornado com um token válido: NFS-e
        # autorizada — NUNCA NFC-e, já que billing.py só emite nfse/nfe.
        FiscalDocument.objects.create(
            service_order=order, destinatario=order.customer,
            document_type="nfse", status="authorized",
            number=f"{order.number}", total_value=Decimal("300.00"),
        )
        self.assertFalse(order.fiscal_documents.filter(document_type="nfce").exists())
        self.assertTrue(order.fiscal_documents.filter(document_type="nfse", status="authorized").exists())

        self._add_signature(order, "OS_DELIVERY")
        order = self._transition(order, "delivered")
        self.assertEqual(order.status, "delivered")
