"""
Paddock Solutions — Pricing Engine — BenchmarkService (stub MO-8)
Motor de Orçamentos (MO) — Sprint MO-6

STUB — implementação real vem em MO-8 (Benchmark IA + seguradora).

ARMADILHA A7: benchmark é TETO, nunca alvo. O preço final é sempre
min(preco_calculado, teto) se teto disponível — não o teto em si.
"""
from decimal import Decimal


class BenchmarkService:
    """Retorna o teto de preço baseado em benchmarks de mercado.

    Stub até MO-8 — retorna None (sem teto disponível).
    O motor trata None como "sem teto aplicado" e usa o preço calculado.
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
            empresa_id: UUID str da Empresa.
            servico_id: UUID str do ServicoCanonico.
            segmento_codigo: código do SegmentoVeicular.
            tamanho_codigo: código da CategoriaTamanho.

        Returns:
            Decimal com o p90 ou None se sem amostras suficientes (MO-8).
        """
        return None  # implementação real vem em MO-8

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
            Decimal com o p90 ou None se sem amostras (MO-8).
        """
        return None  # implementação real vem em MO-8
