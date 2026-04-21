# apps/budgets/views.py
from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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
    """Listagem/detalhe de Budgets particulares. Criação via POST + actions."""

    queryset = Budget.objects.filter(is_active=True).select_related("customer").prefetch_related(
        "versions__items__operations__operation_type",
        "versions__items__operations__labor_category",
    )
    serializer_class = BudgetReadSerializer
    filterset_fields = ["customer", "is_active"]
    search_fields = ["number", "vehicle_plate", "customer__full_name"]
    ordering_fields = ["created_at", "number"]

    def create(self, request) -> Response:
        ser = BudgetCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        customer = get_object_or_404(Person, pk=ser.validated_data["customer_id"])
        budget = BudgetService.create(
            customer=customer,
            vehicle_plate=ser.validated_data["vehicle_plate"],
            vehicle_description=ser.validated_data["vehicle_description"],
            created_by=request.user.username,
        )
        return Response(BudgetReadSerializer(budget).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def clone(self, request, pk: str | None = None) -> Response:
        source = self.get_object()
        new_b = BudgetService.clone(source_budget=source, created_by=request.user.username)
        return Response(BudgetReadSerializer(new_b).data, status=status.HTTP_201_CREATED)


class BudgetVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """Versões de um Budget. Listagem + actions."""

    serializer_class = BudgetVersionReadSerializer

    def get_queryset(self):
        return BudgetVersion.objects.filter(
            budget_id=self.kwargs["budget_pk"],
        ).prefetch_related(
            "items__operations__operation_type",
            "items__operations__labor_category",
        )

    @action(detail=True, methods=["post"])
    def send(self, request, budget_pk: str | None = None, pk: str | None = None) -> Response:
        version = self.get_object()
        BudgetService.send_to_customer(version=version, sent_by=request.user.username)
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, budget_pk: str | None = None, pk: str | None = None) -> Response:
        version = self.get_object()
        ser = BudgetApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        os_instance = BudgetService.approve(
            version=version,
            approved_by=ser.validated_data["approved_by"],
            evidence_s3_key=ser.validated_data["evidence_s3_key"],
        )
        version.refresh_from_db()
        # lazy import to avoid circular import with service_orders app
        from apps.service_orders.serializers import ServiceOrderReadSerializer

        return Response({
            "version": BudgetVersionReadSerializer(version).data,
            "service_order": ServiceOrderReadSerializer(os_instance).data,
        })

    @action(detail=True, methods=["post"])
    def reject(self, request, budget_pk: str | None = None, pk: str | None = None) -> Response:
        version = self.get_object()
        BudgetService.reject(version=version)
        version.refresh_from_db()
        return Response(BudgetVersionReadSerializer(version).data)

    @action(detail=True, methods=["post"])
    def revision(self, request, budget_pk: str | None = None, pk: str | None = None) -> Response:
        version = self.get_object()
        new_v = BudgetService.request_revision(version=version)
        return Response(BudgetVersionReadSerializer(new_v).data, status=status.HTTP_201_CREATED)


class BudgetVersionItemViewSet(viewsets.ModelViewSet):
    """Items de uma BudgetVersion. Writes só quando status=draft."""

    def get_queryset(self):
        return BudgetVersionItem.objects.filter(
            version_id=self.kwargs["version_pk"],
        ).prefetch_related("operations__operation_type", "operations__labor_category")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BudgetVersionItemWriteSerializer
        return BudgetVersionItemReadSerializer

    def perform_create(self, serializer) -> None:
        version = get_object_or_404(
            BudgetVersion,
            pk=self.kwargs["version_pk"],
            budget_id=self.kwargs["budget_pk"],
        )
        if version.status != "draft":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"status": "Só pode adicionar items em draft"})
        serializer.save(version=version)
