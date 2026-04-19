"""
Paddock Solutions — Pricing Engine — BenchmarkService
Motor de Orçamentos (MO) — Sprint MO-8 (implementação real)

Implementação real substituindo o stub de MO-6.

ARMADILHA A7: benchmark é TETO, nunca alvo.
O preço final é sempre min(preco_calculado, teto) quando teto disponível.

ARMADILHA P2: benchmark is ceiling, never target — nunca deixar preço < custo
por causa de teto benchmark baixo. Verificação fica no motor (motor.py).

ARMADILHA P4: two-pass — amostras específicas por segmento/tamanho primeiro;
se < MINIMO, incorpora amostras genéricas (sem segmento/tamanho).
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from statistics import quantiles

from django.db.models import Q

logger = logging.getLogger(__name__)

JANELA_DIAS = 90
MINIMO_AMOSTRAS = 8
MINIMO_AMOSTRAS_ESPECIFICAS = 8  # se >= 8 específicas, ignora genéricas


class BenchmarkService:
    """Retorna o teto de preço baseado em benchmarks de mercado.

    Usa amostras da BenchmarkAmostra com two-pass por especificidade.
    """

    @staticmethod
    def p90_servico(
        empresa_id: str,
        servico_id: str,
        segmento_codigo: str,
        tamanho_codigo: str,
    ) -> Decimal | None:
        """p90 de preço de mercado para serviço por segmento + tamanho.

        Args:
            empresa_id: UUID str da Empresa (não usado diretamente — amostras são por tenant).
            servico_id: UUID str do ServicoCanonico.
            segmento_codigo: código do SegmentoVeicular.
            tamanho_codigo: código da CategoriaTamanho.

        Returns:
            Decimal com o p90 ou None se amostras insuficientes.
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra

        desde = date.today() - timedelta(days=JANELA_DIAS)
        base_qs = BenchmarkAmostra.objects.filter(
            tipo_item="servico",
            servico_canonico_id=servico_id,
            descartada=False,
            data_referencia__gte=desde,
        )

        # Two-pass: específicas primeiro
        qs_especificas = base_qs.filter(
            segmento__codigo=segmento_codigo,
            tamanho__codigo=tamanho_codigo,
        )
        valores_esp = list(qs_especificas.values_list("valor_praticado", flat=True))

        if len(valores_esp) >= MINIMO_AMOSTRAS_ESPECIFICAS:
            valores = valores_esp
        else:
            # Incorpora genéricas (segmento ou tamanho nulos)
            qs_geral = base_qs.filter(
                Q(segmento__codigo=segmento_codigo) | Q(segmento__isnull=True),
                Q(tamanho__codigo=tamanho_codigo) | Q(tamanho__isnull=True),
            )
            valores = list(qs_geral.values_list("valor_praticado", flat=True))

        if len(valores) < MINIMO_AMOSTRAS:
            return None

        valores_float = sorted(float(v) for v in valores)
        # quantiles(n=10) retorna 9 percentis: [p10, p20, ..., p90]
        p90 = quantiles(valores_float, n=10)[8]
        logger.debug(
            f"[benchmark] p90_servico servico={servico_id} segmento={segmento_codigo} "
            f"tamanho={tamanho_codigo} amostras={len(valores)} p90={p90:.2f}"
        )
        return Decimal(f"{p90:.2f}")

    @staticmethod
    def p90_peca(
        empresa_id: str,
        peca_id: str,
    ) -> Decimal | None:
        """p90 de valor de mercado para peça.

        Args:
            empresa_id: UUID str da Empresa.
            peca_id: UUID str da PecaCanonica.

        Returns:
            Decimal com o p90 ou None se amostras insuficientes.
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra

        desde = date.today() - timedelta(days=JANELA_DIAS)
        valores = list(
            BenchmarkAmostra.objects.filter(
                tipo_item="peca",
                peca_canonica_id=peca_id,
                descartada=False,
                data_referencia__gte=desde,
            ).values_list("valor_praticado", flat=True)
        )

        if len(valores) < MINIMO_AMOSTRAS:
            return None

        valores_float = sorted(float(v) for v in valores)
        p90 = quantiles(valores_float, n=10)[8]
        return Decimal(f"{p90:.2f}")

    @staticmethod
    def estatisticas_servico(
        servico_id: str,
        segmento_codigo: str,
        tamanho_codigo: str,
    ) -> dict:
        """Estatísticas completas para UI: p50, p90, min, max, count.

        Args:
            servico_id: UUID str do ServicoCanonico.
            segmento_codigo: código do SegmentoVeicular.
            tamanho_codigo: código da CategoriaTamanho.

        Returns:
            dict com p50, p90, minimo, maximo, count, janela_dias.
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra

        desde = date.today() - timedelta(days=JANELA_DIAS)
        valores = list(
            BenchmarkAmostra.objects.filter(
                tipo_item="servico",
                servico_canonico_id=servico_id,
                descartada=False,
                data_referencia__gte=desde,
            ).filter(
                Q(segmento__codigo=segmento_codigo) | Q(segmento__isnull=True),
                Q(tamanho__codigo=tamanho_codigo) | Q(tamanho__isnull=True),
            ).values_list("valor_praticado", flat=True)
        )

        if not valores:
            return {"count": 0, "p50": None, "p90": None, "minimo": None, "maximo": None}

        valores_float = sorted(float(v) for v in valores)
        n = len(valores_float)

        result: dict = {
            "count": n,
            "minimo": f"{min(valores_float):.2f}",
            "maximo": f"{max(valores_float):.2f}",
            "janela_dias": JANELA_DIAS,
        }

        if n >= 2:
            qs = quantiles(valores_float, n=10)
            result["p50"] = f"{qs[4]:.2f}"   # 5º decil
            result["p90"] = f"{qs[8]:.2f}"   # 9º decil
        else:
            result["p50"] = f"{valores_float[0]:.2f}"
            result["p90"] = f"{valores_float[0]:.2f}"

        return result
