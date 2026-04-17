"""
Paddock Solutions — Pricing Engine — CustoHoraService
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Calcula o custo real por hora de mão de obra para uma categoria,
integrando dados de RH com parâmetros complementares (encargos, benefícios).

Ordem de resolução:
  1. Dados reais de RH (Employee + Payslip fechado) + ParametroCustoHora
  2. CustoHoraFallback cadastrado manualmente pelo admin
  3. Raise CustoNaoDefinido
"""

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q

logger = logging.getLogger(__name__)


class CustoNaoDefinido(Exception):
    """Levantada quando nenhuma fonte de custo está disponível para a categoria."""


@dataclass
class CustoHora:
    """Resultado do cálculo de custo por hora para uma categoria.

    Attributes:
        valor: Custo por hora em R$, quantizado em 2 casas decimais.
        origem: Fonte do cálculo: "rh" (dados reais) ou "fallback" (manual).
        decomposicao: Dict de auditoria com todos os valores intermediários.
        calculado_em: Data em que o cálculo foi executado.
    """

    valor: Decimal
    origem: str
    decomposicao: dict
    calculado_em: date


def _default_parametros() -> object:
    """Cria instância de ParametroCustoHora com defaults sem persistir no banco.

    Usado quando nenhum ParametroCustoHora foi cadastrado para a empresa.
    Os defaults representam os encargos conservadores típicos (P1 de MO-3):
      - provisao_13_ferias: 13.89% (8.33% 13º + 5.56% férias proporcionais)
      - multa_fgts_rescisao: 3.20%
      - beneficios_por_funcionario: R$ 0 (sem benefícios cadastrados)
      - horas_produtivas_mes: 168h (8h × 21 dias)
    """
    from apps.pricing_engine.models import ParametroCustoHora

    p = ParametroCustoHora.__new__(ParametroCustoHora)
    p.id = None
    p.provisao_13_ferias = Decimal("0.1389")
    p.multa_fgts_rescisao = Decimal("0.0320")
    p.beneficios_por_funcionario = Decimal("0.00")
    p.horas_produtivas_mes = Decimal("168.00")
    return p


