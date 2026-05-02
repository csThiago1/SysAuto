"""
Paddock Solutions — Inventory — ViewSets de Localização
WMS: Armazem -> Rua -> Prateleira -> Nivel

RBAC:
  - Leitura: CONSULTANT+
  - Escrita (create/update/destroy): MANAGER+
"""
import logging

from django.db.models import Count, Q, QuerySet
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.serializers_location import (
    ArmazemSerializer,
    NivelSerializer,
    PrateleiraSerializer,
    RuaSerializer,
)

logger = logging.getLogger(__name__)


class ArmazemViewSet(viewsets.ModelViewSet):
    """CRUD de Armazéns. Leitura CONSULTANT+, escrita MANAGER+."""

    serializer_class = ArmazemSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[Armazem]:
        return (
            Armazem.objects.filter(is_active=True)
            .annotate(total_ruas=Count("ruas", filter=Q(ruas__is_active=True)))
            .order_by("codigo")
        )

    def perform_destroy(self, instance: Armazem) -> None:
        instance.soft_delete()

    @action(detail=True, methods=["get"], url_path="ocupacao")
    def ocupacao(self, request: Request, pk: str | None = None) -> Response:
        """Retorna estatísticas de ocupação por rua do armazém."""
        armazem = self.get_object()

        from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

        ruas = (
            Rua.objects.filter(armazem=armazem, is_active=True)
            .order_by("ordem", "codigo")
            .values("id", "codigo", "descricao")
        )

        resultado = []
        for rua_data in ruas:
            rua_id = rua_data["id"]
            niveis_ids = Nivel.objects.filter(
                prateleira__rua_id=rua_id,
                prateleira__is_active=True,
                is_active=True,
            ).values_list("id", flat=True)

            # TODO: filtros por nivel FK serão ativados após Task 1.4
            # (UnidadeFisica/LoteInsumo ainda não têm FK nivel)
            unidades_count = UnidadeFisica.objects.filter(
                is_active=True,
                nivel_id__in=niveis_ids,
            ).count() if hasattr(UnidadeFisica, "nivel") else 0

            lotes_count = LoteInsumo.objects.filter(
                is_active=True,
                nivel_id__in=niveis_ids,
            ).count() if hasattr(LoteInsumo, "nivel") else 0

            resultado.append({
                "rua_id": str(rua_id),
                "rua_codigo": rua_data["codigo"],
                "rua_descricao": rua_data["descricao"],
                "total_unidades": unidades_count,
                "total_lotes": lotes_count,
            })

        return Response(resultado)


class RuaViewSet(viewsets.ModelViewSet):
    """CRUD de Ruas. Filtro por ?armazem={id}."""

    serializer_class = RuaSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[Rua]:
        qs = (
            Rua.objects.filter(is_active=True)
            .select_related("armazem")
            .annotate(
                total_prateleiras=Count(
                    "prateleiras", filter=Q(prateleiras__is_active=True)
                )
            )
            .order_by("ordem", "codigo")
        )

        armazem_id = self.request.query_params.get("armazem")
        if armazem_id:
            qs = qs.filter(armazem_id=armazem_id)

        return qs

    def perform_destroy(self, instance: Rua) -> None:
        instance.soft_delete()


class PrateleiraViewSet(viewsets.ModelViewSet):
    """CRUD de Prateleiras. Filtro por ?rua={id}."""

    serializer_class = PrateleiraSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[Prateleira]:
        qs = (
            Prateleira.objects.filter(is_active=True)
            .select_related("rua")
            .annotate(
                total_niveis=Count("niveis", filter=Q(niveis__is_active=True))
            )
            .order_by("ordem", "codigo")
        )

        rua_id = self.request.query_params.get("rua")
        if rua_id:
            qs = qs.filter(rua_id=rua_id)

        return qs

    def perform_destroy(self, instance: Prateleira) -> None:
        instance.soft_delete()


class NivelViewSet(viewsets.ModelViewSet):
    """CRUD de Níveis. Ponto terminal do endereçamento WMS."""

    serializer_class = NivelSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[Nivel]:
        # TODO: total_unidades/total_lotes depende da FK nivel em
        # UnidadeFisica/LoteInsumo (Task 1.4). Até lá, annotate com 0.
        has_nivel_fk = hasattr(Nivel, "unidades_fisicas")

        annotations: dict = {}
        if has_nivel_fk:
            annotations["total_unidades"] = Count(
                "unidades_fisicas", filter=Q(unidades_fisicas__is_active=True)
            )
            annotations["total_lotes"] = Count(
                "lotes_insumo", filter=Q(lotes_insumo__is_active=True)
            )
        else:
            from django.db.models import Value
            annotations["total_unidades"] = Value(0)
            annotations["total_lotes"] = Value(0)

        qs = (
            Nivel.objects.filter(is_active=True)
            .select_related("prateleira__rua__armazem")
            .annotate(**annotations)
            .order_by("ordem", "codigo")
        )

        prateleira_id = self.request.query_params.get("prateleira")
        if prateleira_id:
            qs = qs.filter(prateleira_id=prateleira_id)

        return qs

    def perform_destroy(self, instance: Nivel) -> None:
        instance.soft_delete()

    @action(detail=True, methods=["get"], url_path="conteudo")
    def conteudo(self, request: Request, pk: str | None = None) -> Response:
        """Retorna unidades físicas e lotes neste nível."""
        nivel = self.get_object()

        from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
        from apps.inventory.serializers import (
            LoteInsumoListSerializer,
            UnidadeFisicaListSerializer,
        )

        # TODO: ativado após Task 1.4 (FK nivel em UnidadeFisica/LoteInsumo)
        if hasattr(UnidadeFisica, "nivel"):
            unidades = UnidadeFisica.objects.filter(
                nivel=nivel, is_active=True,
            ).select_related("peca_canonica")
            lotes = LoteInsumo.objects.filter(
                nivel=nivel, is_active=True,
            ).select_related("material_canonico")
        else:
            unidades = UnidadeFisica.objects.none()
            lotes = LoteInsumo.objects.none()

        return Response({
            "unidades": UnidadeFisicaListSerializer(unidades, many=True).data,
            "lotes": LoteInsumoListSerializer(lotes, many=True).data,
        })
