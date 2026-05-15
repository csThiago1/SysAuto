"""
Paddock Solutions — Parts Catalog Serializers
"""
from rest_framework import serializers

from apps.parts_catalog.models import (
    PartApplication,
    PartCategory,
    PartReference,
    PartSupplierRef,
)


class PartCategorySerializer(serializers.ModelSerializer):
    """Serializer completo para PartCategory."""

    class Meta:
        model = PartCategory
        fields = ["id", "code", "name", "description", "order", "is_active"]
        read_only_fields = ["id"]


class PartSupplierRefSerializer(serializers.ModelSerializer):
    """Serializer de referência de fornecedor — usado aninhado em PartReferenceDetailSerializer."""

    class Meta:
        model = PartSupplierRef
        fields = ["id", "supplier_name", "supplier_code", "created_at"]
        read_only_fields = ["id", "created_at"]


class PartApplicationSerializer(serializers.ModelSerializer):
    """
    Serializer de aplicação veicular com campos desnormalizados para exibição.

    make_nome e model_nome evitam lookups adicionais no frontend.
    """

    make_nome = serializers.CharField(source="make.nome", read_only=True)
    model_nome = serializers.SerializerMethodField()

    class Meta:
        model = PartApplication
        fields = [
            "id",
            "part_ref",
            "make",
            "make_nome",
            "model",
            "model_nome",
            "year_start",
            "year_end",
            "source",
            "confidence_score",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "make_nome", "model_nome"]

    def get_model_nome(self, obj: PartApplication) -> str | None:
        """Retorna o nome do modelo ou None quando a aplicação cobre toda a marca."""
        return obj.model.nome if obj.model else None


class PartReferenceListSerializer(serializers.ModelSerializer):
    """
    Serializer leve para listagens — omite aplicações e fornecedores aninhados.

    Usado em endpoints de busca onde o volume de resultados pode ser alto.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "category",
            "category_name",
            "unit",
            "ncm",
            "ean",
            "is_active",
            "updated_at",
        ]
        read_only_fields = ["id", "category_name", "updated_at"]


class PartReferenceSearchSerializer(serializers.ModelSerializer):
    """
    Serializer para busca com compatibilidade veicular.
    Inclui is_compatible (annotation), applications e suppliers inline.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    is_compatible = serializers.BooleanField(read_only=True, default=False)
    applications = PartApplicationSerializer(many=True, read_only=True)
    suppliers = PartSupplierRefSerializer(many=True, read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "category",
            "category_name",
            "unit",
            "ncm",
            "ean",
            "is_compatible",
            "applications",
            "suppliers",
        ]


class PartReferenceDetailSerializer(serializers.ModelSerializer):
    """
    Serializer completo para retrieve — inclui aplicações e fornecedores aninhados.

    Usado apenas no endpoint de detalhe individual para evitar N+1 em listagens.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    applications = PartApplicationSerializer(many=True, read_only=True)
    suppliers = PartSupplierRefSerializer(many=True, read_only=True)

    class Meta:
        model = PartReference
        fields = [
            "id",
            "manufacturer_code",
            "description",
            "description_original",
            "category",
            "category_name",
            "unit",
            "ncm",
            "ean",
            "is_active",
            "created_at",
            "updated_at",
            "applications",
            "suppliers",
        ]
        read_only_fields = [
            "id",
            "category_name",
            "created_at",
            "updated_at",
            "applications",
            "suppliers",
        ]
