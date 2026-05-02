"""
Paddock Solutions — Inventory — ViewSets de Produto Comercial
TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca, ProdutoComercialInsumo

RBAC:
  - Leitura: CONSULTANT+
  - Escrita (create/update/destroy): MANAGER+
"""
import logging

from django.db.models import Q, QuerySet
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.inventory.models_product import (
    CategoriaInsumo,
    CategoriaProduto,
    ProdutoComercialInsumo,
    ProdutoComercialPeca,
    TipoPeca,
)
from apps.inventory.serializers_product import (
    CategoriaInsumoSerializer,
    CategoriaProdutoSerializer,
    ProdutoComercialInsumoSerializer,
    ProdutoComercialPecaSerializer,
    TipoPecaSerializer,
)

logger = logging.getLogger(__name__)


class TipoPecaViewSet(viewsets.ModelViewSet):
    """CRUD de Tipos de Peça. Leitura CONSULTANT+, escrita MANAGER+."""

    serializer_class = TipoPecaSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[TipoPeca]:
        return TipoPeca.objects.filter(is_active=True).order_by("ordem", "nome")

    def perform_destroy(self, instance: TipoPeca) -> None:
        instance.soft_delete()


class CategoriaProdutoViewSet(viewsets.ModelViewSet):
    """CRUD de Categorias de Produto (Peça). Leitura CONSULTANT+, escrita MANAGER+."""

    serializer_class = CategoriaProdutoSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[CategoriaProduto]:
        return CategoriaProduto.objects.filter(is_active=True).order_by("ordem", "nome")

    def perform_destroy(self, instance: CategoriaProduto) -> None:
        instance.soft_delete()


class CategoriaInsumoViewSet(viewsets.ModelViewSet):
    """CRUD de Categorias de Insumo. Leitura CONSULTANT+, escrita MANAGER+."""

    serializer_class = CategoriaInsumoSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[CategoriaInsumo]:
        return CategoriaInsumo.objects.filter(is_active=True).order_by("ordem", "nome")

    def perform_destroy(self, instance: CategoriaInsumo) -> None:
        instance.soft_delete()


class ProdutoComercialPecaViewSet(viewsets.ModelViewSet):
    """CRUD de Produtos Comerciais (Peça). Filtro por ?tipo_peca=, ?categoria=, ?busca=."""

    serializer_class = ProdutoComercialPecaSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[ProdutoComercialPeca]:
        qs = (
            ProdutoComercialPeca.objects.filter(is_active=True)
            .select_related("tipo_peca", "categoria", "peca_canonica")
            .order_by("nome_interno")
        )

        tipo_peca = self.request.query_params.get("tipo_peca")
        if tipo_peca:
            qs = qs.filter(tipo_peca_id=tipo_peca)

        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(categoria_id=categoria)

        busca = self.request.query_params.get("busca")
        if busca:
            qs = qs.filter(
                Q(nome_interno__icontains=busca) | Q(sku_interno__icontains=busca)
            )

        return qs

    def perform_destroy(self, instance: ProdutoComercialPeca) -> None:
        instance.soft_delete()


class ProdutoComercialInsumoViewSet(viewsets.ModelViewSet):
    """CRUD de Produtos Comerciais (Insumo). Filtro por ?categoria_insumo=, ?busca=."""

    serializer_class = ProdutoComercialInsumoSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self) -> QuerySet[ProdutoComercialInsumo]:
        qs = (
            ProdutoComercialInsumo.objects.filter(is_active=True)
            .select_related("categoria_insumo", "material_canonico")
            .order_by("nome_interno")
        )

        categoria_insumo = self.request.query_params.get("categoria_insumo")
        if categoria_insumo:
            qs = qs.filter(categoria_insumo_id=categoria_insumo)

        busca = self.request.query_params.get("busca")
        if busca:
            qs = qs.filter(
                Q(nome_interno__icontains=busca) | Q(sku_interno__icontains=busca)
            )

        return qs

    def perform_destroy(self, instance: ProdutoComercialInsumo) -> None:
        instance.soft_delete()
