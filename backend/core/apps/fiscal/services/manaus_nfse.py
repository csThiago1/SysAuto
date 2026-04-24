"""
Paddock Solutions — Fiscal — Builders NFS-e Manaus
Ciclo 06C: NFS-e end-to-end para a Prefeitura de Manaus (IBGE 1302603)

ManausNfseBuilder : constrói payload a partir de OS + Person + FiscalConfigModel
ManualNfseBuilder : constrói payload a partir de ManualNfseInputSerializer.validated_data
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

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
# Focus Manaus exige 6 dígitos numéricos (XXYYZZ) sem pontos.
_LC116_MAP: dict[str, str] = {
    "vidros": "140500",  # 14.05 → Restauração de vidros
}
_LC116_DEFAULT = "140100"  # 14.01 → Manutenção/conservação de veículos


def _normalize_lc116(code: str) -> str:
    """Converte código LC 116 human-readable para 6 dígitos sem ponto.

    Ex: '14.01' → '140100', '1401' → '140100', '140100' → '140100'.
    """
    digits = code.replace(".", "").strip()
    return digits.ljust(6, "0")[:6]

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
        parts_as_service: bool = True,
    ) -> dict[str, Any]:
        """Retorna dict pronto para POST Focus /v2/nfse.

        Args:
            service_order: OS com destinatario carregado via destinatario.documents /
                destinatario.addresses (prefetch feito pelo chamador).
            config: emissor fiscal ativo.
            ref: identificador de idempotência (ex: "12345678-NFSE-20260424-000001").
            parts_as_service: se True, soma parts_total ao valor dos serviços na NFS-e.
                Decisão contábil §9.4 — default True (peças entram na NFS-e de serviço).
        """
        if service_order.destinatario is None:
            raise NfseBuilderError("ServiceOrder sem destinatario vinculado.")

        person: "Person" = service_order.destinatario

        tomador = cls._get_tomador(person)
        servico = cls._get_servico(service_order, config, parts_as_service)
        rps = cls._get_rps(ref, config)

        return {
            "data_emissao": datetime.now(tz=timezone.utc).isoformat(),
            "prestador": {
                "cnpj": config.cnpj,
                "inscricao_municipal": config.inscricao_municipal,
                "codigo_municipio": MUNICIPIO_IBGE_MANAUS,
            },
            "tomador": tomador,
            "servico": servico,
            "rps": rps,
        }

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
                for item in service_order.part_items.all():
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
    """Constrói payload NFS-e a partir de ManualNfseInputSerializer.validated_data.

    Diferente do ManausNfseBuilder: origem é formulário livre, não OS.

    Raises:
        NfseBuilderError: Person sem documento primário ou sem endereço com municipio_ibge.
    """

    @classmethod
    def build(
        cls,
        input_data: dict[str, Any],
        person: "Person",
        config: "FiscalConfigModel",
        ref: str,
    ) -> dict[str, Any]:
        """Retorna dict pronto para POST Focus /v2/nfse.

        Args:
            input_data: validated_data de ManualNfseInputSerializer.
            person: destinatário já carregado (documents + addresses prefetch pelo chamador).
            config: emissor fiscal ativo.
            ref: identificador de idempotência.
        """
        from decimal import Decimal

        tomador = ManausNfseBuilder._get_tomador(person)
        rps = ManausNfseBuilder._get_rps(ref, config)

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
        iss_retido: bool = input_data.get("iss_retido", False)

        if iss_retido:
            valor_iss = (valor_servicos * aliquota_iss / Decimal("100")).quantize(Decimal("0.01"))
        else:
            valor_iss = Decimal("0")

        valor_liquido = valor_servicos - valor_iss

        lc116_code = _normalize_lc116(input_data.get("codigo_servico_lc116", _LC116_DEFAULT))
        discriminacao = input_data.get("discriminacao", "Serviços diversos")
        observacoes = input_data.get("observacoes_contribuinte", "")
        if observacoes:
            discriminacao = f"{discriminacao} | {observacoes}"
        discriminacao = discriminacao[:_MAX_DISCRIMINACAO_CHARS]

        # data_emissao: None = agora
        data_emissao_raw = input_data.get("data_emissao")
        if data_emissao_raw:
            if hasattr(data_emissao_raw, "isoformat"):
                data_emissao = data_emissao_raw.isoformat()
            else:
                data_emissao = str(data_emissao_raw)
        else:
            data_emissao = datetime.now(tz=timezone.utc).isoformat()

        return {
            "data_emissao": data_emissao,
            "prestador": {
                "cnpj": config.cnpj,
                "inscricao_municipal": config.inscricao_municipal,
                "codigo_municipio": MUNICIPIO_IBGE_MANAUS,
            },
            "tomador": tomador,
            "servico": {
                "valor_servicos": str(valor_servicos.quantize(Decimal("0.01"))),
                "valor_iss": str(valor_iss),
                "valor_liquido_nfse": str(valor_liquido.quantize(Decimal("0.01"))),
                "aliquota": str(aliquota_iss),
                "iss_retido": iss_retido,
                "item_lista_servico": lc116_code,
                "codigo_tributacao_municipio": lc116_code,
                "discriminacao": discriminacao,
                "codigo_municipio": MUNICIPIO_IBGE_MANAUS,
            },
            "rps": rps,
        }
