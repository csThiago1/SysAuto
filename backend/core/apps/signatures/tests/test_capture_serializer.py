"""Regressão: choices do CaptureSignatureSerializer alinhadas com o model."""

import uuid

from apps.signatures.models import Signature
from apps.signatures.serializers import CaptureSignatureSerializer

BASE = {
    "method": "CANVAS_TABLET",
    "signer_name": "Cliente Teste",
    "signature_png_base64": "aWJvcmE=",
    "service_order_id": str(uuid.uuid4()),
}


def test_aceita_todos_os_document_types_do_model() -> None:
    """Toda choice do model deve passar no serializer (VISTORIA_ENTRADA já faltou)."""
    for doc_type, _label in Signature.DOC_TYPE_CHOICES:
        ser = CaptureSignatureSerializer(data={**BASE, "document_type": doc_type})
        assert ser.is_valid(), f"{doc_type}: {ser.errors}"


def test_exige_service_order_ou_orcamento() -> None:
    data = {k: v for k, v in BASE.items() if k != "service_order_id"}
    ser = CaptureSignatureSerializer(data={**data, "document_type": "OS_OPEN"})
    assert not ser.is_valid()
