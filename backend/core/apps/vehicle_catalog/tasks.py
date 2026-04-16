"""
Tarefas Celery para sincronização com a API FIPE.
API: https://fipe.parallelum.com.br/api/v2 (deividivan/fipe-api)
"""
import logging
from typing import Any

import httpx
from celery import shared_task
from django.conf import settings

from apps.vehicle_catalog.models import VehicleMake, VehicleModel, VehicleYearVersion
from apps.vehicle_catalog.utils import normalizar_texto

logger = logging.getLogger(__name__)

FIPE_API_URL = getattr(settings, "FIPE_API_URL", "https://fipe.parallelum.com.br/api/v2")


@shared_task(
    name="vehicle_catalog.sync_fipe_makes",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def task_sync_fipe_makes(self: Any) -> dict[str, int]:
    """Sincroniza todas as marcas de carros com a API FIPE.

    Roda semanalmente via Celery Beat.
    Retorna contadores de criados/atualizados.
    """
    url = f"{FIPE_API_URL}/cars/brands"
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()
            brands: list[dict[str, str]] = response.json()
    except httpx.HTTPError as exc:
        logger.error("Erro ao buscar marcas FIPE: %s", exc)
        raise self.retry(exc=exc)

    created = updated = 0
    for brand in brands:
        fipe_id = str(brand.get("code", ""))
        nome = brand.get("name", "").strip()
        if not fipe_id or not nome:
            continue
        _, is_new = VehicleMake.objects.update_or_create(
            fipe_id=fipe_id,
            defaults={
                "nome": nome,
                "nome_normalizado": normalizar_texto(nome),
            },
        )
        if is_new:
            created += 1
        else:
            updated += 1

    logger.info("FIPE makes sync: %d criados, %d atualizados", created, updated)
    return {"created": created, "updated": updated}


@shared_task(
    name="vehicle_catalog.sync_fipe_models",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def task_sync_fipe_models(self: Any, make_fipe_id: str) -> dict[str, int]:
    """Sincroniza modelos de uma marca específica.

    Disparado on-demand quando o usuário seleciona uma marca no frontend.
    """
    try:
        make = VehicleMake.objects.get(fipe_id=make_fipe_id)
    except VehicleMake.DoesNotExist:
        logger.warning("VehicleMake fipe_id=%s não encontrado.", make_fipe_id)
        return {"created": 0, "updated": 0}

    url = f"{FIPE_API_URL}/cars/brands/{make_fipe_id}/models"
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()
            models_list: list[dict[str, Any]] = data.get("models", data)
    except httpx.HTTPError as exc:
        logger.error("Erro ao buscar modelos FIPE (marca %s): %s", make_fipe_id, exc)
        raise self.retry(exc=exc)

    created = updated = 0
    for item in models_list:
        fipe_id = str(item.get("code", ""))
        nome = item.get("name", "").strip()
        if not fipe_id or not nome:
            continue
        _, is_new = VehicleModel.objects.update_or_create(
            marca=make,
            fipe_id=fipe_id,
            defaults={
                "nome": nome,
                "nome_normalizado": normalizar_texto(nome),
            },
        )
        if is_new:
            created += 1
        else:
            updated += 1

    logger.info(
        "FIPE models sync (marca %s): %d criados, %d atualizados",
        make_fipe_id, created, updated,
    )
    return {"created": created, "updated": updated}


@shared_task(
    name="vehicle_catalog.sync_fipe_years",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def task_sync_fipe_years(self: Any, model_db_id: int) -> dict[str, int]:
    """Sincroniza anos/versões de um modelo específico.

    Disparado on-demand quando o usuário seleciona um modelo no frontend.
    """
    try:
        vehicle_model = VehicleModel.objects.select_related("marca").get(
            pk=model_db_id
        )
    except VehicleModel.DoesNotExist:
        logger.warning("VehicleModel pk=%s não encontrado.", model_db_id)
        return {"created": 0, "updated": 0}

    url = (
        f"{FIPE_API_URL}/cars/brands/{vehicle_model.marca.fipe_id}"
        f"/models/{vehicle_model.fipe_id}/years"
    )
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()
            years: list[dict[str, Any]] = response.json()
    except httpx.HTTPError as exc:
        logger.error(
            "Erro ao buscar anos FIPE (modelo pk=%s): %s", model_db_id, exc
        )
        raise self.retry(exc=exc)

    created = updated = 0
    for item in years:
        fipe_id = str(item.get("code", ""))
        descricao = item.get("name", "").strip()
        if not fipe_id or not descricao:
            continue
        # Parse "2022 Gasolina" → ano=2022, combustivel="gasolina"
        parts = descricao.split(" ", 1)
        try:
            ano = int(parts[0])
        except (ValueError, IndexError):
            ano = 0
        combustivel = parts[1].lower() if len(parts) > 1 else "desconhecido"

        _, is_new = VehicleYearVersion.objects.update_or_create(
            modelo=vehicle_model,
            fipe_id=fipe_id,
            defaults={
                "ano": ano,
                "combustivel": combustivel,
                "descricao": descricao,
            },
        )
        if is_new:
            created += 1
        else:
            updated += 1

    logger.info(
        "FIPE years sync (modelo pk=%s): %d criados, %d atualizados",
        model_db_id, created, updated,
    )
    return {"created": created, "updated": updated}
