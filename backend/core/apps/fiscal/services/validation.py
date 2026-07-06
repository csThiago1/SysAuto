"""Preflight de faturamento — valida dados fiscais ANTES de emitir NF-e/NFS-e.

Espelha as checagens dos builders (manaus_nfse, nfe_builder) sem emitir nada,
retornando TODOS os problemas de uma vez para correção inline no frontend.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

ERROR = "error"
WARNING = "warning"


def _issue(code: str, message: str, severity: str = ERROR, **extra: Any) -> dict[str, Any]:
    return {"code": code, "severity": severity, "message": message, **extra}


def validate_service_order_for_billing(service_order: Any) -> list[dict[str, Any]]:
    """Valida OS para faturamento. Retorna lista de issues (vazia = pronto).

    Checa: valor faturável, FiscalConfig do emissor, destinatário
    (CPF/CNPJ, endereço com código IBGE) e NCM das peças (NF-e).
    """
    from decimal import Decimal

    from apps.fiscal.models import FiscalConfigModel
    from apps.fiscal.services.fiscal_service import FiscalService
    from apps.fiscal.services.manaus_nfse import NfseBuilderError
    from apps.service_orders.models import ServiceOrderPart

    issues: list[dict[str, Any]] = []

    parts = list(
        ServiceOrderPart.objects.filter(
            service_order=service_order, is_active=True
        ).select_related("product")
    )
    has_parts = bool(parts)
    has_services = (service_order.services_total or Decimal("0")) > 0

    if not has_parts and not has_services:
        issues.append(_issue(
            "no_billable_value",
            "OS sem serviços nem peças para faturar.",
        ))
        return issues

    # ── Emissor (FiscalConfig) ────────────────────────────────────────────
    try:
        config = FiscalService.get_config()
    except FiscalConfigModel.DoesNotExist:
        config = None
        issues.append(_issue(
            "config_missing",
            "Nenhum emissor fiscal cadastrado. Configure o FiscalConfig antes de faturar.",
        ))

    if config is not None:
        if not config.focus_token:
            issues.append(_issue(
                "config_no_token", "Emissor sem token Focus NF-e configurado.",
            ))
        if not config.razao_social:
            issues.append(_issue(
                "config_no_razao_social",
                "Emissor sem razão social. Deve ser idêntica ao cadastro SEFAZ (erro 980).",
            ))
        if has_services and not config.inscricao_municipal:
            issues.append(_issue(
                "config_no_im",
                "Emissor sem inscrição municipal — obrigatória para NFS-e.",
            ))
        if has_parts and not config.inscricao_estadual:
            issues.append(_issue(
                "config_no_ie",
                "Emissor sem inscrição estadual — obrigatória para NF-e.",
            ))
        if has_parts and not (config.nfe_logradouro and config.nfe_cep):
            issues.append(_issue(
                "config_no_endereco_nfe",
                "Emissor sem endereço NF-e completo (logradouro/CEP).",
            ))

    # ── Destinatário ──────────────────────────────────────────────────────
    person = None
    try:
        person = FiscalService._get_person_for_os(service_order)
    except NfseBuilderError:
        issues.append(_issue(
            "customer_missing",
            "OS sem cliente vinculado ao cadastro de pessoas.",
        ))
    except Exception as exc:  # Person.DoesNotExist com FK órfã
        logger.warning("validate_for_billing: falha ao resolver Person: %s", exc)
        issues.append(_issue(
            "customer_missing",
            "Cliente da OS não encontrado no cadastro de pessoas.",
        ))

    if person is not None:
        from apps.persons.models import TipoDocumento

        doc = (
            person.documents.filter(is_primary=True).first()
            or person.documents.filter(
                doc_type__in=[TipoDocumento.CPF, TipoDocumento.CNPJ]
            ).first()
        )
        if doc is None:
            issues.append(_issue(
                "customer_no_document",
                f"Cliente {person.full_name} sem CPF/CNPJ cadastrado.",
                person_id=person.pk,
            ))

        address = person.addresses.filter(is_primary=True).first() or person.addresses.first()
        if address is None:
            issues.append(_issue(
                "customer_no_address",
                f"Cliente {person.full_name} sem endereço cadastrado.",
                person_id=person.pk,
            ))
        else:
            ibge = (address.municipio_ibge or "").strip()
            if len(ibge) != 7 or not ibge.isdigit():
                issues.append(_issue(
                    "customer_no_ibge",
                    f"Endereço de {person.full_name} sem código IBGE do município "
                    "(7 dígitos) — obrigatório na NFS-e.",
                    person_id=person.pk,
                ))

    # ── NCM das peças (NF-e) ──────────────────────────────────────────────
    if has_parts:
        missing = []
        for part in parts:
            # Mesma resolução de _items_from_os: catálogo primeiro, campo da peça depois.
            ncm = ""
            if part.product_id:
                ncm = getattr(part.product, "ncm", "") or ""
            if not ncm:
                ncm = getattr(part, "ncm", "") or ""
            ncm = ncm.strip()
            if len(ncm) != 8 or not ncm.isdigit():
                missing.append({
                    "part_id": str(part.pk),
                    "description": part.description or "",
                    "ncm": ncm,
                })
        if missing:
            issues.append(_issue(
                "part_missing_ncm",
                f"{len(missing)} peça(s) sem NCM válido (8 dígitos) — NF-e será rejeitada.",
                parts=missing,
            ))

    return issues
