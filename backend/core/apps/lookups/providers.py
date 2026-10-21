"""
Fontes externas das consultas: uma função por fonte.

Cada uma devolve o dict normalizado do seu tipo, ou `None` quando a fonte diz "não existe".
Erro de rede ou HTTP inesperado levanta; quem trata é `service.lookup`.
"""

from typing import Any

import httpx

from django.conf import settings

TIMEOUT = httpx.Timeout(3.0, connect=1.5)


def _get(url: str, **kwargs: Any) -> dict[str, Any] | None:
    """GET com o timeout padrão. 404 dá `None`; outro status de erro levanta."""
    resp = httpx.get(url, timeout=TIMEOUT, **kwargs)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def _viacep_shape(data: dict[str, Any]) -> dict[str, Any]:
    """ViaCEP e OpenCEP têm as mesmas chaves."""
    return {
        "cep": data.get("cep", ""),
        "logradouro": data.get("logradouro", ""),
        "complemento": data.get("complemento", ""),
        "bairro": data.get("bairro", ""),
        "cidade": data.get("localidade", ""),
        "uf": data.get("uf", ""),
        "ibge": data.get("ibge", ""),
    }


def viacep(cep: str) -> dict[str, Any] | None:
    data = _get(f"https://viacep.com.br/ws/{cep}/json/")
    if data is None or data.get("erro"):  # CEP inexistente vem 200 com {"erro": "true"}
        return None
    return _viacep_shape(data)


def opencep(cep: str) -> dict[str, Any] | None:
    data = _get(f"https://opencep.com/v1/{cep}")
    if data is None or data.get("error"):
        return None
    return _viacep_shape(data)


def awesomeapi(cep: str) -> dict[str, Any] | None:
    """Funciona sem token (limite menor); com `AWESOMEAPI_TOKEN` usa a cota da chave."""
    token = settings.AWESOMEAPI_TOKEN
    data = _get(
        f"https://cep.awesomeapi.com.br/json/{cep}", params={"token": token} if token else None
    )
    if data is None:
        return None
    return {
        "cep": data.get("cep", ""),
        "logradouro": data.get("address", ""),
        "complemento": "",
        "bairro": data.get("district", ""),
        "cidade": data.get("city", ""),
        "uf": data.get("state", ""),
        "ibge": data.get("city_ibge", ""),
    }
