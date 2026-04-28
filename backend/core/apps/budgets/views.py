# backend/core/apps/budgets/views.py
from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.persons.models import Person

from .models import Budget, BudgetVersion, BudgetVersionItem
from .serializers import (
    BudgetApproveSerializer,
    BudgetCreateSerializer,
    BudgetReadSerializer,
    BudgetVersionItemReadSerializer,
    BudgetVersionItemWriteSerializer,
    BudgetVersionReadSerializer,
)
from .services import BudgetService


class BudgetViewSet(viewsets.ReadOnlyModelViewSet):
    """Listagem/detalhe de Budgets + criação via POST + clone."""

    serializer_class = BudgetReadSerializer
    filterset_fields = ["is_active"]
    search_fields = ["number", "vehicle_plate", "customer__full_name"]
    ordering_fields = ["created_at", "number"]

    def get_queryset(self):  # type: ignore[override]
        return Budget.objects.filter(is_active=True).select_related(
            "customer"
        ).prefetch_related(
            "versions__items__operations__operation_type",
            "versions__items__operations__labor_category",
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def create(self, request) -> Response:  # type: ignore[override]
        ser = BudgetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        customer = get_object_or_404(
            Person, pk=ser.validated_data["customer_id"]
        )
        budget = BudgetService.create(
            customer=customer,
            vehicle_plate=ser.validated_data["vehicle_plate"],
            vehicle_description=ser.validated_data["vehicle_description"],
            vehicle_chassis=ser.validated_data.get("vehicle_chassis", ""),
            vehicle_version=ser.validated_data.get("vehicle_version", ""),
            vehicle_engine=ser.validated_data.get("vehicle_engine", ""),
            vehicle_color=ser.validated_data.get("vehicle_color", ""),
            vehicle_fuel_type=ser.validated_data.get("vehicle_fuel_type", ""),
            vehicle_make_logo=ser.validated_data.get("vehicle_make_logo", ""),
            vehicle_year=ser.validated_data.get("vehicle_year"),
            created_by=request.user.email,
        )
        return Response(
            BudgetReadSerializer(budget).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def clone(self, request, pk: str | None = None) -> Response:
        source = self.get_object()
        new_b = BudgetService.clone(
            source_budget=source,
            created_by=request.user.email,
        )
        return Response(
            BudgetReadSerializer(new_b).data,
            status=status.HTTP_201_CREATED,
        )


class BudgetVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """Versões de um Budget: listagem + actions de fluxo."""

    serializer_class = BudgetVersionReadSerializer
    pagination_class = None  # recurso aninhado — retorna lista direta

    def get_queryset(self):  # type: ignore[override]
        return BudgetVersion.objects.filter(
            budget_id=self.kwargs["budget_pk"],
        ).prefetch_related(
            "items__operations__operation_type",
            "items__operations__labor_category",
        )

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("approve", "reject", "revision"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    @action(detail=True, methods=["post"])
    def send(self, request, budget_pk: str | None = None, pk: str | None = None) -> Response:
        version = self.get_object()
        BudgetService.send_to_customer(
            version=version,
            sent_by=request.user.email,
        )
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def approve(
        self, request, budget_pk: str | None = None, pk: str | None = None,
    ) -> Response:
        version = self.get_object()
        ser = BudgetApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        os_instance = BudgetService.approve(
            version=version,
            approved_by=ser.validated_data["approved_by"],
            evidence_s3_key=ser.validated_data["evidence_s3_key"],
            user=request.user,
        )
        version.refresh_from_db()
        from apps.service_orders.serializers import ServiceOrderListSerializer
        return Response({
            "version": BudgetVersionReadSerializer(version).data,
            "service_order": ServiceOrderListSerializer(os_instance).data,
        })

    @action(detail=True, methods=["post"])
    def reject(
        self, request, budget_pk: str | None = None, pk: str | None = None,
    ) -> Response:
        version = self.get_object()
        BudgetService.reject(version=version)
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def revision(
        self, request, budget_pk: str | None = None, pk: str | None = None,
    ) -> Response:
        version = self.get_object()
        new_v = BudgetService.request_revision(version=version)
        return Response(
            BudgetVersionReadSerializer(new_v).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(
        self, request, budget_pk: str | None = None, pk: str | None = None,
    ) -> HttpResponse:
        """Download do PDF do orçamento."""
        from apps.pdf_engine.services import PDFService

        version = self.get_object()
        pdf_bytes = PDFService.render_budget(version)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="orcamento-{version.budget.number}'
            f'-v{version.version_number}.pdf"'
        )
        return response


class BudgetVersionItemViewSet(viewsets.ModelViewSet):
    """Items de uma BudgetVersion. Writes bloqueados se status != draft."""

    def get_queryset(self):  # type: ignore[override]
        return BudgetVersionItem.objects.filter(
            version_id=self.kwargs["version_pk"],
        ).prefetch_related(
            "operations__operation_type", "operations__labor_category",
        )

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in ("create", "update", "partial_update"):
            return BudgetVersionItemWriteSerializer
        return BudgetVersionItemReadSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        version = get_object_or_404(
            BudgetVersion,
            pk=self.kwargs["version_pk"],
            budget_id=self.kwargs["budget_pk"],
        )
        if version.is_frozen():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"status": "Só pode adicionar itens em versões draft"}
            )
        serializer.save(version=version)

    def perform_update(self, serializer) -> None:  # type: ignore[override]
        if serializer.instance.version.is_frozen():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"status": "Versão imutável — não é possível editar itens"}
            )
        serializer.save()
