"""Carrega e cacheia logos DS Car como base64 para uso em templates PDF."""
from __future__ import annotations

import base64
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent


def _find_logo(filename: str) -> str:
    """Busca logo por nome em caminhos candidatos e retorna data URI base64."""
    candidates: list[Path] = []
    # Local dev: backend/core/apps/pdf_engine/ → parents[4] = grupo-dscar/
    try:
        candidates.append(_HERE.parents[3] / "apps" / "dscar-web" / "public" / filename)
    except IndexError:
        pass
    # Docker fallback
    candidates.append(Path(f"/app/static/{filename}"))
    # Junto ao próprio arquivo
    candidates.append(_HERE / filename)

    for path in candidates:
        if path.exists():
            data = path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            logger.info("Logo '%s' carregada de %s (%d bytes)", filename, path, len(data))
            return f"data:image/png;base64,{b64}"

    logger.warning("Logo '%s' não encontrada.", filename)
    return ""


@lru_cache(maxsize=1)
def get_logo_base64() -> str:
    """Logo branca (para fundo escuro / header com bg preto)."""
    return _find_logo("dscar-logo.png")


@lru_cache(maxsize=1)
def get_logo_black_base64() -> str:
    """Logo preta (para marca d'água / fundo branco)."""
    return _find_logo("dscar-logo-black.png")
