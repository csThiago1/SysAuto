"""
Paddock Solutions — Accounting: endpoint de sugestão de conta contábil.
"""

import logging
from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounting.services.account_suggestion_service import suggest_account
from apps.authentication.permissions import IsConsultantOrAbove

logger = logging.getLogger(__name__)


class SuggestAccountView(APIView):
    """
    GET /api/v1/accounting/suggest-account/?q=tesoura

    Devolve a conta contábil sugerida para uma descrição de despesa, ou {}
    quando não há sugestão confiável. Nunca falha por causa da LLM.
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    @extend_schema(
        summary="Sugere conta contábil a partir da descrição da despesa",
        parameters=[
            OpenApiParameter("q", description="Descrição da despesa", required=True),
        ],
    )
    def get(self, request: Request) -> Response:
        """Resolve a sugestão para o termo em `q`."""
        query = request.query_params.get("q", "").strip()
        if len(query) < 3:
            return Response({})

        suggestion = suggest_account(query)
        if suggestion is None:
            return Response({})

        payload: dict[str, Any] = {
            "account_id": str(suggestion.account.id),
            "code": suggestion.account.code,
            "name": suggestion.account.name,
            "source": suggestion.source,
        }
        return Response(payload)
