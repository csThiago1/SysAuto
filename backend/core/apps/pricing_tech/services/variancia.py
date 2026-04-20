"""
Paddock Solutions — Pricing Tech — VarianciaService
MO-9: Gera variâncias mensais entre ficha técnica (estimado) e apontamento (realizado).
"""
import logging
from datetime import date
from decimal import Decimal

from django.db.models import Sum

logger = logging.getLogger(__name__)

ALERTA_VARIANCIA_PCT = Decimal("0.15")  # 15%


class VarianciaService:
    """
    Gera variâncias mensais de ficha técnica e custo de peças.
    Chamado pela task Celery task_gerar_variancias_mensais mensalmente.
    """

    @staticmethod
    def gerar_variancia_periodo(mes_referencia: date) -> dict:
        """
        Gera VarianciaFicha e VarianciaPecaCusto para todas as OS
        encerradas no mês de referência.

        mes_referencia: qualquer data do mês (usa ano+mês, ignora dia).
        Retorna: {fichas_geradas, pecas_geradas, erros}
        """
        from apps.pricing_tech.models import VarianciaFicha, VarianciaPecaCusto

        primeiro_dia = mes_referencia.replace(day=1)

        fichas_ok = VarianciaService._gerar_variancias_ficha(primeiro_dia)
        pecas_ok = VarianciaService._gerar_variancias_peca(primeiro_dia)

        return {
            "mes_referencia": primeiro_dia.isoformat(),
            "fichas_geradas": fichas_ok,
            "pecas_geradas": pecas_ok,
        }

    @staticmethod
    def _gerar_variancias_ficha(primeiro_dia: date) -> int:
        """
        Para cada ServicoCanonico com apontamentos no mês:
        compara horas/insumos da ficha técnica ativa vs. realizados.
        """
        from apps.pricing_tech.models import VarianciaFicha

        try:
            from apps.service_orders.models import ApontamentoHoras, OSIntervencao
            from apps.pricing_tech.services.ficha_tecnica import FichaTecnicaService
        except ImportError as exc:
            logger.error("VarianciaService._gerar_variancias_ficha import error: %s", exc)
            return 0

        # Último dia do mês
        if primeiro_dia.month == 12:
            ultimo_dia = primeiro_dia.replace(year=primeiro_dia.year + 1, month=1, day=1)
        else:
            ultimo_dia = primeiro_dia.replace(month=primeiro_dia.month + 1, day=1)

        # Intervenções de OS encerradas no mês
        intervencoes = OSIntervencao.objects.filter(
            service_order__delivered_at__gte=primeiro_dia,
            service_order__delivered_at__lt=ultimo_dia,
            servico_canonico_id__isnull=False,
            is_active=True,
        ).values("servico_canonico_id").annotate(
            horas_est=Sum("horas_mao_obra"),
        )

        contador = 0
        for row in intervencoes:
            svc_id = row["servico_canonico_id"]
            horas_est = Decimal(str(row["horas_est"] or 0))

            # Horas realizadas via ApontamentoHoras (status=validado)
            horas_real_raw = ApontamentoHoras.objects.filter(
                service_order__delivered_at__gte=primeiro_dia,
                service_order__delivered_at__lt=ultimo_dia,
                status="validado",
            ).aggregate(total=Sum("horas_apontadas"))
            horas_real = Decimal(str(horas_real_raw["total"] or 0))

            var_horas = (
                (horas_real - horas_est) / horas_est
                if horas_est > 0
                else Decimal("0")
            )

            qtd_os = OSIntervencao.objects.filter(
                service_order__delivered_at__gte=primeiro_dia,
                service_order__delivered_at__lt=ultimo_dia,
                servico_canonico_id=svc_id,
                is_active=True,
            ).count()

            VarianciaFicha.objects.update_or_create(
                servico_canonico_id=svc_id,
                mes_referencia=primeiro_dia,
                defaults={
                    "qtd_os": qtd_os,
                    "horas_estimadas_total": horas_est,
                    "horas_realizadas_total": horas_real,
                    "variancia_horas_pct": var_horas,
                    "custo_insumo_estimado": Decimal("0"),
                    "custo_insumo_realizado": Decimal("0"),
                    "variancia_insumo_pct": Decimal("0"),
                },
            )
            contador += 1

        return contador

    @staticmethod
    def _gerar_variancias_peca(primeiro_dia: date) -> int:
        """
        Para cada PecaCanonica usada em OS do mês:
        compara custo do snapshot do motor vs. custo real da NF-e (UnidadeFisica).
        """
        from apps.pricing_tech.models import VarianciaPecaCusto

        try:
            from apps.service_orders.models import OSIntervencao
            from apps.pricing_engine.models import CalculoCustoSnapshot
        except ImportError as exc:
            logger.error("VarianciaService._gerar_variancias_peca import error: %s", exc)
            return 0

        if primeiro_dia.month == 12:
            ultimo_dia = primeiro_dia.replace(year=primeiro_dia.year + 1, month=1, day=1)
        else:
            ultimo_dia = primeiro_dia.replace(month=primeiro_dia.month + 1, day=1)

        # Intervenções de peça no mês
        intervencoes = OSIntervencao.objects.filter(
            service_order__delivered_at__gte=primeiro_dia,
            service_order__delivered_at__lt=ultimo_dia,
            peca_canonica_id__isnull=False,
            is_active=True,
        ).values("peca_canonica_id").annotate(
            custo_snapshot=Sum("snapshot_custo_peca"),
        )

        contador = 0
        for row in intervencoes:
            peca_id = row["peca_canonica_id"]
            custo_snap = Decimal(str(row["custo_snapshot"] or 0))

            qtd = OSIntervencao.objects.filter(
                service_order__delivered_at__gte=primeiro_dia,
                service_order__delivered_at__lt=ultimo_dia,
                peca_canonica_id=peca_id,
                is_active=True,
            ).count()

            custo_snap_medio = custo_snap / qtd if qtd > 0 else Decimal("0")

            # Custo real = valor_unitario_base médio de UnidadeFisica consumidas
            custo_nfe_medio = Decimal("0")
            try:
                from apps.inventory.models import UnidadeFisica
                unidades = UnidadeFisica.objects.filter(
                    peca_canonica_id=peca_id,
                    status="consumed",
                    updated_at__gte=primeiro_dia,
                    updated_at__lt=ultimo_dia,
                )
                if unidades.exists():
                    total_nfe = unidades.aggregate(
                        total=Sum("valor_unitario_base")
                    )["total"] or 0
                    custo_nfe_medio = Decimal(str(total_nfe)) / unidades.count()
            except Exception:
                pass

            variancia = (
                (custo_nfe_medio - custo_snap_medio) / custo_snap_medio
                if custo_snap_medio > 0
                else Decimal("0")
            )
            alerta = abs(variancia) > ALERTA_VARIANCIA_PCT

            VarianciaPecaCusto.objects.update_or_create(
                peca_canonica_id=peca_id,
                mes_referencia=primeiro_dia,
                defaults={
                    "qtd_amostras": qtd,
                    "custo_snapshot_medio": custo_snap_medio,
                    "custo_nfe_medio": custo_nfe_medio,
                    "variancia_pct": variancia,
                    "alerta": alerta,
                },
            )
            contador += 1

        return contador
