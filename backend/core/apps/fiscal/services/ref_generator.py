"""
Paddock Solutions — Fiscal — ref_generator
Ciclo 06B: Fiscal Foundation

Sequenciador atômico de refs Focus NF-e.
Ref = identificador idempotente da emissão, formato: {cnpj8}-{tipo}-{YYYYMMDD}-{seq6}

Exemplo: '12345678-NFSE-20260423-000042'

Regra: uma ref é reutilizável APENAS se a emissão falhou antes de ser aceita pela
Focus (status 4xx). Após aceita (201), SEMPRE gerar nova ref.
"""

import logging

from django.db import transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)

# Mapeamento tipo de documento → campo sequenciador em FiscalConfigModel
SEQ_FIELD_BY_TYPE: dict[str, str] = {
    "NFSE": "seq_nfse",
    "NFE": "seq_nfe",
    "NFE_DEV": "seq_nfe",  # Devolução usa mesma sequência de NF-e
    "NFCE": "seq_nfce",
}


def next_fiscal_ref(config: "FiscalConfigModel", doc_type: str) -> tuple[str, int]:  # type: ignore[name-defined]
    """Gera ref única e incrementa sequenciador atomicamente.

    Args:
        config: FiscalConfigModel do emissor.
        doc_type: Um de NFSE, NFE, NFE_DEV, NFCE.

    Returns:
        Tupla (ref, seq) onde:
        - ref: string no formato '{cnpj8}-{doc_type}-{YYYYMMDD}-{seq6:06d}'
        - seq: número inteiro do sequenciador (igual ao numero_rps para NFS-e)

    Raises:
        ValueError: Se doc_type não for suportado.

    Exemplo:
        >>> ref, seq = next_fiscal_ref(config, "NFSE")
        >>> ref
        '12345678-NFSE-20260423-000001'
        >>> seq
        1
    """
    # Import local para evitar import circular
    from apps.fiscal.models import FiscalConfigModel

    field = SEQ_FIELD_BY_TYPE.get(doc_type)
    if field is None:
        raise ValueError(
            f"doc_type não suportado: {doc_type!r}. "
            f"Valores válidos: {list(SEQ_FIELD_BY_TYPE.keys())}"
        )

    today = timezone.now().strftime("%Y%m%d")

    with transaction.atomic():
        # select_for_update via .update() — lock otimizado sem SELECT
        FiscalConfigModel.objects.filter(pk=config.pk).select_for_update().update(
            **{field: F(field) + 1}
        )
        config.refresh_from_db(fields=[field])

    # O valor atual já foi incrementado; seq = valor atual - 1 (era o anterior)
    seq = getattr(config, field) - 1
    ref = f"{config.cnpj[:8]}-{doc_type}-{today}-{seq:06d}"

    logger.debug("Gerada ref fiscal: %s (field=%s, seq=%d)", ref, field, seq)

    return ref, seq
