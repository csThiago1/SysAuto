"""
Paddock Solutions — Pricing Benchmark — Alias Feedback Service
Motor de Orçamentos (MO) — Sprint MO-8

Circuito fechado de aprendizado: aceitar match manual cria AliasServico/AliasPeca
e dispara re-embedding. Próximas amostras idênticas chegam pelo caminho exato.

Armadilhas:
- P6: re-embedding via Voyage é custoso — batchar aliases por canônico.
- P10: task Celery usa schema_context.
"""
import logging
from decimal import Decimal

from django.db import transaction

from apps.pricing_catalog.utils.text import normalizar_texto

logger = logging.getLogger(__name__)


class AliasFeedbackService:
    """Aceita ou descarta amostras de benchmark, alimentando o alias engine."""

    @staticmethod
    @transaction.atomic
    def aceitar_match(amostra_id: str, canonical_id: str, user_id: str) -> dict:
        """Aceita o match manual de uma amostra, criando alias e re-embeddando.

        Args:
            amostra_id: UUID da BenchmarkAmostra.
            canonical_id: UUID do ServicoCanonico ou PecaCanonica aceito.
            user_id: UUID do GlobalUser que está aceitando.

        Returns:
            dict com "alias_criado" (bool).
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra
        from apps.pricing_catalog.models import AliasServico, AliasPeca
        from apps.pricing_benchmark.tasks import task_reembed_alias

        amostra = BenchmarkAmostra.objects.get(id=amostra_id)
        alias_criado = False

        if amostra.tipo_item == "servico":
            _, alias_criado = AliasServico.objects.get_or_create(
                texto_normalizado=normalizar_texto(amostra.descricao_bruta),
                defaults={
                    "texto_original": amostra.descricao_bruta[:200],
                    "canonico_id": canonical_id,
                    "fonte": "benchmark_revisao",
                    "criado_por_id": user_id,
                },
            )
            amostra.servico_canonico_id = canonical_id
        else:
            _, alias_criado = AliasPeca.objects.get_or_create(
                texto_normalizado=normalizar_texto(amostra.descricao_bruta),
                defaults={
                    "texto_original": amostra.descricao_bruta[:200],
                    "canonico_id": canonical_id,
                    "fonte": "benchmark_revisao",
                    "criado_por_id": user_id,
                },
            )
            amostra.peca_canonica_id = canonical_id

        amostra.alias_match_confianca = Decimal("1.00")
        amostra.revisado = True
        amostra.revisado_por_id = user_id
        amostra.save(
            update_fields=[
                "servico_canonico",
                "peca_canonica",
                "alias_match_confianca",
                "revisado",
                "revisado_por",
            ]
        )

        # Dispara re-embedding — custoso, vai para Celery
        task_reembed_alias.delay(canonical_id, amostra.tipo_item)
        logger.info(
            f"[benchmark] alias aceito amostra={amostra_id} canonical={canonical_id} criado={alias_criado}"
        )
        return {"alias_criado": alias_criado}

    @staticmethod
    @transaction.atomic
    def descartar(amostra_id: str, motivo: str, user_id: str) -> None:
        """Descarta uma amostra do benchmark.

        Args:
            amostra_id: UUID da BenchmarkAmostra.
            motivo: Motivo do descarte (máx 200 chars).
            user_id: UUID do GlobalUser.
        """
        from apps.pricing_benchmark.models import BenchmarkAmostra

        BenchmarkAmostra.objects.filter(id=amostra_id).update(
            descartada=True,
            motivo_descarte=motivo[:200],
            revisado=True,
            revisado_por_id=user_id,
        )
        logger.info(f"[benchmark] amostra descartada id={amostra_id}")
