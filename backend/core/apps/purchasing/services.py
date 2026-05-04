"""
Paddock Solutions — Purchasing — Services
PedidoCompraService: solicitar, iniciar cotação, cancelar
OrdemCompraService: criar OC, adicionar item, enviar, aprovar, rejeitar, receber
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.purchasing.models import ItemOrdemCompra, OrdemCompra, PedidoCompra

logger = logging.getLogger(__name__)


class PedidoCompraService:
    """Operações sobre pedidos de compra."""

    @staticmethod
    @transaction.atomic
    def solicitar(
        *,
        service_order_part_id: UUID,
        descricao: str,
        codigo_referencia: str = "",
        tipo_qualidade: str,
        quantidade: Decimal,
        valor_cobrado_cliente: Decimal,
        observacoes: str = "",
        user_id: UUID,
    ) -> PedidoCompra:
        """Cria pedido de compra + atualiza status da peça na OS."""
        from apps.service_orders.models import ServiceOrderPart

        part = ServiceOrderPart.objects.select_for_update().get(
            pk=service_order_part_id, is_active=True,
        )
        pedido = PedidoCompra.objects.create(
            service_order=part.service_order,
            service_order_part=part,
            descricao=descricao,
            codigo_referencia=codigo_referencia,
            tipo_qualidade=tipo_qualidade,
            quantidade=quantidade,
            valor_cobrado_cliente=valor_cobrado_cliente,
            observacoes=observacoes,
            solicitado_por_id=user_id,
        )
        # Atualizar part
        ServiceOrderPart.objects.filter(pk=part.pk).update(
            pedido_compra=pedido,
            status_peca="aguardando_cotacao",
        )
        logger.info("Pedido de compra %s criado para OS part %s", pedido.pk, part.pk)
        return pedido

    @staticmethod
    def iniciar_cotacao(pedido_id: UUID, user_id: UUID) -> PedidoCompra:
        pedido = PedidoCompra.objects.get(pk=pedido_id, is_active=True)
        PedidoCompra.objects.filter(pk=pedido.pk).update(status="em_cotacao")
        # Atualizar peça na OS
        from apps.service_orders.models import ServiceOrderPart
        ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
            status_peca="em_cotacao",
        )
        pedido.refresh_from_db()
        return pedido

    @staticmethod
    @transaction.atomic
    def cancelar(pedido_id: UUID, user_id: UUID, motivo: str = "") -> None:
        pedido = PedidoCompra.objects.select_for_update().get(pk=pedido_id, is_active=True)
        PedidoCompra.objects.filter(pk=pedido.pk).update(status="cancelado")
        # Reverter peça na OS
        from apps.service_orders.models import ServiceOrderPart
        ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
            status_peca="manual",
            pedido_compra=None,
        )
        logger.info("Pedido %s cancelado por user %s: %s", pedido.pk, user_id, motivo)


class OrdemCompraService:
    """Operações sobre ordens de compra."""

    @staticmethod
    def _gerar_numero() -> str:
        """Gera número sequencial OC-{year}-{seq:04d}."""
        year = timezone.now().year
        prefix = f"OC-{year}-"
        last = (
            OrdemCompra.objects.filter(numero__startswith=prefix)
            .order_by("-numero")
            .values_list("numero", flat=True)
            .first()
        )
        if last:
            seq = int(last.split("-")[-1]) + 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    @staticmethod
    @transaction.atomic
    def criar_oc(service_order_id: UUID, user_id: UUID) -> OrdemCompra:
        """PC-4: uma OC por OS. Se já existe rascunho, retorna ela."""
        # PC-4: uma OC por OS — verifica QUALQUER status ativo
        existing = OrdemCompra.objects.filter(
            service_order_id=service_order_id,
            is_active=True,
        ).exclude(status__in=["rejeitada"]).first()
        if existing:
            if existing.status in ["rascunho", "pendente_aprovacao"]:
                return existing  # Retorna a existente para edição
            raise ValueError(
                f"OS já possui OC {existing.numero} ({existing.status}). "
                "Não é possível criar outra."
            )

        oc = OrdemCompra.objects.create(
            numero=OrdemCompraService._gerar_numero(),
            service_order_id=service_order_id,
            criado_por_id=user_id,
        )
        logger.info("OC %s criada para OS %s", oc.numero, service_order_id)
        return oc

    @staticmethod
    @transaction.atomic
    def adicionar_item(
        *,
        oc_id: UUID,
        pedido_compra_id: UUID | None = None,
        fornecedor_id: UUID | None = None,
        fornecedor_nome: str,
        fornecedor_cnpj: str = "",
        fornecedor_contato: str = "",
        descricao: str,
        codigo_referencia: str = "",
        tipo_qualidade: str,
        quantidade: Decimal,
        valor_unitario: Decimal,
        prazo_entrega: str = "",
        observacoes: str = "",
    ) -> ItemOrdemCompra:
        """Adiciona item à OC e atualiza pedido."""
        item = ItemOrdemCompra.objects.create(
            ordem_compra_id=oc_id,
            pedido_compra_id=pedido_compra_id,
            fornecedor_id=fornecedor_id,
            fornecedor_nome=fornecedor_nome,
            fornecedor_cnpj=fornecedor_cnpj,
            fornecedor_contato=fornecedor_contato,
            descricao=descricao,
            codigo_referencia=codigo_referencia,
            tipo_qualidade=tipo_qualidade,
            quantidade=quantidade,
            valor_unitario=valor_unitario,
            valor_total=quantidade * valor_unitario,
            prazo_entrega=prazo_entrega,
            observacoes=observacoes,
        )
        if pedido_compra_id:
            PedidoCompra.objects.filter(pk=pedido_compra_id).update(status="oc_pendente")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="aguardando_aprovacao",
            )
        return item

    @staticmethod
    @transaction.atomic
    def remover_item(item_id: UUID) -> None:
        """Remove item da OC e recomputa total."""
        item = ItemOrdemCompra.objects.get(pk=item_id, is_active=True)
        oc = item.ordem_compra
        # Reverter pedido se vinculado
        if item.pedido_compra_id:
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="em_cotacao")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=item.pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="em_cotacao",
            )
        ItemOrdemCompra.objects.filter(pk=item.pk).update(is_active=False)
        oc.recompute_total()
        logger.info("Item %s removido da OC %s", item_id, oc.numero)

    @staticmethod
    def enviar_para_aprovacao(oc_id: UUID, user_id: UUID) -> OrdemCompra:
        oc = OrdemCompra.objects.get(pk=oc_id, is_active=True)
        if oc.itens.filter(is_active=True).count() == 0:
            raise ValueError("OC sem itens não pode ser enviada para aprovação.")
        OrdemCompra.objects.filter(pk=oc.pk).update(status="pendente_aprovacao")
        oc.refresh_from_db()
        return oc

    @staticmethod
    @transaction.atomic
    def aprovar(oc_id: UUID, user_id: UUID) -> OrdemCompra:
        """PC-5: aprovação atômica — tudo ou nada."""
        oc = OrdemCompra.objects.select_for_update().get(pk=oc_id, is_active=True)
        if oc.status != "pendente_aprovacao":
            raise ValueError(f"OC {oc.numero} não está pendente de aprovação.")

        OrdemCompra.objects.filter(pk=oc.pk).update(
            status="aprovada",
            aprovado_por_id=user_id,
            aprovado_em=timezone.now(),
        )
        # Atualizar pedidos e peças
        for item in oc.itens.filter(is_active=True, pedido_compra__isnull=False):
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="aprovado")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=item.pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="comprada",
                # PC-6: custo_real NÃO preenchido aqui — só quando peça chega fisicamente
            )

        oc.refresh_from_db()
        logger.info("OC %s aprovada por user %s", oc.numero, user_id)
        return oc

    @staticmethod
    @transaction.atomic
    def rejeitar(oc_id: UUID, user_id: UUID, motivo: str) -> OrdemCompra:
        oc = OrdemCompra.objects.select_for_update().get(pk=oc_id, is_active=True)
        OrdemCompra.objects.filter(pk=oc.pk).update(
            status="rejeitada",
            rejeitado_por_id=user_id,
            motivo_rejeicao=motivo,
        )
        # Pedidos voltam a em_cotacao
        for item in oc.itens.filter(is_active=True, pedido_compra__isnull=False):
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="em_cotacao")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=item.pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="em_cotacao",
            )
        oc.refresh_from_db()
        logger.info("OC %s rejeitada por user %s: %s", oc.numero, user_id, motivo)
        return oc

    @staticmethod
    @transaction.atomic
    def registrar_recebimento_item(
        item_id: UUID,
        unidade_fisica_id: UUID,
        user_id: UUID,
    ) -> ItemOrdemCompra:
        """Quando peça chega: vincula UnidadeFisica à OS, bloqueia, atualiza custo real."""
        item = ItemOrdemCompra.objects.select_for_update().get(pk=item_id, is_active=True)
        from apps.inventory.models_physical import UnidadeFisica
        from apps.inventory.services.reserva import ReservaUnidadeService
        from apps.service_orders.models import ServiceOrderPart

        unidade = UnidadeFisica.objects.get(pk=unidade_fisica_id, is_active=True)

        # Bloquear no estoque para a OS
        oc = item.ordem_compra
        ReservaUnidadeService.reservar(
            peca_canonica_id=unidade.peca_canonica_id,
            quantidade=1,
            ordem_servico_id=str(oc.service_order_id),
            user_id=user_id,
        )

        # Atualizar peça na OS
        if item.pedido_compra:
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="recebido")
            ServiceOrderPart.objects.filter(
                pk=item.pedido_compra.service_order_part_id,
            ).update(
                status_peca="recebida",
                unidade_fisica=unidade,
                custo_real=unidade.valor_nf,
            )

        # Verificar se OC está concluída (todos recebidos)
        total_itens = oc.itens.filter(is_active=True).count()
        total_recebidos = oc.itens.filter(
            is_active=True,
            pedido_compra__status="recebido",
        ).count()
        if total_recebidos >= total_itens:
            OrdemCompra.objects.filter(pk=oc.pk).update(status="concluida")
        elif total_recebidos > 0:
            OrdemCompra.objects.filter(pk=oc.pk).update(status="parcial_recebida")

        item.refresh_from_db()
        return item
