"""Carrega e cacheia logo DS Car como base64 para uso em templates PDF."""
from __future__ import annotations

import base64
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

def _build_candidates() -> list[Path]:
    """Constrói lista de caminhos candidatos para a logo, seguro em qualquer ambiente."""
    candidates = []
    # Local dev: backend/core/apps/pdf_engine/logo.py → parents[4] = grupo-dscar/
    here = Path(__file__).resolve()
    try:
        candidates.append(here.parents[4] / "apps" / "dscar-web" / "public" / "dscar-logo.png")
    except IndexError:
        pass
    # Docker: /app/apps/pdf_engine/logo.py — logo copiada para /app/static/dscar-logo.png
    candidates.append(Path("/app/static/dscar-logo.png"))
    # Fallback: junto ao próprio arquivo
    candidates.append(here.parent / "dscar-logo.png")
    return candidates


_LOGO_CANDIDATES = _build_candidates()


@lru_cache(maxsize=1)
def get_logo_base64() -> str:
    """Retorna logo DS Car como data URI base64 (PNG).

    Returns:
        String no formato 'data:image/png;base64,...' pronta para uso em img src.
        Se logo não encontrada, retorna string vazia.
    """
    for path in _LOGO_CANDIDATES:
        if path.exists():
            data = path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            logger.info("Logo PDF carregada de %s (%d bytes)", path, len(data))
            return f"data:image/png;base64,{b64}"

    logger.warning("Logo DS Car não encontrada em nenhum caminho candidato.")
    return ""
