"""
Paddock Solutions — Pricing Engine — CustoBaseService
Motor de Orçamentos (MO) — Sprint MO-5: Estoque Físico + NF-e Entrada

Expõe o custo base de peças e insumos para o motor de precificação (MO-6).

ARMADILHA A2: custo de peça usa max(valor_nf) incluindo unidades RESERVADAS.
Razão: se todas as unidades baratas foram reservadas, a próxima OS deve
cotar ao preço de reposição (o mais caro que sobrou).
"""
import logging
from decimal import Decimal

from django.db.models import Max, Sum

logger = logging.getLogger(__name__)


class CustoBaseIndisponivel(Exception):
    """Levantada quando não há estoque para calcular custo base."""


class CustoPecaService:
    """Custo base de uma peça canônica."""

    @staticmethod
    def custo_base(peca_canonica_id: str) -> Decimal:
        """
        Maior valor_nf entre unidades DISPONÍVEIS ou RESERVADAS.

        ARMADILHA A2: incluir reserved é intencional — garante que se todas
        as unidades baratas já foram reservadas, o preço da próxima OS reflita
        o custo real de reposição (o maior que restou em estoque/reserva).

        Args:
            peca_canonica_id: UUID da PecaCanonica.

        Returns:
            Decimal com o maior valor_nf.

        Raises:
            CustoBaseIndisponivel: se nenhuma unidade disponível/reservada.
        """
        from apps.inventory.models import UnidadeFisica

        agg = UnidadeFisica.objects.filter(
            peca_canonica_id=peca_canonica_id,
            # A2: incluir reserved intencionalmente
            status__in=["available", "reserved"],
        ).aggregate(maior=Max("valor_nf"))

        if agg["maior"] is None:
            raise CustoBaseIndisponivel(
                f"Peça {peca_canonica_id} sem unidades disponíveis ou reservadas."
            )
        return agg["maior"]

    @staticmethod
    def unidades_disponiveis(peca_canonica_id: str) -> int:
        """Conta unidades com status=available."""
        from apps.inventory.models import UnidadeFisica

        return UnidadeFisica.objects.filter(
            peca_canonica_id=peca_canonica_id,
            status="available",
        ).count()

    @staticmethod
    def decomposicao(peca_canonica_id: str) -> dict:
        """
        Retorna detalhamento completo para debug.
        GET /api/v1/pricing/debug/custo-peca/?peca_id=<uuid>
        """
        from apps.inventory.models import UnidadeFisica
        from apps.pricing_catalog.models import PecaCanonica

        try:
            peca = PecaCanonica.objects.get(pk=peca_canonica_id)
        except PecaCanonica.DoesNotExist:
            raise CustoBaseIndisponivel(f"PecaCanonica {peca_canonica_id} não encontrada.")

        unidades_qs = UnidadeFisica.objects.filter(
            peca_canonica_id=peca_canonica_id,
            status__in=["available", "reserved"],
        ).select_related("nfe_entrada", "ordem_servico").order_by("valor_nf")

        unidades = list(unidades_qs)
        if not unidades:
            raise CustoBaseIndisponivel(
                f"Peça {peca_canonica_id} sem unidades disponíveis ou reservadas."
            )

        custo = max(u.valor_nf for u in unidades)
        contagem: dict = {}
        for u in unidades:
            contagem[u.status] = contagem.get(u.status, 0) + 1

        return {
            "peca_id": str(peca_canonica_id),
            "nome": peca.nome,
            "custo_base": str(custo),
            "unidades_contagem": contagem,
            "detalhe_unidades": [
                {
                    "id": str(u.pk),
                    "valor_nf": str(u.valor_nf),
                    "status": u.status,
                    "nfe": u.nfe_entrada.numero if u.nfe_entrada_id else None,
                    "os": str(u.ordem_servico_id) if u.ordem_servico_id else None,
                }
                for u in unidades
            ],
        }


class CustoInsumoService:
    """Custo base de um material canônico (insumo)."""

    @staticmethod
    def custo_base(material_canonico_id: str) -> Decimal:
        """
        Maior valor_unitario_base entre lotes com saldo > 0.

        Args:
            material_canonico_id: UUID do MaterialCanonico.

        Returns:
            Decimal com o maior valor_unitario_base.

        Raises:
            CustoBaseIndisponivel: se nenhum lote com saldo positivo.
        """
        from apps.inventory.models import LoteInsumo

        agg = LoteInsumo.objects.filter(
            material_canonico_id=material_canonico_id,
            saldo__gt=0,
        ).aggregate(maior=Max("valor_unitario_base"))

        if agg["maior"] is None:
            raise CustoBaseIndisponivel(
                f"Material {material_canonico_id} sem lotes com saldo positivo."
            )
        return agg["maior"]

    @staticmethod
    def saldo_disponivel(material_canonico_id: str) -> Decimal:
        """Soma do saldo de todos os lotes com saldo > 0."""
        from apps.inventory.models import LoteInsumo

        agg = LoteInsumo.objects.filter(
            material_canonico_id=material_canonico_id,
            saldo__gt=0,
        ).aggregate(total=Sum("saldo"))
        return agg["total"] or Decimal("0")

    @staticmethod
    def decomposicao(material_canonico_id: str) -> dict:
        """
        Retorna detalhamento completo para debug.
        GET /api/v1/pricing/debug/custo-insumo/?material_id=<uuid>
        """
        from apps.inventory.models import LoteInsumo
        from apps.pricing_catalog.models import MaterialCanonico

        try:
            material = MaterialCanonico.objects.get(pk=material_canonico_id)
        except MaterialCanonico.DoesNotExist:
            raise CustoBaseIndisponivel(f"MaterialCanonico {material_canonico_id} não encontrado.")

        lotes = list(
            LoteInsumo.objects.filter(
                material_canonico_id=material_canonico_id,
                saldo__gt=0,
            ).order_by("created_at")
        )

        if not lotes:
            raise CustoBaseIndisponivel(
                f"Material {material_canonico_id} sem lotes com saldo positivo."
            )

        custo = max(l.valor_unitario_base for l in lotes)
        saldo_total = sum(l.saldo for l in lotes)

        return {
            "material_id": str(material_canonico_id),
            "nome": material.nome,
            "unidade_base": material.unidade_base,
            "custo_base": str(custo),
            "saldo_total": str(saldo_total),
            "lotes": [
                {
                    "id": str(l.pk),
                    "codigo_barras": l.codigo_barras,
                    "saldo": str(l.saldo),
                    "valor_unitario_base": str(l.valor_unitario_base),
                    "validade": l.validade.isoformat() if l.validade else None,
                    "criado_em": l.created_at.isoformat(),
                }
                for l in lotes
            ],
        }
