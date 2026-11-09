"""
Checklist de entrada 3D — estado, danos e pertences (aninhados na OS).

GET/PATCH /service-orders/{os}/checklist/entrada/           · GET …/history/
POST …/checklist/entrada/finalize/ {snapshots} (os.edit)    · POST …/reopen/ {reason} (MANAGER+)
POST …/checklist/entrada/sign/ {signer_name, signature_png_base64} · POST …/send-remote/ (os.edit)

GET/POST /service-orders/{os}/checklist-damages/            · PATCH …/{id}/ · POST …/{id}/deactivate/
GET/POST /service-orders/{os}/belongings/                   · PATCH …/{id}/ · POST …/{id}/return/
POST /service-orders/{os}/checklist/budget-match/ (os.edit) · POST …/budget-match/report/ → {pdf_url}
GET/POST /service-orders/checklist/panel-rules/ (ADMIN+)     · POST é upsert por pattern
Sem DELETE: desativar é soft delete.
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict

from django.db.models import Count, Q, QuerySet, Value
from django.db.models.functions import Replace, Upper
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.authentication.permissions import HasTenantPermission, IsAdminOrAbove, IsManagerOrAbove
from apps.documents.models import DocumentType
from apps.documents.services import DocumentService

from ..models import (
    BudgetPanelRule,
    ChecklistDamage,
    CustomerBelonging,
    EntryChecklist,
    ServiceOrder,
)
from ..models.checklist import ENTRY
from ..serializers.checklist import (
    BudgetPanelRuleSerializer,
    ChecklistDamageSerializer,
    ChecklistHistorySerializer,
    CustomerBelongingSerializer,
    EntryChecklistStateSerializer,
    pdf_url,
)
from ..services import checklist_service as svc
from ..services.budget_match import report_data, run_budget_match

logger = logging.getLogger(__name__)


class _ChecklistChildViewSet(GenericViewSet):
    """Base: escopo pela OS da URL, leitura os.view, escrita os.edit."""

    def get_permissions(self) -> list:  # type: ignore[override]
        code = "os.view" if self.action == "list" else "os.edit"
        return [IsAuthenticated(), HasTenantPermission(code)]

    def get_order(self) -> ServiceOrder:
        return get_object_or_404(ServiceOrder, pk=self.kwargs["service_order_pk"])

    def _respond(self, instance: object, created: bool = False) -> Response:
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(instance).data, status=code)

    def list(self, request: Request, **kwargs: object) -> Response:
        return Response(self.get_serializer(self.get_queryset(), many=True).data)


class ChecklistDamageViewSet(_ChecklistChildViewSet):
    serializer_class = ChecklistDamageSerializer

    def get_queryset(self) -> QuerySet[ChecklistDamage]:  # type: ignore[override]
        return (
            ChecklistDamage.objects.filter(
                service_order_id=self.kwargs["service_order_pk"], is_active=True
            )
            .prefetch_related("photos")
            .order_by("number")
        )

    def create(self, request: Request, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        damage, created = svc.create_damage(
            self.get_order(), serializer.validated_data, request.user
        )
        return self._respond(damage, created)

    def partial_update(self, request: Request, **kwargs: object) -> Response:
        damage = self.get_object()
        serializer = self.get_serializer(damage, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self._respond(svc.update_damage(damage, serializer.validated_data))

    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, **kwargs: object) -> Response:
        return self._respond(svc.deactivate_damage(self.get_object()))


class CustomerBelongingViewSet(_ChecklistChildViewSet):
    serializer_class = CustomerBelongingSerializer

    def get_queryset(self) -> QuerySet[CustomerBelonging]:  # type: ignore[override]
        return (
            CustomerBelonging.objects.filter(
                service_order_id=self.kwargs["service_order_pk"], is_active=True
            )
            .select_related("photo")
            .order_by("created_at")
        )

    def create(self, request: Request, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        belonging, created = svc.create_belonging(
            self.get_order(), serializer.validated_data, request.user
        )
        return self._respond(belonging, created)

    def partial_update(self, request: Request, **kwargs: object) -> Response:
        belonging = self.get_object()
        serializer = self.get_serializer(belonging, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self._respond(svc.update_belonging(belonging, serializer.validated_data))

    @action(detail=True, methods=["post"], url_path="return", url_name="return")
    def return_(self, request: Request, **kwargs: object) -> Response:
        return self._respond(svc.return_belonging(self.get_object(), request.user))


class _ChecklistTypeView(APIView):
    """Base: `checklist_type` da URL só aceita `entrada`; leitura os.view, escrita os.edit."""

    def get_permissions(self) -> list:  # type: ignore[override]
        code = "os.view" if self.request.method == "GET" else "os.edit"
        return [IsAuthenticated(), HasTenantPermission(code)]

    def get_order(self) -> ServiceOrder:
        # ponytail: só "entrada" por enquanto; saída entra quando existir o fluxo
        if self.kwargs["checklist_type"] != ENTRY:
            raise Http404
        return get_object_or_404(ServiceOrder, pk=self.kwargs["service_order_pk"])


class EntryChecklistStateView(_ChecklistTypeView):
    def get(self, request: Request, **kwargs: object) -> Response:
        checklist = svc.get_or_create_checklist(self.get_order())
        return Response(EntryChecklistStateSerializer(checklist).data)

    def patch(self, request: Request, **kwargs: object) -> Response:
        order = self.get_order()
        serializer = EntryChecklistStateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        checklist = svc.update_checklist_state(order, serializer.validated_data)
        return Response(EntryChecklistStateSerializer(checklist).data)


class EntryChecklistHistoryView(_ChecklistTypeView):
    """Checklists finalizados de outras OS da mesma placa, mais recentes primeiro."""

    def get(self, request: Request, **kwargs: object) -> Response:
        order = self.get_order()
        plate = re.sub(r"[^A-Z0-9]", "", (order.plate or "").upper())
        if len(plate) < 7:  # vazia ou coringa ("N/A") — não cruza OS de outros clientes
            return Response([])
        # ponytail: lado do banco só tira "-" e espaço (formatos reais de placa).
        stored_plate = Upper(
            Replace(Replace("service_order__plate", Value("-"), Value("")), Value(" "), Value(""))
        )
        checklists = (
            EntryChecklist.objects.annotate(norm_plate=stored_plate)
            .filter(
                checklist_type=ENTRY,
                finalized_at__isnull=False,
                norm_plate=plate,
                service_order__is_active=True,
            )
            .exclude(service_order=order)
            .select_related("service_order")
            .annotate(
                damage_count=Count(
                    "service_order__checklist_damages",
                    filter=Q(
                        service_order__checklist_damages__is_active=True,
                        service_order__checklist_damages__checklist_type=ENTRY,
                    ),
                )
            )
            .order_by("-finalized_at")
        )
        return Response(ChecklistHistorySerializer(checklists, many=True).data)


class EntryChecklistFinalizeView(_ChecklistTypeView):
    def post(self, request: Request, **kwargs: object) -> Response:
        snapshots = request.data.get("snapshots")
        checklist = svc.finalize(
            svc.get_or_create_checklist(self.get_order()),
            snapshots if isinstance(snapshots, dict) else {},
            request.user,
        )
        return Response(EntryChecklistStateSerializer(checklist).data)


class EntryChecklistReopenView(_ChecklistTypeView):
    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    def post(self, request: Request, **kwargs: object) -> Response:
        reason = request.data.get("reason")
        checklist = svc.reopen(
            svc.get_or_create_checklist(self.get_order()),
            reason if isinstance(reason, str) else "",
            request.user,
        )
        return Response(EntryChecklistStateSerializer(checklist).data)


def _str(request: Request, key: str) -> str:
    value = request.data.get(key)
    return value if isinstance(value, str) else ""


class EntryChecklistSignView(_ChecklistTypeView):
    """Assinatura presencial (iPad)."""

    def post(self, request: Request, **kwargs: object) -> Response:
        checklist = svc.get_or_create_checklist(self.get_order())
        svc.sign_presencial(
            checklist,
            _str(request, "signer_name"),
            _str(request, "signature_png_base64"),
            request.META.get("REMOTE_ADDR"),
            request.META.get("HTTP_USER_AGENT", ""),
        )
        checklist.refresh_from_db()
        return Response(EntryChecklistStateSerializer(checklist).data)


class EntryChecklistSendRemoteView(_ChecklistTypeView):
    """Gera o link de aceite remoto → `{url, whatsapp_url}`."""

    def post(self, request: Request, **kwargs: object) -> Response:
        return Response(svc.create_remote_link(svc.get_or_create_checklist(self.get_order())))


class _OrderEditView(APIView):
    """Base: OS da URL, exige os.edit."""

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), HasTenantPermission("os.edit")]

    def get_order(self) -> ServiceOrder:
        return get_object_or_404(ServiceOrder, pk=self.kwargs["service_order_pk"])


class BudgetMatchView(_OrderEditView):
    """Refaz o cruzamento com o orçamento → `{inside, outside, unmapped}`."""

    def post(self, request: Request, **kwargs: object) -> Response:
        return Response(asdict(run_budget_match(self.get_order())))


class BudgetMatchReportView(_OrderEditView):
    """PDF do cruzamento, separado do checklist assinado (que nunca muda) → `{pdf_url}`."""

    def post(self, request: Request, **kwargs: object) -> Response:
        order = self.get_order()
        doc = DocumentService.generate(
            order.pk, DocumentType.CHECKLIST_CRUZAMENTO, report_data(order), request.user
        )
        return Response({"pdf_url": pdf_url(doc.pk)})


class BudgetPanelRuleView(APIView):
    """Dicionário de peças. POST: upsert manual por pattern e recruza a OS informada."""

    permission_classes = [IsAuthenticated, IsAdminOrAbove]

    def get(self, request: Request) -> Response:
        rules = BudgetPanelRule.objects.filter(is_active=True).order_by("pattern")
        return Response(BudgetPanelRuleSerializer(rules, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = BudgetPanelRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_id = serializer.validated_data.get("service_order_id")
        order = get_object_or_404(ServiceOrder, pk=order_id) if order_id else None
        rule, _ = BudgetPanelRule.objects.update_or_create(
            pattern=serializer.validated_data["pattern"],
            defaults={
                "panel_keys": serializer.validated_data["panel_keys"],
                "source": BudgetPanelRule.Source.MANUAL,
                "is_active": True,
            },
        )
        if order is not None:
            run_budget_match(order)
        return Response(BudgetPanelRuleSerializer(rule).data, status=status.HTTP_201_CREATED)
