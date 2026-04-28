"""
Paddock Solutions — Fiscal — Builders NFS-e Manaus
Ciclo 06C: NFS-e end-to-end para a Prefeitura de Manaus (IBGE 1302603)

ManausNfseBuilder : constrói payload a partir de OS + Person + FiscalConfigModel
ManualNfseBuilder : constrói payload a partir de ManualNfseInputSerializer.validated_data
"""

import logging
import zoneinfo
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

_TZ_MANAUS = zoneinfo.ZoneInfo("America/Manaus")

from apps.fiscal.exceptions import NfseBuilderError

if TYPE_CHECKING:
    from apps.fiscal.models import FiscalConfigModel
    from apps.persons.models import Person
    from apps.service_orders.models import ServiceOrder

logger = logging.getLogger(__name__)

# Código IBGE de Manaus — fixo neste builder.
MUNICIPIO_IBGE_MANAUS = "1302603"

# Mapeamento tipo de OS → item LC 116
# Ref: spec §9.1 — DS Car Manaus
# Focus NFS-e Nacional: 6 dígitos = Item(2) + Subitem(2) + Desdobro(2)
# Manaus administra o código 14.12 para serviços automotivos
_LC116_MAP: dict[str, str] = {
    "vidros": "141201",
}
_LC116_DEFAULT = "141201"  # 14.12.01 — Funilaria/lanternagem/manutenção veicular (Manaus)

# NBS (Nomenclatura Brasileira de Serviços) correspondente
# 1.2001.31.00 = Serviços de manutenção e reparação de veículos automotores rodoviários
_NBS_DEFAULT = "120013100"


def _normalize_lc116(code: str) -> str:
    """Converte código LC 116 para 6 dígitos numéricos (XXYYZZ).

    Focus NFS-e Nacional: 6 dígitos = Item(2) + Subitem(2) + Desdobro(2).
    Quando desdobro não informado (4 dígitos), assume '01' (primeiro desdobro).
    Ex: '14.01' → '140101', '14.01.01' → '140101', '1401' → '140101', '140101' → '140101'.
    """
    digits = code.replace(".", "").strip()
    if len(digits) <= 4:
        # Sem desdobro: assume 01 (primeiro desdobro nacional)
        digits = digits.ljust(4, "0") + "01"
    return digits[:6]

_MAX_DISCRIMINACAO_CHARS = 2000


