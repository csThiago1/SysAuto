"""Orquestra preview → validação → render → S3 → audit."""
from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max

from apps.documents.constants import DOCUMENT_S3_PREFIX
from apps.documents.data_loaders import OSDataLoader
from apps.documents.models import DocumentGeneration, DocumentType
from apps.pdf_engine.services import PDFService

logger = logging.getLogger(__name__)

_PREVIEW_LOADERS = {
    DocumentType.OS_REPORT: lambda oid, **kw: OSDataLoader.load_os_report(oid),
    DocumentType.WARRANTY: lambda oid, **kw: OSDataLoader.load_warranty(oid),
    DocumentType.SETTLEMENT: lambda oid, **kw: OSDataLoader.load_settlement(oid),
    DocumentType.RECEIPT: lambda oid, **kw: OSDataLoader.load_receipt(oid, kw["receivable_id"]),
}


class DocumentService:
    """Orquestra geração de documentos PDF com auditoria."""

    @classmethod
    def preview(cls, order_id: UUID, document_type: str, receivable_id: UUID | None = None) -> dict[str, Any]:
        loader = _PREVIEW_LOADERS.get(document_type)
        if not loader:
            raise ValueError(f"Tipo de documento desconhecido: {document_type}")
        kwargs: dict[str, Any] = {}
        if receivable_id:
            kwargs["receivable_id"] = receivable_id
        return loader(order_id, **kwargs)

    @classmethod
    @transaction.atomic
    def generate(cls, order_id: UUID, document_type: str, data: dict[str, Any], user: Any, receivable_id: UUID | None = None) -> DocumentGeneration:
        from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog

        order = ServiceOrder.objects.get(pk=order_id, is_active=True)

        current_max = DocumentGeneration.objects.filter(
            service_order=order,
            document_type=document_type,
        ).aggregate(max_v=Max("version"))["max_v"] or 0
        next_version = current_max + 1

        pdf_bytes = PDFService.render_document(document_type, data)

        short_id = uuid.uuid4().hex[:8]
        s3_key = f"{DOCUMENT_S3_PREFIX}/os-{order.number}/{document_type}/v{next_version}-{short_id}.pdf"
        default_storage.save(s3_key, ContentFile(pdf_bytes))

        doc = DocumentGeneration.objects.create(
            document_type=document_type,
            version=next_version,
            service_order=order,
            receivable_id=receivable_id,
            data_snapshot=data,
            s3_key=s3_key,
            file_size_bytes=len(pdf_bytes),
            generated_by=user,
            created_by=user,
        )

        type_label = dict(DocumentType.choices).get(document_type, document_type)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user=user,
            activity_type="document_generated",
            description=f"{type_label} v{next_version} gerado",
            metadata={
                "document_id": str(doc.pk),
                "document_type": document_type,
                "version": next_version,
            },
        )

        logger.info("Documento %s v%d gerado para OS #%s por %s", document_type, next_version, order.number, user)
        return doc

    @classmethod
    def regenerate_from_snapshot(cls, doc_id: UUID) -> bytes:
        doc = DocumentGeneration.objects.get(pk=doc_id)
        return PDFService.render_document(doc.document_type, doc.data_snapshot)

    @classmethod
    def download(cls, doc_id: UUID) -> tuple[bytes, str]:
        doc = DocumentGeneration.objects.select_related("service_order").get(pk=doc_id)
        f = default_storage.open(doc.s3_key, "rb")
        pdf_bytes = f.read()
        f.close()
        filename = f"os-{doc.service_order.number}-{doc.document_type}-v{doc.version}.pdf"
        return pdf_bytes, filename