class CustoHoraService:
    """Calcula custo real por hora de mão de obra para uma categoria.

    Integra dados de RH (Employee + Payslip fechado) com ParametroCustoHora
    para compor o custo total por hora, incluindo encargos e benefícios.
    """

    @staticmethod
    def obter(
        categoria_codigo: str,
        data: date,
        empresa_id: str,
    ) -> CustoHora:
        """Retorna custo real por hora produtiva para a categoria.

        Ordem de resolução:
          1. RH + ParametroCustoHora → custo via dados reais de Employee/Payslip.
          2. CustoHoraFallback vigente cadastrado manualmente.
          3. Raise CustoNaoDefinido se nenhuma fonte disponível.

        Fórmula (caminho RH):
            bruto = Σ gross_pay (Payslip fechado no mês)
            com_13_ferias = bruto × (1 + provisao_13_ferias)
            com_fgts = com_13_ferias × (1 + multa_fgts_rescisao)
            com_beneficios = com_fgts + (beneficios_por_funcionario × qtd_funcionarios)
            horas_totais = horas_produtivas_mes × max(qtd_funcionarios, 1)
            valor = com_beneficios / horas_totais

        Args:
            categoria_codigo: Código da CategoriaMaoObra (ex: "funileiro").
            data: Data de referência. Mês de referência = 1º dia do mês de data.
            empresa_id: ID da Empresa (pricing_profile.Empresa). Obrigatório — P4.

        Returns:
            CustoHora com valor quantizado em 2 casas decimais.

        Raises:
            CustoNaoDefinido: Se nem RH nem fallback têm dados para categoria/data.
            CustoNaoDefinido: Se horas_totais = 0 (evita divisão por zero).
        """
        from apps.pricing_engine.models import CustoHoraFallback, ParametroCustoHora
        from apps.pricing_engine.services.rh_adapter import RHAdapter

        # ── 1. Tentar via dados reais de RH ──────────────────────────────────
        total_folha = RHAdapter.total_mensal_categoria(categoria_codigo, data, empresa_id)

        if total_folha is not None:
            # Busca parâmetros de encargos vigentes; usa defaults se nunca cadastrado
            params = (
                ParametroCustoHora.objects.filter(
                    empresa_id=empresa_id,
                    vigente_desde__lte=data,
                    is_active=True,
                )
                .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data))
                .order_by("-vigente_desde")
                .first()
            )

            if not params:
                logger.info(
                    "CustoHoraService: sem ParametroCustoHora para empresa=%s em %s — "
                    "usando defaults conservadores",
                    empresa_id,
                    data,
                )
                params = _default_parametros()

            bruto = total_folha

            # Aplica provisão de 13º e férias proporcionais
            com_13_ferias = bruto * (1 + params.provisao_13_ferias)

            # Aplica provisão de multa FGTS + rescisão
            com_fgts = com_13_ferias * (1 + params.multa_fgts_rescisao)

            # Soma benefícios mensais fixos por funcionário (VT, VA, plano de saúde)
            qtd = RHAdapter.qtd_funcionarios_categoria(categoria_codigo, data, empresa_id)
            com_beneficios = com_fgts + (params.beneficios_por_funcionario * qtd)

            # Horas totais = horas individuais × qtd de funcionários
            # max(qtd, 1) evita divisão por zero: se total_folha > 0 mas qtd=0,
            # é inconsistência de dados — distribuímos sobre 1h para não travar.
            horas_totais = params.horas_produtivas_mes * max(qtd, 1)

            if horas_totais == 0:
                raise CustoNaoDefinido(
                    f"Horas totais = 0 para categoria='{categoria_codigo}' "
                    f"empresa={empresa_id} em {data}. "
                    "Verifique ParametroCustoHora.horas_produtivas_mes."
                )

            valor = (com_beneficios / horas_totais).quantize(Decimal("0.01"), ROUND_HALF_UP)

            logger.debug(
                "CustoHoraService via RH: categoria=%s data=%s empresa=%s "
                "bruto=%s valor=%s qtd=%d",
                categoria_codigo,
                data,
                empresa_id,
                bruto,
                valor,
                qtd,
            )

            return CustoHora(
                valor=valor,
                origem="rh",
                decomposicao={
                    "bruto_folha": str(bruto),
                    "com_13_ferias": str(com_13_ferias.quantize(Decimal("0.01"), ROUND_HALF_UP)),
                    "com_fgts": str(com_fgts.quantize(Decimal("0.01"), ROUND_HALF_UP)),
                    "com_beneficios": str(com_beneficios.quantize(Decimal("0.01"), ROUND_HALF_UP)),
                    "horas_totais": str(horas_totais),
                    "qtd_funcionarios": qtd,
                    "params_id": str(params.id) if params.id else "default",
                    "provisao_13_ferias": str(params.provisao_13_ferias),
                    "multa_fgts_rescisao": str(params.multa_fgts_rescisao),
                    "beneficios_por_funcionario": str(params.beneficios_por_funcionario),
                    "horas_produtivas_mes": str(params.horas_produtivas_mes),
                },
                calculado_em=date.today(),
            )

        # ── 2. Tentar fallback manual ─────────────────────────────────────────
        fb = (
            CustoHoraFallback.objects.filter(
                empresa_id=empresa_id,
                categoria__codigo=categoria_codigo,
                vigente_desde__lte=data,
                is_active=True,
            )
            .filter(Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data))
            .select_related("categoria")
            .order_by("-vigente_desde")
            .first()
        )

        if fb:
            logger.debug(
                "CustoHoraService via fallback: categoria=%s data=%s empresa=%s "
                "valor=%s fallback_id=%s",
                categoria_codigo,
                data,
                empresa_id,
                fb.valor_hora,
                fb.id,
            )
            return CustoHora(
                valor=fb.valor_hora,
                origem="fallback",
                decomposicao={
                    "fallback_id": str(fb.id),
                    "motivo": fb.motivo,
                    "categoria_codigo": categoria_codigo,
                    "vigente_desde": str(fb.vigente_desde),
                },
                calculado_em=date.today(),
            )

        # ── 3. Nenhuma fonte disponível ───────────────────────────────────────
        raise CustoNaoDefinido(
            f"Categoria '{categoria_codigo}' não tem dado de RH nem fallback "
            f"em {data} (empresa={empresa_id}). "
            "Cadastre um CustoHoraFallback ou verifique os dados de Payslip no módulo RH."
        )
