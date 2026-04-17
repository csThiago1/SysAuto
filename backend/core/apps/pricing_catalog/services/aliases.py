"""
Paddock Solutions — Pricing Catalog — Serviço AliasMatcher
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Serviço de resolução de aliases para canônicos usando três estratégias em cascata:
  1. Match exato por texto_normalizado (O(1) via índice de banco).
  2. Fuzzy matching in-memory via rapidfuzz (OK para < 5k aliases).
  3. Busca semântica por embedding via pgvector cosine similarity (fallback).
"""
import logging
from dataclasses import dataclass
from typing import Literal

from rapidfuzz import fuzz, process

from apps.pricing_catalog.models import AliasMaterial, AliasPeca, AliasServico
from apps.pricing_catalog.models import MaterialCanonico, PecaCanonica, ServicoCanonico
from apps.pricing_catalog.utils.embeddings import embed_text
from apps.pricing_catalog.utils.text import normalizar_texto

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    """Resultado de um match de alias para um canônico."""

    canonico_id: str  # UUID (PK do canônico) como string
    score: float  # 0.0–100.0
    metodo: Literal["exato", "fuzzy", "embedding"]
    confianca: Literal["alta", "media", "baixa"]


class AliasMatcher:
    """
    Resolve texto livre para IDs de canônicos (serviço, peça ou material).

    Estratégias aplicadas em cascata — a primeira que retorna resultados
    interrompe a busca:
      1. Exato: filtra aliases por texto_normalizado == normalizar_texto(texto).
      2. Fuzzy: rapidfuzz.process.extract in-memory (adequado para < 5k aliases).
      3. Embedding: pgvector CosineDistance nos canônicos com embedding preenchido.

    Thresholds:
      - Fuzzy alto: score >= TAU_FUZZY_ALTO (92) → confiança "alta".
      - Fuzzy médio: 75 <= score < TAU_FUZZY_ALTO → confiança "media".
      - Fuzzy baixo: score < 75 → descartado.
      - Embedding alto: sim >= TAU_EMB_ALTO (0.90) → confiança "alta".
      - Embedding médio: TAU_EMB_MEDIO (0.75) <= sim < TAU_EMB_ALTO → confiança "media".
      - Embedding baixo: sim < TAU_EMB_MEDIO → descartado.
    """

    TAU_FUZZY_ALTO: int = 92
    TAU_EMB_ALTO: float = 0.90
    TAU_EMB_MEDIO: float = 0.75

    def match_servico(self, texto: str, top_k: int = 5) -> list[MatchResult]:
        """
        Resolve texto para ServicoCanonico.

        Args:
            texto: Denominação livre do serviço.
            top_k: Número máximo de resultados.

        Returns:
            Lista de MatchResult ordenada por score decrescente.
        """
        return self._match(texto, AliasServico, "canonico_id", ServicoCanonico, top_k)

    def match_peca(self, texto: str, top_k: int = 5) -> list[MatchResult]:
        """
        Resolve texto para PecaCanonica.

        Args:
            texto: Denominação livre da peça.
            top_k: Número máximo de resultados.

        Returns:
            Lista de MatchResult ordenada por score decrescente.
        """
        return self._match(texto, AliasPeca, "canonico_id", PecaCanonica, top_k)

    def match_material(self, texto: str, top_k: int = 5) -> list[MatchResult]:
        """
        Resolve texto para MaterialCanonico.

        Args:
            texto: Denominação livre do material/insumo.
            top_k: Número máximo de resultados.

        Returns:
            Lista de MatchResult ordenada por score decrescente.
        """
        return self._match(texto, AliasMaterial, "canonico_id", MaterialCanonico, top_k)

    def _match(
        self,
        texto: str,
        alias_model: type,
        fk_field: str,
        canon_model: type,
        top_k: int,
    ) -> list[MatchResult]:
        """
        Implementação comum das três estratégias de matching.

        Args:
            texto: Texto de entrada (não normalizado).
            alias_model: Classe do model de alias (AliasServico, AliasPeca, AliasMaterial).
            fk_field: Nome do campo FK que aponta para o canônico (ex: "canonico_id").
            canon_model: Classe do model canônico (ServicoCanonico, PecaCanonica, MaterialCanonico).
            top_k: Número máximo de resultados.

        Returns:
            Lista de MatchResult (pode ser vazia se nenhum match atingir thresholds).
        """
        normalizado = normalizar_texto(texto)

        # ── 1. Match exato ────────────────────────────────────────────────────
        exatos = list(
            alias_model.objects.filter(
                texto_normalizado=normalizado,
                is_active=True,
            )
            .select_related("canonico")
            .values_list(fk_field, flat=True)
            .distinct()[:top_k]
        )
        if exatos:
            return [MatchResult(str(cid), 100.0, "exato", "alta") for cid in exatos]

        # ── 2. Fuzzy in-memory (rapidfuzz) ────────────────────────────────────
        aliases_qs = list(
            alias_model.objects.filter(is_active=True).values_list(
                "texto_normalizado", fk_field
            )
        )
        if aliases_qs:
            textos = [a[0] for a in aliases_qs]
            ids = [a[1] for a in aliases_qs]
            resultados = process.extract(
                normalizado, textos, scorer=fuzz.token_sort_ratio, limit=top_k
            )
            seen: set[str] = set()
            fuzzy_results: list[MatchResult] = []
            for _text, score, idx in resultados:
                cid = str(ids[idx])
                if cid in seen:
                    continue
                seen.add(cid)
                confianca: Literal["alta", "media", "baixa"]
                if score >= self.TAU_FUZZY_ALTO:
                    confianca = "alta"
                elif score >= 75:
                    confianca = "media"
                else:
                    continue
                fuzzy_results.append(MatchResult(cid, float(score), "fuzzy", confianca))
            if fuzzy_results:
                return fuzzy_results

        # ── 3. Embedding — pgvector cosine similarity ─────────────────────────
        try:
            from pgvector.django import CosineDistance  # type: ignore[import-untyped]

            emb = embed_text(texto)
            canon_qs = canon_model.objects.filter(is_active=True, embedding__isnull=False)
            results: list[MatchResult] = []
            for obj in (
                canon_qs.annotate(dist=CosineDistance("embedding", emb)).order_by("dist")[:top_k]
            ):
                sim = 1.0 - float(obj.dist)
                if sim < self.TAU_EMB_MEDIO:
                    continue
                emb_confianca: Literal["alta", "media", "baixa"] = (
                    "alta" if sim >= self.TAU_EMB_ALTO else "media"
                )
                results.append(MatchResult(str(obj.pk), sim * 100, "embedding", emb_confianca))
            return results
        except Exception as exc:
            logger.error("Erro no match por embedding: %s", exc)
            return []
