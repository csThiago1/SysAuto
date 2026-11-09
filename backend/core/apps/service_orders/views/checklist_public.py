"""
Página pública do link remoto do checklist de entrada (WhatsApp).

GET  /api/v1/public/checklist-confirm/{token}/ → {placa, modelo, pdf_url, version}
POST /api/v1/public/checklist-confirm/{token}/ {signer_name} → aceite (REMOTE_LINK)

Sem login: o token é a credencial. O tenant vem do domínio, pelo middleware, como no reset de senha.
Token inexistente → 404; vencido ou já usado → 410 `link_expired`.
"""

from __future__ import annotations

from django.core.files.storage import default_storage
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services import checklist_service as svc


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
                # URL do storage (assinada no S3): o download da API exige login.
                "pdf_url": default_storage.url(pdf.s3_key) if pdf else None,
                "version": checklist.version,
            }
        )

    def post(self, request: Request, token: str) -> Response:
        signer_name = request.data.get("signer_name")
        signature = svc.confirm_remote(
            token,
            signer_name if isinstance(signer_name, str) else "",
            request.META.get("REMOTE_ADDR"),
            request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response({"signed_at": signature.signed_at})
