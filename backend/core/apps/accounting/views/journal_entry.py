"""
Paddock Solutions — Accounting: ViewSet de Lancamentos Contabeis

Regras criticas:
  - DELETE e PROIBIDO (HTTP 405) — lancamentos sao imutaveis
  - Criacao delegada ao JournalEntryService (nunca salvar direto)
  - Aprovacao e estorno via actions dedicadas
"""
import logging
from typing import Any

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.accounting.filters import JournalEntryFilter
from apps.accounting.models.journal_entry import JournalEntry
from apps.accounting.serializers.journal_entry import (
    JournalEntryCreateSerializer,
    JournalEntryDetailSerializer,
    JournalEntryListSerializer,
)
from apps.accounting.services.journal_entry_service import JournalEntryService

logger = logging.getLogger(__name__)


class JournalEntryViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """
    Gerenciamento de lancamentos contabeis.

    list     GET  /accounting/journal-entries/
    retrieve GET  /accounting/journal-entries/{id}/
    create   POST /accounting/journal-entries/
    approve  POST /accounting/journal-entries/{id}/approve/
    reverse  POST /accounting/journal-entries/{id}/reverse/
    DELETE: HTTP 405 — lancamentos sao imutaveis
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = JournalEntryFilter
    search_fields = ["number", "description"]
    ordering_fields = ["competence_date", "number"]

    def get_queryset(self) -> Any:
        return (
            JournalEntry.objects.select_related(
                "fiscal_period__fiscal_year",
                "approved_by",
                "created_by",
            )
            .filter(is_active=True)
            .order_by("-competence_date", "-number")
        )

    def get_serializer_class(self) -> Any:
        if self.action == "create":
            return JournalEntryCreateSerializer
        if self.action == "retrieve":
            return JournalEntryDetailSerializer
        return JournalEntryListSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Cria lancamento via JournalEntryService — nunca salva direto."""
        serializer = JournalEntryCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        try:
            entry = serializer.save()
        except Exception as exc:
            logger.warning("JournalEntryViewSet.create: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            JournalEntryDetailSerializer(entry, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request: Request, pk: str | None = None) -> Response:
        """
        Aprova o lancamento manual.

        Valida balanceamento e muda is_approved=True.
        """
        entry = self.get_object()
        try:
            entry = JournalEntryService.approve_entry(entry, user=request.user)
        except Exception as exc:
            logger.warning("JournalEntryViewSet.approve: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        logger.info("JournalEntry %s aprovado por %s", entry.number, request.user.id)
        return Response(
            JournalEntryDetailSerializer(entry, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], url_path="reverse")
    def reverse(self, request: Request, pk: str | None = None) -> Response:
        """
        Estorna o lancamento (cria lancamento inverso).

        Body JSON (opcional):
            description: str — descricao do estorno.
        """
        entry = self.get_object()
        description = request.data.get("description")
        try:
            reversal = JournalEntryService.reverse_entry(
                entry, user=request.user, description=description
            )
        except Exception as exc:
            logger.warning("JournalEntryViewSet.reverse: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        logger.info(
            "JournalEntry %s estornado por %s -> %s",
            entry.number,
            request.user.id,
            reversal.number,
        )
        return Response(
            JournalEntryDetailSerializer(reversal, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """DELETE e PROIBIDO — lancamentos contabeis sao imutaveis."""
        return Response(
            {"detail": "Lançamentos contábeis não podem ser deletados."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
