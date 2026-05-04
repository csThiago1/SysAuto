"""Testes para PedidoCompraService + OrdemCompraService — requer Docker."""
import hashlib
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.purchasing.models import ItemOrdemCompra, OrdemCompra, PedidoCompra
from apps.purchasing.services import OrdemCompraService, PedidoCompraService
from apps.service_orders.models import ServiceOrder, ServiceOrderPart


def make_user(email: str = "purchasing-test@example.com") -> GlobalUser:
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    user, _ = GlobalUser.objects.get_or_create(
        email_hash=email_hash,
        defaults={"email": email, "name": "Purchasing Test"},
    )
    return user


def make_os(number: int = 8001) -> ServiceOrder:
    os, _ = ServiceOrder.objects.get_or_create(
        number=number,
        defaults={
            "customer_name": "Cliente Teste",
            "plate": "TST0001",
            "make": "VW",
            "model": "Gol",
            "color": "Branco",
            "vehicle_location": "Patio",
            "status": "open",
        },
    )
    return os


def make_part(
    os: ServiceOrder,
    description: str = "Farol Esq",
    unit_price: str = "580.00",
) -> ServiceOrderPart:
    return ServiceOrderPart.objects.create(
        service_order=os,
        description=description,
        unit_price=Decimal(unit_price),
        quantity=1,
        origem="compra",
        tipo_qualidade="genuina",
        status_peca="aguardando_cotacao",
    )


class TestPedidoCompraService(TenantTestCase):

    def test_solicitar_cria_pedido_e_atualiza_status(self) -> None:
        user = make_user()
        os = make_os()
        part = make_part(os)

        pedido = PedidoCompraService.solicitar(
            service_order_part_id=part.id,
            descricao="Farol Esq Gol G5",
            tipo_qualidade="genuina",
            quantidade=Decimal("1"),
            valor_cobrado_cliente=Decimal("580.00"),
            user_id=user.id,
        )

        self.assertEqual(pedido.status, "solicitado")
        self.assertEqual(pedido.service_order_id, os.id)
        part.refresh_from_db()
        self.assertEqual(part.status_peca, "aguardando_cotacao")
        self.assertIsNotNone(part.pedido_compra_id)

    def test_iniciar_cotacao_muda_status(self) -> None:
        user = make_user()
        os = make_os(8002)
        part = make_part(os, "Retrovisor")
        pedido = PedidoCompraService.solicitar(
            service_order_part_id=part.id,
            descricao="Retrovisor",
            tipo_qualidade="reposicao",
            quantidade=Decimal("1"),
            valor_cobrado_cliente=Decimal("320.00"),
            user_id=user.id,
        )

        result = PedidoCompraService.iniciar_cotacao(pedido.id, user.id)

        self.assertEqual(result.status, "em_cotacao")
        part.refresh_from_db()
        self.assertEqual(part.status_peca, "em_cotacao")


