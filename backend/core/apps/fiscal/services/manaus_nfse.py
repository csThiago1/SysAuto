"""
Paddock Solutions — Fiscal — ManausNfseBuilder
Ciclo 06C: NFS-e Manaus end-to-end

Constrói o payload Focus /v2/nfse para a Prefeitura de Manaus (IBGE 1302603).
Fonte: spec §7.4 + mapeamento LC 116 §9.1
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

# Module-level imports required for testability with unittest.mock.patch.
# Lazy imports inside functions block @patch — see CLAUDE.md armadilha MO-6.
from apps.persons.models import Person  # noqa: E402

logger = logging.getLogger(__name__)


class NfseBuilderError(Exception):
    """Dados insuficientes para construir payload NFS-e."""


# Mapeamento LC 116 §9.1
# Tipo da OS → código de item LC 116
LC116_MAP: dict[str, str] = {
    "vidracaria": "14.05",  # Instalação de vidros, espelhos, etc.
}
LC116_DEFAULT = "14.01"  # Lubrificação, limpeza, lustração, revisão... (default automotivo)


class ManausNfseBuilder:
    """Constrói payload Focus NFS-e para a Prefeitura de Manaus (IBGE 1302603).

    Fonte: spec §7.4 + mapeamento LC 116 §9.1.

    Raises:
        NfseBuilderError: dados insuficientes (Person sem Document primário,
            sem Address primário, etc.)
    """

    MUNICIPIO_IBGE_MANAUS = "1302603"
    DISCRIMINACAO_MAX = 2000

    @classmethod
    def build(
        cls,
        service_order: ServiceOrder,
        config: FiscalConfigModel,
        ref: str,
        parts_as_service: bool = True,
    ) -> dict[str, Any]:
        """Retorna dict pronto para POST Focus /v2/nfse.

        Args:
            service_order: OS de origem.
            config: configuração fiscal do emissor.
            ref: chave de idempotência já gerada (ex: "12345678-NFSE-20260424-000001").
            parts_as_service: se True, inclui parts_total no valor do serviço (decisão §9.4).
        """
        person = cls._get_person(service_order)
        tomador = cls._get_tomador(person)
        rps = cls._get_rps(ref, config)
        servico = cls._get_servico(service_order, config, parts_as_service)

        return {
            "data_emissao": datetime.now(tz=timezone.utc).isoformat(),
            "prestador": {
                "cnpj": config.cnpj,
                "inscricao_municipal": config.inscricao_municipal,
                "codigo_municipio": cls.MUNICIPIO_IBGE_MANAUS,
            },
            "tomador": tomador,
            "rps": rps,
            "servico": servico,
        }

    @classmethod
    def _get_person(cls, service_order: ServiceOrder) -> Person:
        """Carrega Person a partir do FK customer da OS.

        ServiceOrder.customer é FK para persons.Person (customer_id = PK inteiro).
        """
        customer_id = service_order.customer_id
        if customer_id is None:
            raise NfseBuilderError(
                f"ServiceOrder pk={service_order.pk} não tem customer associado"
            )
        try:
            return Person.objects.prefetch_related(
                "documents", "addresses"
            ).get(pk=customer_id)
        except Person.DoesNotExist:
            raise NfseBuilderError(
                f"Person não encontrado para customer_id={customer_id}"
            )

    @classmethod
    def _get_tomador(cls, person: Person) -> dict[str, Any]:
        """Monta bloco tomador a partir de Person + PersonDocument + PersonAddress.

        Raises:
            NfseBuilderError: sem documento primário ou sem endereço com municipio_ibge.
        """
        # Buscar documento primário (CPF para PF, CNPJ para PJ)
        doc = person.documents.filter(is_primary=True).first()
        if doc is None:
            raise NfseBuilderError(
                f"Person pk={person.pk} não tem PersonDocument primário"
            )

        # Buscar endereço principal; fallback para qualquer endereço
        address = person.addresses.filter(is_primary=True).first()
        if address is None:
            address = person.addresses.first()
        if address is None or not address.municipio_ibge:
            raise NfseBuilderError(
                f"Person pk={person.pk} não tem PersonAddress com municipio_ibge"
            )

        tomador: dict[str, Any] = {
            # Person.full_name é o campo correto (não .name)
            "razao_social": person.full_name,
            "email": "",
        }

        # PersonDocument.value é EncryptedCharField — acesso direto retorna valor descriptografado
        # PersonDocument.doc_type choices: CPF, CNPJ, RG, IE, IM, CNH
        doc_value: str = doc.value  # type: ignore[assignment]
        if doc.doc_type == "CPF":
            tomador["cpf"] = doc_value
        else:
            tomador["cnpj"] = doc_value

        # PersonAddress: street, number, complement, neighborhood, state, zip_code, municipio_ibge
        tomador["endereco"] = {
            "logradouro": address.street or "",
            "numero": address.number or "S/N",
            "complemento": address.complement or "",
            "bairro": address.neighborhood or "",
            "codigo_municipio": address.municipio_ibge,
            "uf": address.state or "AM",
            "cep": (address.zip_code or "").replace("-", ""),
        }

        return tomador

    @classmethod
    def _get_rps(cls, ref: str, config: FiscalConfigModel) -> dict[str, Any]:
        """Monta bloco RPS.

        O número do RPS é extraído do último segmento da ref.
        Ex: "12345678-NFSE-20260424-000042" → numero="42"
        """
        try:
            numero = str(int(ref.split("-")[-1]))
        except (ValueError, IndexError):
            numero = ref
        return {
            "serie": config.serie_rps,
            "numero": numero,
            "tipo": "1",  # RPS — tipo 1 (padrão ABRASF)
        }

    @classmethod
    def _get_servico(
        cls,
        service_order: ServiceOrder,
        config: FiscalConfigModel,
        parts_as_service: bool,
    ) -> dict[str, Any]:
        """Monta bloco servico."""
        services_total = Decimal(str(service_order.services_total or 0))
        parts_total = (
            Decimal(str(service_order.parts_total or 0))
            if parts_as_service
            else Decimal("0")
        )
        valor_total = services_total + parts_total

        aliquota = config.aliquota_iss_default  # ex: Decimal("2.00")
        valor_iss = (valor_total * aliquota / Decimal("100")).quantize(Decimal("0.01"))

        discriminacao = cls._format_discriminacao(service_order, parts_as_service)
        # ServiceOrder.os_type (não "type") — OSType choices: bodywork, warranty, rework, mechanical, aesthetic
        lc116_code = cls._get_lc116_code(
            getattr(service_order, "os_type", None) or ""
        )

        return {
            "valor_servicos": str(valor_total),
            "valor_iss": str(valor_iss),
            "iss_retido": False,
            "item_lista_servico": lc116_code,
            "discriminacao": discriminacao,
            "codigo_municipio": cls.MUNICIPIO_IBGE_MANAUS,
            "aliquota": str(aliquota),
        }

    @classmethod
    def _get_lc116_code(cls, os_type: str) -> str:
        """Mapeia tipo de serviço OS para item LC 116 (§9.1).

        VIDRACARIA → "14.05"; demais automotivos → "14.01".
        """
        return LC116_MAP.get(os_type.lower() if os_type else "", LC116_DEFAULT)

    @classmethod
    def _format_discriminacao(cls, os: ServiceOrder, parts_as_service: bool) -> str:
        """Texto livre da NFS-e (campo discriminacao).

        Inclui: número da OS, veículo, itens de mão de obra, peças se parts_as_service=True.
        Máx: 2000 chars — trunca com log de aviso.

        Campos reais do ServiceOrder:
            number, plate, make (marca), model (modelo), year (ano)
        Related names:
            labor_items (ServiceOrderLabor) — description, quantity, unit_price
            parts       (ServiceOrderPart)  — description, quantity, unit_price
        """
        lines: list[str] = []

        lines.append(f"OS #{getattr(os, 'number', os.pk)}")

        vehicle = " ".join(
            filter(
                None,
                [
                    getattr(os, "make", ""),
                    getattr(os, "model", ""),
                    str(getattr(os, "year", "") or ""),
                    getattr(os, "plate", ""),
                ],
            )
        )
        if vehicle.strip():
            lines.append(f"Veículo: {vehicle.strip()}")

        # Serviços de mão de obra — related_name = "labor_items"
        try:
            for labor in os.labor_items.all():
                desc = getattr(labor, "description", "")
                qty = getattr(labor, "quantity", 1)
                price = getattr(labor, "unit_price", 0)
                if desc:
                    lines.append(f"Serviço: {desc} x{qty} = R${price}")
        except Exception:
            pass  # OS sem labor_items carregados — não travar a emissão

        # Peças (se parts_as_service) — related_name = "parts"
        if parts_as_service:
            try:
                for part in os.parts.all():
                    desc = getattr(part, "description", "")
                    qty = getattr(part, "quantity", 1)
                    price = getattr(part, "unit_price", 0)
                    if desc:
                        lines.append(f"Peça: {desc} x{qty} = R${price}")
            except Exception:
                pass

        text = "\n".join(lines)
        if len(text) > cls.DISCRIMINACAO_MAX:
            logger.warning(
                "ManausNfseBuilder: discriminacao truncada de %d para %d chars",
                len(text),
                cls.DISCRIMINACAO_MAX,
            )
            text = text[: cls.DISCRIMINACAO_MAX]
        return text
