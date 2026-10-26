"""
Fontes externas das consultas: uma função por fonte.

Cada uma devolve o dict normalizado do seu tipo, ou `None` quando a fonte diz "não existe".
Erro de rede ou HTTP inesperado levanta; quem trata é `service.lookup`.
"""

import logging
import re
from typing import Any

import httpx

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

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


def _cnae(code: Any) -> str:
    """CNAE com 7 dígitos: algumas fontes mandam inteiro e perdem o zero à esquerda."""
    return f"{int(code):07d}" if code not in (None, "") else ""


def _sim_nao(v: str | None) -> bool | None:
    return None if v is None else v.strip().lower() == "sim"


def _cnpj_shape(**fields: Any) -> dict[str, Any]:
    """Dict comum de CNPJ: texto sem `None`, `situacao` em caixa alta ("ATIVA")."""
    out = {k: v if isinstance(v, bool) or v is None else str(v).strip() for k, v in fields.items()}
    out["situacao"] = out["situacao"].upper()
    return out


def cnpja_open(cnpj: str) -> dict[str, Any] | None:
    """Único que aceita CNPJ alfanumérico."""
    data = _get(f"https://open.cnpja.com/office/{cnpj}")
    if data is None:
        return None
    company, addr = data.get("company") or {}, data.get("address") or {}
    activity = data.get("mainActivity") or {}
    phones, emails = data.get("phones") or [], data.get("emails") or []
    return _cnpj_shape(
        razao_social=company.get("name") or "",
        nome_fantasia=data.get("alias") or "",
        situacao=(data.get("status") or {}).get("text") or "",
        logradouro=addr.get("street") or "",
        numero=addr.get("number") or "",
        complemento=addr.get("details") or "",
        bairro=addr.get("district") or "",
        cep=addr.get("zip") or "",
        ibge=addr.get("municipality") or "",
        cidade=addr.get("city") or "",
        uf=addr.get("state") or "",
        cnae_codigo=_cnae(activity.get("id")),
        cnae_descricao=activity.get("text") or "",
        simples=(company.get("simples") or {}).get("optant"),
        mei=(company.get("simei") or {}).get("optant"),
        email=emails[0].get("address", "") if emails else "",
        telefone=f"{phones[0].get('area', '')}{phones[0].get('number', '')}" if phones else "",
    )


def minhareceita(cnpj: str) -> dict[str, Any] | None:
    data = _get(f"https://minhareceita.org/{cnpj}")
    if data is None:
        return None
    tipo, logradouro = data.get("descricao_tipo_de_logradouro"), data.get("logradouro")
    return _cnpj_shape(
        razao_social=data.get("razao_social") or "",
        nome_fantasia=data.get("nome_fantasia") or "",
        situacao=data.get("descricao_situacao_cadastral") or "",
        logradouro=" ".join(p for p in (tipo, logradouro) if p),
        numero=data.get("numero") or "",
        complemento=data.get("complemento") or "",
        bairro=data.get("bairro") or "",
        cep=data.get("cep") or "",
        ibge=data.get("codigo_municipio_ibge") or "",
        cidade=data.get("municipio") or "",
        uf=data.get("uf") or "",
        cnae_codigo=_cnae(data.get("cnae_fiscal")),
        cnae_descricao=data.get("cnae_fiscal_descricao") or "",
        simples=data.get("opcao_pelo_simples"),
        mei=data.get("opcao_pelo_mei"),
        email=data.get("email") or "",
        telefone=data.get("ddd_telefone_1") or "",
    )


def cnpjws(cnpj: str) -> dict[str, Any] | None:
    data = _get(f"https://publica.cnpj.ws/cnpj/{cnpj}")
    if data is None:
        return None
    est, simples = data.get("estabelecimento") or {}, data.get("simples") or {}
    tipo, logradouro = est.get("tipo_logradouro"), est.get("logradouro")
    activity, cidade = est.get("atividade_principal") or {}, est.get("cidade") or {}
    return _cnpj_shape(
        razao_social=data.get("razao_social") or "",
        nome_fantasia=est.get("nome_fantasia") or "",
        situacao=est.get("situacao_cadastral") or "",
        logradouro=" ".join(p for p in (tipo, logradouro) if p),
        numero=est.get("numero") or "",
        complemento=est.get("complemento") or "",
        bairro=est.get("bairro") or "",
        cep=est.get("cep") or "",
        ibge=cidade.get("ibge_id") or "",
        cidade=cidade.get("nome") or "",
        uf=(est.get("estado") or {}).get("sigla") or "",
        cnae_codigo=_cnae(activity.get("id")),
        cnae_descricao=activity.get("descricao") or "",
        simples=_sim_nao(simples.get("simples")),
        mei=_sim_nao(simples.get("mei")),
        email=est.get("email") or "",
        telefone=f"{est.get('ddd1') or ''}{est.get('telefone1') or ''}",
    )


def _year(value: Any) -> int | None:
    """Ano de "2022", "2022/2023" ou 2022; `None` se não houver ano plausível."""
    m = re.search(r"\d{4}", str(value or ""))
    return int(m.group()) if m and 1900 <= int(m.group()) <= 2100 else None


def apiplacas(placa: str) -> dict[str, Any] | None:
    """API Placas (wdapi2). O chassi e o RENAVAM da resposta nunca saem daqui."""
    token = settings.APIPLACAS_TOKEN
    if not token:
        raise ImproperlyConfigured("APIPLACAS_TOKEN")
    # ponytail: ignora APIPLACAS_TIMEOUT (8 s); vale o timeout comum das consultas
    resp = httpx.get(f"{settings.APIPLACAS_URL}/{placa}/{token}", timeout=TIMEOUT)
    if resp.status_code in (402, 403):
        # Erro, não "placa não existe": o raise_for_status abaixo levanta e nada vai ao cache.
        logger.error("token API Placas inválido", extra={"status": resp.status_code})
    if resp.status_code in (404, 406):  # 406: placa não encontrada
        return None
    resp.raise_for_status()
    data = resp.json()
    marca = (data.get("MARCA") or data.get("marca") or "").strip()
    # Com SUBMODELO e VERSAO a API já separou; senão a versão está dentro de MODELO.
    sub, versao = (data.get("SUBMODELO") or "").strip(), (data.get("VERSAO") or "").strip()
    modelo = sub if sub and versao else (data.get("MODELO") or data.get("modelo") or "").strip()
    if not marca and not modelo:  # 200 sem veículo
        return None
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    dados = (data.get("fipe") or {}).get("dados") or []
    return {
        "marca": marca,
        "modelo": modelo,
        "versao": versao if sub else "",
        "ano_modelo": _year(data.get("anoModelo") or data.get("ano")),
        "ano_fabricacao": _year(data.get("ano") or extra.get("ano_fabricacao")),
        "cor": (data.get("cor") or "").strip(),
        "codigos_fipe": [
            (d["codigo_fipe"], int(d.get("score") or 0)) for d in dados if d.get("codigo_fipe")
        ],
        "situacao": (data.get("situacao") or "").strip(),
        "codigo_situacao": int(data.get("codigoSituacao") or 0),
    }
