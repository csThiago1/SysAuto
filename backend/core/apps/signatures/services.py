"""Service layer para captura de assinaturas digitais."""
from __future__ import annotations

import base64
import hashlib
import json
import logging

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.service_orders.events import OSEventLogger
from apps.service_orders.models import ServiceOrder

from .models import Signature


logger = logging.getLogger(__name__)


class SignatureService:
    """Captura assinatura (canvas/remote/scan) com hash de integridade."""

    @classmethod
    @transaction.atomic
    def capture(
        cls,
        *,
        document_type: str,
        method: str,
        signer_name: str,
        signature_png_base64: str,
        service_order: ServiceOrder | None = None,
        budget=None,
        signer_cpf: str = "",
        ip_address: str | None = None,
        user_agent: str = "",
        remote_token: str = "",
        notes: str = "",
    ) -> Signature:
        """Captura assinatura e emite evento SIGNATURE_CAPTURED.

        Args:
            document_type: choice de DOC_TYPE_CHOICES
            method: CANVAS_TABLET | REMOTE_LINK | SCAN_PDF
            signer_name: nome do assinante
            signature_png_base64: PNG da assinatura em base64
            service_order ou budget: ao menos um obrigatório
            demais: metadados opcionais

        Raises:
            ValidationError: se nem service_order nem budget fornecidos,
                ou se PNG inválido.
        """
        if service_order is None and budget is None:
            raise ValidationError(
                {"owner": "Informe service_order ou budget."},
            )

        # Valida que o base64 é PNG decodificável
        try:
            png_bytes = base64.b64decode(signature_png_base64, validate=True)
        except Exception as exc:
            raise ValidationError({"signature_png_base64": f"Base64 inválido: {exc}"})

        if len(png_bytes) < 100:
            raise ValidationError(
                {"signature_png_base64": "PNG muito pequeno — assinatura inválida."},
            )

        # Hash — PNG + metadados críticos (anti-tampering)
        signature_hash = cls._compute_hash(
            png_bytes=png_bytes,
            document_type=document_type,
            signer_name=signer_name,
            service_order_id=getattr(service_order, "pk", None),
            budget_id=getattr(budget, "pk", None),
        )

        signature = Signature.objects.create(
            service_order=service_order,
            budget=budget,
            document_type=document_type,
            method=method,
            signer_name=signer_name,
            signer_cpf=signer_cpf,
            signature_png_base64=signature_png_base64,
            signature_hash=signature_hash,
            ip_address=ip_address,
            user_agent=user_agent[:400],
            remote_token=remote_token,
            notes=notes,
        )

        # Evento na timeline
        if service_order is not None:
            OSEventLogger.log_event(
                service_order,
                "SIGNATURE_CAPTURED",
                actor=signer_name,
                payload={
                    "signature_id": signature.pk,
                    "document_type": document_type,
                    "method": method,
                    "hash": signature_hash[:16],
                },
            )
        return signature

    @staticmethod
    def _compute_hash(
        *,
        png_bytes: bytes,
        document_type: str,
        signer_name: str,
        service_order_id: int | None,
        budget_id: int | None,
    ) -> str:
        """SHA256 do PNG concatenado com metadados críticos.

        Qualquer alteração posterior (ex: trocar PNG via admin) quebra o hash
        e evidencia adulteração.
        """
        metadata = json.dumps(
            {
                "document_type": document_type,
                "signer_name": signer_name,
                "service_order_id": service_order_id,
                "budget_id": budget_id,
            },
            sort_keys=True,
        ).encode("utf-8")

        h = hashlib.sha256()
        h.update(png_bytes)
        h.update(b"\x00")  # separador
        h.update(metadata)
        return h.hexdigest()

    @classmethod
    def verify_integrity(cls, signature: Signature) -> bool:
        """Recomputa hash e compara com armazenado. Retorna True se íntegro."""
        try:
            png_bytes = base64.b64decode(signature.signature_png_base64, validate=True)
        except Exception:
            return False

        expected = cls._compute_hash(
            png_bytes=png_bytes,
            document_type=signature.document_type,
            signer_name=signature.signer_name,
            service_order_id=signature.service_order_id,
            budget_id=signature.budget_id,
        )
        return expected == signature.signature_hash
