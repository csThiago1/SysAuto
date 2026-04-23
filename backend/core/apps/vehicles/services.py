"""VehicleService: lookup de placa com DB-first e fallback para apiplacas.com.br."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = getattr(settings, "APIPLACAS_TIMEOUT", 8.0)


class VehicleService:
    """Lookup e criação de veículos físicos por placa."""

    @classmethod
    def lookup_plate(cls, plate: str) -> dict[str, Any] | None:
        """Busca veículo por placa. DB primeiro, API externa como fallback.

        Fluxo:
        1. Normaliza placa (maiúscula, sem hífen/espaços)
        2. Consulta Vehicle ativo na base → retorna imediatamente (source='db')
        3. Chama apiplacas.com.br com token Bearer
        4. Falha na API → log warning, retorna None (nunca propaga exceção)
        5. Busca VehicleYearVersion por codigo_fipe (nullable)
        6. Persiste Vehicle para consultas futuras
        7. Retorna dict com source='api'

        Returns:
            dict com plate, description, color, year, version_id, source
            None se não encontrado ou API indisponível
        """
        plate = plate.upper().strip().replace("-", "").replace(" ", "")

        # 1. DB-first
        from .models import Vehicle
        existing = Vehicle.objects.filter(plate=plate, is_active=True).first()
        if existing:
            return {
                "plate": existing.plate,
                "description": existing.display_name,
                "color": existing.color,
                "year": existing.year_manufacture,
                "version_id": existing.version_id,
                "source": "db",
            }

        # 2. API externa
        token = getattr(settings, "APIPLACAS_TOKEN", "")
        url = getattr(settings, "APIPLACAS_URL", "")
        if not token or not url:
            logger.warning("APIPLACAS_TOKEN/URL não configurados — lookup desabilitado.")
            return None

        try:
            response = httpx.get(
                url,
                params={"placa": plate},
                headers={"Authorization": f"Bearer {token}"},
                timeout=_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Lookup de placa %s*** falhou: %s", plate[:3], exc)
            return None

        # 3. Resolve VehicleYearVersion por codigo_fipe
        fipe_code = data.get("codigoFipe") or data.get("fipe_code") or ""
        version = None
        if fipe_code:
            from apps.vehicle_catalog.models import VehicleYearVersion
            version = VehicleYearVersion.objects.filter(codigo_fipe=fipe_code).first()

        # 4. Extrai dados da resposta
        description = " ".join(filter(None, [
            data.get("marca", ""),
            data.get("modelo", ""),
        ])) or data.get("description", "")
        color = data.get("cor") or data.get("color", "")
        year_str = str(data.get("ano") or data.get("year", "")).split("/")[0]
        year = int(year_str) if year_str.isdigit() else None
        renavam = data.get("renavam", "")
        chassis = data.get("chassi") or data.get("chassis", "")

        # 5. Persiste Vehicle
        vehicle = Vehicle.objects.create(
            plate=plate,
            version=version,
            description=description,
            color=color,
            year_manufacture=year,
            renavam=renavam,
            chassis=chassis,
        )

        return {
            "plate": vehicle.plate,
            "description": vehicle.display_name,
            "color": vehicle.color,
            "year": vehicle.year_manufacture,
            "version_id": vehicle.version_id,
            "source": "api",
        }
