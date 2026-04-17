"""
Paddock Solutions — Pricing Catalog — Utilitários de Embeddings
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Helper para geração de embeddings via Voyage AI API.
Modelo: voyage-3 · Dimensão: 1024 · Batch máximo: 128 textos por request.
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_MODEL = "voyage-3"
VOYAGE_DIMENSIONS = 1024
BATCH_SIZE = 128  # máximo Voyage por request


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Gera embeddings em batch via Voyage AI.

    Processa até BATCH_SIZE (128) textos por request. Se a chave de API
    não estiver configurada, retorna vetores zerados com aviso no log.
    Em caso de erro HTTP, retorna vetores zerados para o batch afetado
    e registra o erro — sem propagar exceção ao chamador.

    Args:
        texts: Lista de textos para gerar embeddings.

    Returns:
        Lista de vetores float com dimensão VOYAGE_DIMENSIONS (1024),
        um vetor por texto de entrada, na mesma ordem.
    """
    api_key = os.environ.get("VOYAGE_API_KEY", "")
    if not api_key:
        logger.warning("VOYAGE_API_KEY nao configurado — retornando vetores zerados")
        return [[0.0] * VOYAGE_DIMENSIONS for _ in texts]

    results: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(
                    VOYAGE_API_URL,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"input": batch, "model": VOYAGE_MODEL},
                )
                response.raise_for_status()
                data = response.json()
                results.extend(item["embedding"] for item in data["data"])
        except httpx.HTTPError as exc:
            logger.error("Erro ao chamar Voyage API: %s", exc)
            results.extend([[0.0] * VOYAGE_DIMENSIONS for _ in batch])
    return results


def embed_text(text: str) -> list[float]:
    """
    Conveniência para gerar embedding de um único texto.

    Args:
        text: Texto de entrada.

    Returns:
        Vetor float com dimensão VOYAGE_DIMENSIONS (1024).
    """
    return embed_texts([text])[0]
