"""
Página pública do link remoto do checklist de entrada (WhatsApp).

GET  /api/v1/public/checklist-confirm/{token}/ → {placa, modelo, pdf_url, version}
POST /api/v1/public/checklist-confirm/{token}/ {signer_name} → aceite (REMOTE_LINK)
GET  /api/v1/public/checklist-confirm/{token}/pdf/ → PDF inline, só enquanto o link vale

Sem login: o token é a credencial. O tenant vem do domínio, pelo middleware, como no reset de senha.
Token inexistente → 404; vencido ou já usado → 410 `link_expired`.
"""

from __future__ import annotations

from django.core.files.storage import default_storage
from django.http import FileResponse
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services import checklist_service as svc
from .client_ip import client_ip


class ChecklistConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request: Request, token: str) -> Response:
        checklist = svc.get_by_remote_token(token)
        order = checklist.service_order
        pdf = checklist.pdf
        return Response(
            {
                "placa": order.plate,
                "modelo": f"{order.make} {order.model}".strip(),
                # Nunca a URL do storage: o R2 do deploy é público e não expira com o link.
                "pdf_url": f"/api/v1/public/checklist-confirm/{token}/pdf/" if pdf else None,
                "version": checklist.version,
            }
        )

    def post(self, request: Request, token: str) -> Response:
        signer_name = request.data.get("signer_name")
        signature = svc.confirm_remote(
            token,
            signer_name if isinstance(signer_name, str) else "",
            client_ip(request),
            request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response({"signed_at": signature.signed_at})


class ChecklistConfirmPdfView(APIView):
    """Serve o PDF pelo token: vence, é usado ou reaberto junto com o link."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request: Request, token: str) -> FileResponse:
        checklist = svc.get_by_remote_token(token)
        if checklist.pdf is None:
            raise NotFound()
        response = FileResponse(
            default_storage.open(checklist.pdf.s3_key, "rb"),
            content_type="application/pdf",
            filename=f"checklist-entrada-v{checklist.version}.pdf",
        )
        response["Cache-Control"] = "no-store"
        return response