class TestOrdemCompraService(TenantTestCase):

    def test_criar_oc_gera_numero_sequencial(self) -> None:
        user = make_user()
        os = make_os(8003)

        oc = OrdemCompraService.criar_oc(os.id, user.id)

        self.assertTrue(oc.numero.startswith("OC-"))
        self.assertEqual(oc.status, "rascunho")

    def test_criar_oc_retorna_existente_se_rascunho(self) -> None:
        user = make_user()
        os = make_os(8004)
        oc1 = OrdemCompraService.criar_oc(os.id, user.id)
        oc2 = OrdemCompraService.criar_oc(os.id, user.id)
        self.assertEqual(oc1.id, oc2.id)

    def test_adicionar_item_computa_valor_total(self) -> None:
        user = make_user()
        os = make_os(8005)
        oc = OrdemCompraService.criar_oc(os.id, user.id)

        item = OrdemCompraService.adicionar_item(
            oc_id=oc.id,
            fornecedor_nome="Auto Pecas Teste",
            descricao="Parabrisa",
            tipo_qualidade="genuina",
            quantidade=Decimal("1"),
            valor_unitario=Decimal("780.00"),
        )

        self.assertEqual(item.valor_total, Decimal("780.00"))
        oc.refresh_from_db()
        self.assertEqual(oc.valor_total, Decimal("780.00"))

    def test_aprovar_oc_atualiza_pedidos_e_parts(self) -> None:
        user = make_user()
        os = make_os(8006)
        part = make_part(os, "Farol")
        pedido = PedidoCompraService.solicitar(
            service_order_part_id=part.id,
            descricao="Farol",
            tipo_qualidade="genuina",
            quantidade=Decimal("1"),
            valor_cobrado_cliente=Decimal("580.00"),
            user_id=user.id,
        )
        oc = OrdemCompraService.criar_oc(os.id, user.id)
        OrdemCompraService.adicionar_item(
            oc_id=oc.id,
            pedido_compra_id=pedido.id,
            fornecedor_nome="Fornecedor X",
            descricao="Farol",
            tipo_qualidade="genuina",
            quantidade=Decimal("1"),
            valor_unitario=Decimal("420.00"),
        )
        OrdemCompraService.enviar_para_aprovacao(oc.id, user.id)

        result = OrdemCompraService.aprovar(oc.id, user.id)

        self.assertEqual(result.status, "aprovada")
        pedido.refresh_from_db()
        self.assertEqual(pedido.status, "aprovado")
        part.refresh_from_db()
        self.assertEqual(part.status_peca, "comprada")
        # PC-6: custo_real NAO preenchido na aprovacao
        self.assertIsNone(part.custo_real)

    def test_rejeitar_oc_volta_pedidos_para_cotacao(self) -> None:
        user = make_user()
        os = make_os(8007)
        part = make_part(os, "Retrovisor")
        pedido = PedidoCompraService.solicitar(
            service_order_part_id=part.id,
            descricao="Retrovisor",
            tipo_qualidade="reposicao",
            quantidade=Decimal("1"),
            valor_cobrado_cliente=Decimal("320.00"),
            user_id=user.id,
        )
        oc = OrdemCompraService.criar_oc(os.id, user.id)
        OrdemCompraService.adicionar_item(
            oc_id=oc.id,
            pedido_compra_id=pedido.id,
            fornecedor_nome="Fornecedor Y",
            descricao="Retrovisor",
            tipo_qualidade="reposicao",
            quantidade=Decimal("1"),
            valor_unitario=Decimal("185.00"),
        )
        OrdemCompraService.enviar_para_aprovacao(oc.id, user.id)

        OrdemCompraService.rejeitar(oc.id, user.id, "Preco muito alto")

        oc.refresh_from_db()
        self.assertEqual(oc.status, "rejeitada")
        pedido.refresh_from_db()
        self.assertEqual(pedido.status, "em_cotacao")
        part.refresh_from_db()
        self.assertEqual(part.status_peca, "em_cotacao")

    def test_aprovar_oc_nao_pendente_levanta_erro(self) -> None:
        user = make_user()
        os = make_os(8008)
        oc = OrdemCompraService.criar_oc(os.id, user.id)
        # OC esta em rascunho, nao pendente
        with self.assertRaises(ValueError):
            OrdemCompraService.aprovar(oc.id, user.id)

    def test_criar_segunda_oc_mesma_os_levanta_erro_pc4(self) -> None:
        """PC-4: uma OC por OS."""
        user = make_user()
        os = make_os(8009)
        oc1 = OrdemCompraService.criar_oc(os.id, user.id)
        # Aprovar a primeira OC (precisa item + enviar)
        OrdemCompraService.adicionar_item(
            oc_id=oc1.id,
            fornecedor_nome="Forn",
            descricao="Peca",
            tipo_qualidade="genuina",
            quantidade=Decimal("1"),
            valor_unitario=Decimal("100.00"),
        )
        OrdemCompraService.enviar_para_aprovacao(oc1.id, user.id)
        OrdemCompraService.aprovar(oc1.id, user.id)

        # Tentar criar segunda OC — deve dar erro (primeira aprovada)
        with self.assertRaises(ValueError):
            OrdemCompraService.criar_oc(os.id, user.id)

    def test_remover_item_oc(self) -> None:
        user = make_user()
        os = make_os(8010)
        oc = OrdemCompraService.criar_oc(os.id, user.id)
        item = OrdemCompraService.adicionar_item(
            oc_id=oc.id,
            fornecedor_nome="Forn Z",
            descricao="Peca X",
            tipo_qualidade="similar",
            quantidade=Decimal("1"),
            valor_unitario=Decimal("300.00"),
        )

        OrdemCompraService.remover_item(item.id)

        item.refresh_from_db()
        self.assertFalse(item.is_active)
        oc.refresh_from_db()
        self.assertEqual(oc.valor_total, Decimal("0"))