class ManausNfseBuilder:
    """Constrói payload Focus NFS-e para a Prefeitura de Manaus (IBGE 1302603).

    Fonte: spec §7.4 + mapeamento LC 116 §9.1.

    Raises:
        NfseBuilderError: dados insuficientes — Person sem documento primário,
            sem endereço com municipio_ibge, config incompleta, etc.
    """

    @classmethod
    def build(
        cls,
        service_order: "ServiceOrder",
        config: "FiscalConfigModel",
        ref: str,
        parts_as_service: bool = False,
    ) -> dict[str, Any]:
        """Retorna dict pronto para POST Focus /v2/nfsen (NFS-e Nacional — flat).

        Manaus migrou para NFS-e Nacional. Endpoint: /v2/nfsen (não /v2/nfse).
        Formato: campos flat (cnpj_prestador, cpf_tomador, etc).
        """
        from decimal import Decimal
        from apps.persons.models import TipoDocumento

        if service_order.destinatario is None:
            raise NfseBuilderError("ServiceOrder sem destinatario vinculado.")

        person: "Person" = service_order.destinatario

        # ── Tomador (destinatário) ──────────────────────────────────────
        doc = (
            person.documents.filter(is_primary=True).first()
            or person.documents.filter(doc_type__in=[TipoDocumento.CPF, TipoDocumento.CNPJ]).first()
        )
        if doc is None:
            raise NfseBuilderError(f"Person pk={person.pk} sem CPF/CNPJ.")

        address = person.addresses.filter(is_primary=True).first() or person.addresses.first()
        if address is None:
            raise NfseBuilderError(f"Person pk={person.pk} sem endereço.")

        # ── Valores ─────────────────────────────────────────────────────
        services_total: Decimal = service_order.services_total or Decimal("0")
        if parts_as_service:
            services_total += service_order.parts_total or Decimal("0")

        aliquota_iss = config.aliquota_iss_default or Decimal("2.00")
        valor_iss = (services_total * aliquota_iss / Decimal("100")).quantize(Decimal("0.01"))

        lc116_code = cls._get_lc116_code(
            service_order.service_type if hasattr(service_order, "service_type") else ""
        )
        discriminacao = cls._format_discriminacao(service_order, parts_as_service)

        # ── Simples Nacional ────────────────────────────────────────────
        # codigo_opcao_simples_nacional: 1=não optante, 2=optante ME/EPP, 3=MEI
        is_simples = str(config.regime_tributario) == "1"
        codigo_opcao_sn = "2" if is_simples else "1"

        # Extrair numero sequencial da ref para numero_dps
        try:
            numero_dps = int(ref.rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            numero_dps = 1

        # ── Payload flat /v2/nfsen ──────────────────────────────────────
        # serie_dps: usar série 2 para não conflitar com Box Empresa (série 1, números 5000+)
        payload: dict[str, Any] = {
            "data_emissao": datetime.now(tz=_TZ_MANAUS).isoformat(),
            "serie_dps": "1",
            "numero_dps": str(numero_dps),
            "data_competencia": datetime.now(tz=_TZ_MANAUS).strftime("%Y-%m-%d"),
            "cnpj_prestador": config.cnpj,
            "inscricao_municipal_prestador": config.inscricao_municipal,
            "codigo_municipio_emissora": MUNICIPIO_IBGE_MANAUS,
            "codigo_municipio_prestacao": MUNICIPIO_IBGE_MANAUS,
            "codigo_opcao_simples_nacional": codigo_opcao_sn,
            "regime_especial_tributacao": "0",
            # Tomador
            "razao_social_tomador": person.full_name,
            "logradouro_tomador": address.street or "",
            "numero_tomador": address.number or "S/N",
            "bairro_tomador": address.neighborhood or "",
            "codigo_municipio_tomador": address.municipio_ibge or MUNICIPIO_IBGE_MANAUS,
            "uf_tomador": address.state or "AM",
            "cep_tomador": (address.zip_code or "").replace("-", ""),
            # Serviço
            "codigo_tributacao_nacional_iss": lc116_code,
            "codigo_nbs": _NBS_DEFAULT,
            "descricao_servico": discriminacao[:2000],
            "valor_servico": float(services_total),
            "tributacao_iss": 1,       # 1=tributação no município
            "tipo_retencao_iss": 1,    # 1=não retido
        }

        # Documento do tomador (CPF ou CNPJ)
        if doc.doc_type == TipoDocumento.CPF:
            payload["cpf_tomador"] = doc.value
        else:
            payload["cnpj_tomador"] = doc.value

        # Complemento (opcional)
        if address.complement:
            payload["complemento_tomador"] = address.complement

        # Email do tomador (se disponível)
        email_contact = person.contacts.filter(contact_type__iexact="email").first()
        if email_contact:
            payload["email_tomador"] = email_contact.value

        # Telefone do tomador (se disponível)
        phone_contact = person.contacts.filter(contact_type__iexact="celular").first()
        if not phone_contact:
            phone_contact = person.contacts.filter(contact_type__iexact="telefone").first()
        if phone_contact:
            payload["telefone_tomador"] = phone_contact.value.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")

        return payload

    @classmethod
    def _get_tomador(cls, person: "Person") -> dict[str, Any]:
        """Monta bloco tomador a partir de Person + PersonDocument + PersonAddress."""
        from apps.persons.models import TipoDocumento

        # Documento primário
        doc = (
            person.documents.filter(is_primary=True)
            .order_by("-is_primary")
            .first()
        )
        if doc is None:
            # Fallback: qualquer CPF ou CNPJ
            doc = person.documents.filter(
                doc_type__in=[TipoDocumento.CPF, TipoDocumento.CNPJ]
            ).first()
        if doc is None:
            raise NfseBuilderError(
                f"Person pk={person.pk} não tem PersonDocument primário nem CPF/CNPJ."
            )

        # Endereço primário com municipio_ibge
        address = (
            person.addresses.filter(is_primary=True).first()
            or person.addresses.first()
        )
        if address is None or not address.municipio_ibge:
            raise NfseBuilderError(
                f"Person pk={person.pk} não tem PersonAddress com municipio_ibge preenchido."
            )

        tomador: dict[str, Any] = {
            "razao_social": person.full_name,
            "endereco": {
                "logradouro": address.street,
                "numero": address.number,
                "complemento": address.complement,
                "bairro": address.neighborhood,
                "codigo_municipio": address.municipio_ibge,
                "uf": address.state,
                "cep": address.zip_code.replace("-", ""),
            },
        }

        if doc.doc_type == TipoDocumento.CPF:
            tomador["cpf"] = doc.value
        else:
            tomador["cnpj"] = doc.value
            tomador["inscricao_municipal"] = person.municipal_registration or ""

        return tomador

    @classmethod
    def _get_servico(
        cls,
        service_order: "ServiceOrder",
        config: "FiscalConfigModel",
        parts_as_service: bool,
    ) -> dict[str, Any]:
        """Monta bloco serviço com totais e discriminação."""
        from decimal import Decimal

        services_total: Decimal = service_order.services_total or Decimal("0")
        parts_total: Decimal = service_order.parts_total or Decimal("0")

        valor_servicos = services_total + (parts_total if parts_as_service else Decimal("0"))
        aliquota_iss = config.aliquota_iss_default
        valor_iss = (valor_servicos * aliquota_iss / Decimal("100")).quantize(Decimal("0.01"))
        valor_liquido = valor_servicos - valor_iss

        lc116_code = cls._get_lc116_code(service_order.service_type if hasattr(service_order, "service_type") else "")
        discriminacao = cls._format_discriminacao(service_order, parts_as_service)

        return {
            "valor_servicos": str(valor_servicos.quantize(Decimal("0.01"))),
            "valor_iss": str(valor_iss),
            "valor_liquido_nfse": str(valor_liquido),
            "aliquota": str(aliquota_iss),
            "iss_retido": False,
            "item_lista_servico": lc116_code,
            "codigo_tributacao_municipio": lc116_code,
            "discriminacao": discriminacao,
            "codigo_municipio": MUNICIPIO_IBGE_MANAUS,
        }

    @classmethod
    def _get_rps(cls, ref: str, config: "FiscalConfigModel") -> dict[str, Any]:
        """Monta bloco RPS. numero = último segmento da ref."""
        # ref format: "{cnpj8}-NFSE-{date}-{seq:06d}"
        try:
            numero = int(ref.rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            raise NfseBuilderError(f"Ref inválida para extrair número RPS: {ref!r}")

        return {
            "numero": str(numero),
            "serie": config.serie_rps,
            "tipo": "1",  # 1 = RPS padrão
        }

    @classmethod
    def _get_lc116_code(cls, os_type: str) -> str:
        """Mapeia tipo de serviço para item LC 116 (§9.1) em formato 6 dígitos."""
        return _normalize_lc116(_LC116_MAP.get((os_type or "").lower(), _LC116_DEFAULT))

    @classmethod
    def _format_discriminacao(
        cls,
        service_order: "ServiceOrder",
        parts_as_service: bool,
    ) -> str:
        """Texto livre da NFS-e (máx 2000 chars).

        Inclui: número da OS, itens de mão-de-obra, peças (se parts_as_service=True).
        Trunca com aviso de log se necessário.
        """
        lines: list[str] = [f"OS #{service_order.number}"]

        # Itens de mão-de-obra
        try:
            for item in service_order.labor_items.all():
                unit = getattr(item, "unit_price", None) or getattr(item, "price", 0)
                qty = getattr(item, "quantity", 1)
                name = getattr(item, "service_name", None) or getattr(item, "description", "Serviço")
                lines.append(f"Serv: {name} x{qty} = R${float(unit * qty):.2f}")
        except Exception:
            pass

        # Peças (se forem incluídas na NFS-e)
        if parts_as_service:
            try:
                for item in service_order.parts.all():
                    unit = getattr(item, "unit_price", None) or getattr(item, "price", 0)
                    qty = getattr(item, "quantity", 1)
                    name = getattr(item, "part_name", None) or getattr(item, "description", "Peça")
                    lines.append(f"Peca: {name} x{qty} = R${float(unit * qty):.2f}")
            except Exception:
                pass

        text = " | ".join(lines)
        if len(text) > _MAX_DISCRIMINACAO_CHARS:
            logger.warning(
                "ManausNfseBuilder: discriminacao truncada de %d para %d chars (OS #%s)",
                len(text),
                _MAX_DISCRIMINACAO_CHARS,
                service_order.number,
            )
            text = text[:_MAX_DISCRIMINACAO_CHARS]
        return text


# ─────────────────────────────────────────────────────────────────────────────


class ManualNfseBuilder:
    """Constrói payload NFS-e Nacional (/v2/nfsen) a partir de ManualNfseInputSerializer.

    Formato flat — mesmo padrão do ManausNfseBuilder.
    """

    @classmethod
    def build(
        cls,
        input_data: dict[str, Any],
        person: "Person",
        config: "FiscalConfigModel",
        ref: str,
    ) -> dict[str, Any]:
        """Retorna dict pronto para POST Focus /v2/nfsen (flat)."""
        from decimal import Decimal
        from apps.persons.models import TipoDocumento

        # Documento do tomador
        doc = (
            person.documents.filter(is_primary=True).first()
            or person.documents.filter(doc_type__in=[TipoDocumento.CPF, TipoDocumento.CNPJ]).first()
        )
        if doc is None:
            raise NfseBuilderError(f"Person pk={person.pk} sem CPF/CNPJ.")

        address = person.addresses.filter(is_primary=True).first() or person.addresses.first()
        if address is None:
            raise NfseBuilderError(f"Person pk={person.pk} sem endereço.")

        # Valores
        itens = input_data.get("itens", [])
        valor_servicos = sum(
            Decimal(str(i.get("valor_unitario", 0))) * Decimal(str(i.get("quantidade", 1)))
            - Decimal(str(i.get("valor_desconto", 0)))
            for i in itens
        )

        aliquota_iss = input_data.get("aliquota_iss") or config.aliquota_iss_default
        if aliquota_iss is None:
            aliquota_iss = config.aliquota_iss_default
        aliquota_iss = Decimal(str(aliquota_iss))

        valor_iss = (valor_servicos * aliquota_iss / Decimal("100")).quantize(Decimal("0.01"))

        lc116_code = _normalize_lc116(input_data.get("codigo_servico_lc116", _LC116_DEFAULT))
        discriminacao = input_data.get("discriminacao", "Serviços diversos")
        observacoes = input_data.get("observacoes_contribuinte", "")
        if observacoes:
            discriminacao = f"{discriminacao} | {observacoes}"
        discriminacao = discriminacao[:_MAX_DISCRIMINACAO_CHARS]

        # data_emissao
        data_emissao_raw = input_data.get("data_emissao")
        if data_emissao_raw:
            data_emissao = data_emissao_raw.isoformat() if hasattr(data_emissao_raw, "isoformat") else str(data_emissao_raw)
        else:
            data_emissao = datetime.now(tz=_TZ_MANAUS).isoformat()

        is_simples = str(config.regime_tributario) == "1"
        codigo_opcao_sn = "2" if is_simples else "1"

        # Extrair numero sequencial da ref para numero_dps
        try:
            numero_dps = int(ref.rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            numero_dps = 1

        # Payload flat /v2/nfsen
        payload: dict[str, Any] = {
            "data_emissao": data_emissao,
            "serie_dps": "1",
            "numero_dps": str(numero_dps),
            "data_competencia": datetime.now(tz=_TZ_MANAUS).strftime("%Y-%m-%d"),
            "cnpj_prestador": config.cnpj,
            "inscricao_municipal_prestador": config.inscricao_municipal,
            "codigo_municipio_emissora": MUNICIPIO_IBGE_MANAUS,
            "codigo_municipio_prestacao": MUNICIPIO_IBGE_MANAUS,
            "codigo_opcao_simples_nacional": codigo_opcao_sn,
            "regime_especial_tributacao": "0",
            # Tomador
            "razao_social_tomador": person.full_name,
            "logradouro_tomador": address.street or "",
            "numero_tomador": address.number or "S/N",
            "bairro_tomador": address.neighborhood or "",
            "codigo_municipio_tomador": address.municipio_ibge or MUNICIPIO_IBGE_MANAUS,
            "uf_tomador": address.state or "AM",
            "cep_tomador": (address.zip_code or "").replace("-", ""),
            # Serviço
            "codigo_tributacao_nacional_iss": lc116_code,
            "codigo_nbs": _NBS_DEFAULT,
            "descricao_servico": discriminacao,
            "valor_servico": float(valor_servicos),
            "tributacao_iss": 1,
            "tipo_retencao_iss": 1,
        }

        # Documento do tomador
        if doc.doc_type == TipoDocumento.CPF:
            payload["cpf_tomador"] = doc.value
        else:
            payload["cnpj_tomador"] = doc.value

        if address.complement:
            payload["complemento_tomador"] = address.complement

        # Contatos do tomador
        email_contact = person.contacts.filter(contact_type__iexact="email").first()
        if email_contact:
            payload["email_tomador"] = email_contact.value

        phone_contact = person.contacts.filter(contact_type__iexact="celular").first()
        if not phone_contact:
            phone_contact = person.contacts.filter(contact_type__iexact="telefone").first()
        if phone_contact:
            payload["telefone_tomador"] = phone_contact.value.replace("(", "").replace(")", "").replace("-", "").replace(" ", "")

        return payload
