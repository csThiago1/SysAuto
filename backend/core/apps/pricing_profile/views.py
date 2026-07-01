"""Views DRF para o app pricing_profile."""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsAdminOrAbove,
    IsConsultantOrAbove,
    IsManagerOrAbove,
    PermissionsByActionMixin,
)
from apps.pricing_profile.models import (
    CategoriaTamanho,
    Empresa,
    EnquadramentoFaltante,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)
from apps.pricing_profile.serializers import (
    CategoriaTamanhoSerializer,
    EmpresaSerializer,
    EnquadramentoFaltanteSerializer,
    EnquadramentoResolverInputSerializer,
    EnquadramentoVeiculoSerializer,
    SegmentoVeicularSerializer,
    TipoPinturaSerializer,
)
from apps.pricing_profile.services import EnquadramentoService

logger = logging.getLogger(__name__)


class EmpresaViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Empresas do tenant."""

    queryset = Empresa.objects.filter(is_active=True).order_by("nome_fantasia")
    serializer_class = EmpresaSerializer

    write_permission = IsAdminOrAbove
    read_permission = IsManagerOrAbove


class SegmentoVeicularViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Segmentos Veiculares."""

    queryset = SegmentoVeicular.objects.filter(is_active=True).order_by("ordem")
    serializer_class = SegmentoVeicularSerializer

    write_permission = IsAdminOrAbove


class CategoriaTamanhoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Categorias de Tamanho."""

    queryset = CategoriaTamanho.objects.filter(is_active=True).order_by("ordem")
    serializer_class = CategoriaTamanhoSerializer

    write_permission = IsAdminOrAbove


class TipoPinturaViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Tipos de Pintura."""

    queryset = TipoPintura.objects.filter(is_active=True).order_by("complexidade")
    serializer_class = TipoPinturaSerializer

    write_permission = IsAdminOrAbove


class EnquadramentoVeiculoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Enquadramentos Veiculares + endpoint POST /resolver/."""

    serializer_class = EnquadramentoVeiculoSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = (
            EnquadramentoVeiculo.objects.filter(is_active=True)
            .select_related("segmento", "tamanho", "tipo_pintura_default")
            .order_by("marca", "modelo", "prioridade")
        )
        marca = self.request.query_params.get("marca")
        if marca:
            qs = qs.filter(marca__icontains=marca)
        return qs


    @action(detail=False, methods=["post"], url_path="resolver")
    def resolver(self, request: Request) -> Response:
        """Resolve perfil veicular por marca/modelo/ano.

        Body: {marca: str, modelo: str, ano: int}
        Response: {segmento_codigo, tamanho_codigo, tipo_pintura_codigo,
                   origem, enquadramento_id, segmento, tamanho, tipo_pintura_default}
        """
        input_ser = EnquadramentoResolverInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        result = EnquadramentoService.resolver(
            marca=input_ser.validated_data["marca"],
            modelo=input_ser.validated_data["modelo"],
            ano=input_ser.validated_data["ano"],
        )

        # Enriquecer resposta com objetos completos
        try:
            segmento_obj = SegmentoVeicular.objects.filter(
                codigo=result.segmento_codigo, is_active=True
            ).first()
            tamanho_obj = CategoriaTamanho.objects.filter(
                codigo=result.tamanho_codigo, is_active=True
            ).first()
            tipo_pintura_obj = (
                TipoPintura.objects.filter(
                    codigo=result.tipo_pintura_codigo, is_active=True
                ).first()
                if result.tipo_pintura_codigo
                else None
            )
        except Exception as exc:
            logger.error("Erro ao enriquecer resultado do EnquadramentoService: %s", exc)
            segmento_obj = tamanho_obj = tipo_pintura_obj = None

        response_data = result.to_dict()
        response_data["segmento"] = (
            SegmentoVeicularSerializer(segmento_obj).data if segmento_obj else None
        )
        response_data["tamanho"] = (
            CategoriaTamanhoSerializer(tamanho_obj).data if tamanho_obj else None
        )
        response_data["tipo_pintura_default"] = (
            TipoPinturaSerializer(tipo_pintura_obj).data if tipo_pintura_obj else None
        )

        return Response(response_data, status=status.HTTP_200_OK)


class EnquadramentoFaltanteViewSet(PermissionsByActionMixin, viewsets.ReadOnlyModelViewSet):
    """Lista read-only de enquadramentos faltantes para painel de curadoria."""

    queryset = EnquadramentoFaltante.objects.all().order_by("-ocorrencias")
    serializer_class = EnquadramentoFaltanteSerializer
