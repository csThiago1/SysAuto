"""VehicleService: lookup de placa com DB-first e fallback canônico de placa."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

from .models import Vehicle
from apps.vehicle_catalog.models import PlateCache
from apps.vehicle_catalog.models import VehicleYearVersion

logger = logging.getLogger(__name__)


class VehicleService:
    """Lookup e criação de veículos físicos por placa."""

    @staticmethod
    def _vehicle_response(vehicle: Vehicle, source: str) -> dict[str, Any]:
        """Converte um Vehicle físico no contrato de lookup por placa."""
        if vehicle.version:
            make = vehicle.version.modelo.marca.nome
            model = vehicle.version.modelo.nome
            version = vehicle.version.descricao
        else:
            parts = vehicle.description.split(" ", 1)
            make = parts[0] if parts else ""
            model = parts[1] if len(parts) > 1 else ""
            version = ""

        return {
            "plate": vehicle.plate,
            "make": make,
            "model": model,
            "version": version,
            "description": vehicle.display_name,
            "color": vehicle.color,
            "year": vehicle.year_manufacture,
            "chassis": vehicle.chassis,
            "renavam": vehicle.renavam,
            "version_id": vehicle.version_id,
            "source": source,
        }

    @staticmethod
    def _persist_from_plate_data(plate: str, data: dict[str, Any], source: str) -> dict[str, Any]:
        """Persiste Vehicle a partir do contrato normalizado de placa."""
        fipe_code = str(data.get("codigo_fipe") or data.get("fipe_code") or "")
        version = None
        if fipe_code:
            version = VehicleYearVersion.objects.filter(codigo_fipe=fipe_code).first()

        description = " ".join(
            str(part).strip()
            for part in (data.get("make"), data.get("model"), data.get("version"))
            if part
        )
        year = VehicleService._parse_year(data.get("year"))

        vehicle, _ = Vehicle.objects.get_or_create(
            plate=plate,
            is_active=True,
            defaults={
                "version": version,
                "description": description,
                "color": data.get("color", ""),
                "year_manufacture": year,
                "renavam": data.get("renavam", ""),
                "chassis": data.get("chassis", ""),
            },
        )
        response = VehicleService._vehicle_response(vehicle, source)
        response.update({
            "engine": data.get("engine", ""),
            "fuel_type": data.get("fuel_type", ""),
            "fipe_value": data.get("fipe_value"),
        })
        return response

    @staticmethod
    def _parse_year(value: Any) -> int | None:
        """Normaliza ano vindo como inteiro, string simples ou intervalo."""
        text = str(value or "").split("/")[0]
        return int(text) if text.isdigit() else None

    @classmethod
    def lookup_plate(cls, plate: str) -> dict[str, Any] | None:
        """Busca veículo por placa. DB primeiro, API externa como fallback.

        Fluxo:
        1. Normaliza placa (maiúscula, sem hífen/espaços)
        2. Consulta Vehicle ativo na base → retorna imediatamente (source='db')
        3. Consulta PlateCache do vehicle_catalog
        4. Chama provider configurado em APIPLACAS_URL/APIPLACAS_TOKEN
        4. Falha na API → log warning, retorna None (nunca propaga exceção)
        5. Persiste Vehicle para consultas futuras
        6. Retorna dict com source='api' ou source='cache'

        Returns:
            dict com plate, description, color, year, version_id, source
            None se não encontrado ou API indisponível
        """
        plate = plate.upper().strip().replace("-", "").replace(" ", "")

        # 1. DB-first — veículos já cadastrados no tenant
        existing = (
            Vehicle.objects.filter(plate=plate, is_active=True)
            .select_related("version__modelo__marca")
            .first()
        )
        if existing:
            return cls._vehicle_response(existing, "db")

        cached = PlateCache.objects.filter(plate=plate).first()
        if cached:
            data = {
                "make": cached.make,
                "model": cached.model,
                "version": cached.version,
                "engine": cached.engine,
                "year": cached.year,
                "chassis": cached.chassis,
                "renavam": cached.renavam,
                "color": cached.color,
                "fuel_type": cached.fuel_type,
                "fipe_value": None,
            }
            return cls._persist_from_plate_data(plate, data, "cache")

        # 2. API externa
        token = getattr(settings, "APIPLACAS_TOKEN", "")
        url = getattr(settings, "APIPLACAS_URL", "")
        if not token or not url:
            logger.warning("APIPLACAS_TOKEN/URL não configurados — lookup desabilitado.")
            return None

        timeout = getattr(settings, "APIPLACAS_TIMEOUT", 8.0)
        try:
            response = httpx.get(f"{url}/{plate}/{token}", headers={"Accept": "application/json"}, timeout=timeout)
            response.raise_for_status()
            raw_data = response.json()
        except Exception as exc:
            logger.warning("Lookup de placa %s*** falhou: %s", plate[:3], exc)
            return None

        from apps.vehicle_catalog.views import _normalize_plate_response

        normalized = _normalize_plate_response(plate, raw_data)
        PlateCache.objects.update_or_create(
            plate=plate,
            defaults={
                "make": normalized["make"],
                "model": normalized["model"],
                "version": normalized["version"],
                "engine": normalized["engine"],
                "year": cls._parse_year(normalized["year"]),
                "chassis": normalized["chassis"],
                "renavam": normalized["renavam"],
                "city": normalized["city"],
                "color": normalized["color"],
                "fuel_type": normalized["fuel_type"],
                "raw_response": raw_data,
            },
        )
        return cls._persist_from_plate_data(plate, normalized, "api")
