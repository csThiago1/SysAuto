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
    # Local dev: backend/core/apps/documents/ → parents[3] = grupo-dscar/
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


def _svg_data_uri(svg: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


@lru_cache(maxsize=1)
def get_ticket_logo_svg() -> str:
    """Logo estilo ticket ("Parada Obrigatória", preta) como data URI SVG."""
    return _svg_data_uri((_HERE / "dscar-ticket-preta.svg").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def get_flags_watermark_tile() -> str:
    """Ladrilho da marca d'água: bandeiras bem claras, repetidas no fundo da página."""
    svg = (_HERE / "dscar-bandeiras-preta.svg").read_text(encoding="utf-8")
    inner = svg[svg.index(">", svg.index("<svg")) + 1 : svg.rindex("</svg>")]
    # Viewbox do logo: 201.6 x 105.8 → ladrilho 150 x 95 com respiro, logo a 55%.
    # Opacidade 16%: abaixo de ~10% de cinza a impressora laser não imprime (só aparecia na tela).
    tile = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="95" viewBox="0 0 150 95">'
        f'<g opacity="0.16" transform="translate(20 18) scale(0.55)">{inner}</g></svg>'
    )
    return _svg_data_uri(tile)

