"""
Paddock Solutions — Service Orders — CapacidadeService
MO-9: Cálculo de horas disponíveis, comprometidas e utilização por categoria.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum

logger = logging.getLogger(__name__)


class CapacidadeService:
    """
    Calcula disponibilidade de capacidade técnica por categoria de mão de obra.

    Fórmula:
      horas_disponíveis = Σ(horas_dia * dias_úteis_sem_bloqueio)  # por técnico ativo
      horas_comprometidas = Σ(horas_mao_obra dos OSIntervencao em andamento)
      utilizacao = horas_comprometidas / horas_disponíveis
    """

    @staticmethod
    def utilizacao(
        empresa_id: str,
        categoria_mao_obra_id: str,
        data_inicio: date,
        data_fim: date,
    ) -> dict:
        """
        Retorna dict com: disponíveis, comprometidas, utilizacao (0-1), técnicos.
        """
        from apps.service_orders.models import (
            BloqueioCapacidade,
            CapacidadeTecnico,
            OSIntervencao,
        )

        capacidades = CapacidadeTecnico.objects.filter(
            categoria_mao_obra_id=categoria_mao_obra_id,
            vigente_desde__lte=data_fim,
        ).filter(
            Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=data_inicio)
        ).select_related("tecnico")

        horas_disponiveis = Decimal("0")
        tecnicos: list[str] = []

        total_days = (data_fim - data_inicio).days + 1
        all_days = [data_inicio + timedelta(days=i) for i in range(total_days)]

        for cap in capacidades:
            tecnico_id = str(cap.tecnico_id)
            if tecnico_id not in tecnicos:
                tecnicos.append(tecnico_id)

            # Dias bloqueados deste técnico no período
            bloqueios = BloqueioCapacidade.objects.filter(
                tecnico_id=cap.tecnico_id,
                is_active=True,
                data_inicio__lte=data_fim,
                data_fim__gte=data_inicio,
            )
            dias_bloqueados: set[date] = set()
            for blq in bloqueios:
                cur = max(blq.data_inicio, data_inicio)
                while cur <= min(blq.data_fim, data_fim):
                    dias_bloqueados.add(cur)
                    cur += timedelta(days=1)

            dias_trabalho = cap.dias_semana or [1, 2, 3, 4, 5]
            for d in all_days:
                if d.isoweekday() in dias_trabalho and d not in dias_bloqueados:
                    horas_disponiveis += cap.horas_dia_util

        # Horas comprometidas = horas_mao_obra das intervenções ativas no período
        horas_comprometidas_raw = (
            OSIntervencao.objects.filter(
                service_order__empresa_id=empresa_id,
                servico_canonico_id__isnull=False,
            )
            .filter(is_active=True)
            .aggregate(total=Sum("horas_mao_obra"))
        )
        horas_comprometidas = Decimal(
            str(horas_comprometidas_raw["total"] or 0)
        )

        utilizacao = (
            horas_comprometidas / horas_disponiveis
            if horas_disponiveis > 0
            else Decimal("0")
        )

        return {
            "categoria_mao_obra_id": categoria_mao_obra_id,
            "periodo_inicio": data_inicio.isoformat(),
            "periodo_fim": data_fim.isoformat(),
            "horas_disponiveis": float(horas_disponiveis),
            "horas_comprometidas": float(horas_comprometidas),
            "utilizacao": float(min(utilizacao, Decimal("1"))),
            "tecnicos": tecnicos,
        }

    @staticmethod
    def proxima_data_disponivel(
        categoria_mao_obra_id: str,
        horas_necessarias: Decimal,
        a_partir_de: date | None = None,
    ) -> date | None:
        """
        Retorna a primeira data futura com horas suficientes disponíveis para
        a categoria, considerando bloqueios e dias de trabalho configurados.
        Retorna None se não houver técnicos configurados.
        """
        from apps.service_orders.models import (
            BloqueioCapacidade,
            CapacidadeTecnico,
        )

        inicio = a_partir_de or date.today()

        capacidades = CapacidadeTecnico.objects.filter(
            categoria_mao_obra_id=categoria_mao_obra_id,
            vigente_desde__lte=inicio + timedelta(days=90),
        ).filter(
            Q(vigente_ate__isnull=True) | Q(vigente_ate__gte=inicio)
        )

        if not capacidades.exists():
            return None

        # Verifica até 90 dias à frente
        for offset in range(90):
            dia = inicio + timedelta(days=offset)
            horas_dia = Decimal("0")

            for cap in capacidades:
                if dia.isoweekday() not in (cap.dias_semana or [1, 2, 3, 4, 5]):
                    continue
                if cap.vigente_desde > dia:
                    continue
                if cap.vigente_ate and cap.vigente_ate < dia:
                    continue

                bloqueado = BloqueioCapacidade.objects.filter(
                    tecnico_id=cap.tecnico_id,
                    is_active=True,
                    data_inicio__lte=dia,
                    data_fim__gte=dia,
                ).exists()

                if not bloqueado:
                    horas_dia += cap.horas_dia_util

            if horas_dia >= horas_necessarias:
                return dia

        return None

    @staticmethod
    def heatmap_semana(
        empresa_id: str,
        semana_inicio: date,
    ) -> list[dict]:
        """
        Retorna lista de 7 itens (dom–sáb) com: data, categorias, utilizacao_geral.
        Usado pelo widget de heatmap no dashboard.
        """
        from apps.service_orders.models import CapacidadeTecnico

        semana_fim = semana_inicio + timedelta(days=6)
        categorias_ids = list(
            CapacidadeTecnico.objects.values_list(
                "categoria_mao_obra_id", flat=True
            ).distinct()
        )

        resultado: list[dict] = []
        for offset in range(7):
            dia = semana_inicio + timedelta(days=offset)
            dias_util: list[dict] = []

            for cat_id in categorias_ids:
                util = CapacidadeService.utilizacao(
                    empresa_id=empresa_id,
                    categoria_mao_obra_id=str(cat_id),
                    data_inicio=dia,
                    data_fim=dia,
                )
                dias_util.append(
                    {
                        "categoria_id": str(cat_id),
                        "utilizacao": util["utilizacao"],
                    }
                )

            utilizacao_geral = (
                sum(c["utilizacao"] for c in dias_util) / len(dias_util)
                if dias_util
                else 0.0
            )
            resultado.append(
                {
                    "data": dia.isoformat(),
                    "categorias": dias_util,
                    "utilizacao_geral": round(utilizacao_geral, 4),
                }
            )

        return resultado
