"""
Serviço de lookup de placa via API externa.

Fluxo:
  1. Recebe a placa (ex: ABC1D23)
  2. Consulta API externa (webxcar / fipeapi) para obter fipe_code
  3. Busca VehicleVersion local pelo fipe_code → zero latência na OS
  4. Retorna dict com dados do veículo ou None se não encontrado

API externa configurada via env: PLATE_LOOKUP_URL e PLATE_LOOKUP_KEY
"""
import logging
import os
from typing import Optional

import httpx

from .models import VehicleVersion

logger = logging.getLogger(__name__)

_LOOKUP_URL = os.environ.get("PLATE_LOOKUP_URL", "")
_LOOKUP_KEY = os.environ.get("PLATE_LOOKUP_KEY", "")
_TIMEOUT = 8.0  # segundos


def lookup_plate(plate: str) -> Optional[dict]:
    """
    Retorna dados do veículo para a placa informada.

    Returns:
        dict com keys: plate, fipe_code, full_name, year_model, fuel, color
        None se não encontrado ou API indisponível (falha silenciosa).
    """
    plate = plate.upper().strip().replace("-", "")

    if not _LOOKUP_URL or not _LOOKUP_KEY:
        logger.warning("PLATE_LOOKUP_URL/KEY não configurados — lookup desabilitado.")
        return None

    try:
        response = httpx.get(
            f"{_LOOKUP_URL}/plate/{plate}",
            headers={"Authorization": f"Bearer {_LOOKUP_KEY}"},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        # Falha silenciosa — lookup nunca quebra o fluxo de abertura de OS
        logger.warning(f"Lookup de placa {plate[:3]}*** falhou: {exc}")
        return None

    fipe_code = data.get("fipe_code")
    if not fipe_code:
        return None

    # Busca versão local — base FIPE já populada
    version = VehicleVersion.objects.filter(fipe_code=fipe_code).first()

    return {
        "plate": plate,
        "fipe_code": fipe_code,
        "full_name": version.full_name if version else data.get("description", ""),
        "year_model": data.get("year_model"),
        "fuel": data.get("fuel", ""),
        "color": data.get("color", ""),
        "version_id": version.id if version else None,
    }
