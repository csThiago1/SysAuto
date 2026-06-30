"""
Paddock Solutions — Pricing Catalog — Views DRF
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

ViewSets com RBAC via get_permissions():
  - Leitura: CONSULTANT+
  - Escrita: MANAGER+ (maioria) ou ADMIN+ (categorias/taxonomias)
  - FornecedorViewSet: leitura MANAGER+ (dados comerciais sensíveis)
"""
import logging

from django.utils import timezone
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
from apps.pricing_catalog.models import (
    AliasServico,
    CategoriaMaoObra,
    CategoriaServico,
    InsumoMaterial,
    MaterialCanonico,
    PecaCanonica,
    ServicoCanonico,
)
from apps.pricing_catalog.serializers import (
    AliasMatchInputSerializer,
    AliasMatchResultSerializer,
    AliasServicoCreateSerializer,
    AliasServicoDetailSerializer,
    AliasServicoListSerializer,
    AliasServicoUpdateSerializer,
    CategoriaMaoObraSerializer,
    CategoriaServicoSerializer,
    InsumoByGtinInputSerializer,
    InsumoMaterialCreateSerializer,
    InsumoMaterialDetailSerializer,
    InsumoMaterialListSerializer,
    InsumoMaterialUpdateSerializer,
    MaterialCanonicoCreateSerializer,
    MaterialCanonicoDetailSerializer,
    MaterialCanonicoListSerializer,
    MaterialCanonicoUpdateSerializer,
    PecaCanonicoCreateSerializer,
    PecaCanonicoDetailSerializer,
    PecaCanonicoListSerializer,
    PecaCanonicoUpdateSerializer,
    ServicoCanonicoCreateSerializer,
    ServicoCanonicoDetailSerializer,
    ServicoCanicoListSerializer,
    ServicoCanonicoUpdateSerializer,
)
from apps.pricing_catalog.services.aliases import AliasMatcher

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# CategoriaServico
# ────────────────────────────────────────────────────────────────────────────


class CategoriaServicoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Categorias de Serviço.

    Leitura: CONSULTANT+ · Escrita: ADMIN+ (taxonomia compartilhada — alto impacto).
    """

    queryset = CategoriaServico.objects.filter(is_active=True).order_by("ordem", "nome")
    serializer_class = CategoriaServicoSerializer

    write_permission = IsAdminOrAbove


# ────────────────────────────────────────────────────────────────────────────
# CategoriaMaoObra
# ────────────────────────────────────────────────────────────────────────────


class CategoriaMaoObraViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Categorias de Mão de Obra.

    Leitura: CONSULTANT+ · Escrita: ADMIN+ (taxonomia compartilhada — alto impacto).
    """

    queryset = CategoriaMaoObra.objects.filter(is_active=True).order_by("ordem", "nome")
    serializer_class = CategoriaMaoObraSerializer

    write_permission = IsAdminOrAbove


# ────────────────────────────────────────────────────────────────────────────
# ServicoCanonico
# ────────────────────────────────────────────────────────────────────────────


class ServicoCanonicoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Serviços Canônicos + endpoint POST /match/.

    Leitura: CONSULTANT+ · Escrita: MANAGER+.
    """

    def get_queryset(self):  # type: ignore[override]
        qs = (
            ServicoCanonico.objects.filter(is_active=True)
            .select_related("categoria")
            .order_by("categoria", "nome")
        )
        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(categoria__codigo=categoria)
        busca = self.request.query_params.get("busca")
        if busca:
            qs = qs.filter(nome__icontains=busca)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return ServicoCanicoListSerializer
        if self.action == "create":
            return ServicoCanonicoCreateSerializer
        if self.action in ("update", "partial_update"):
            return ServicoCanonicoUpdateSerializer
        return ServicoCanonicoDetailSerializer


    @action(detail=False, methods=["post"], url_path="match")
    def match(self, request: Request) -> Response:
        """Resolve texto livre para ServicoCanonico.

        Body: {texto: str, top_k?: int (1–20, default 5)}
        Response: lista de {canonico_id, canonico_nome, score, metodo, confianca}
        """
        input_ser = AliasMatchInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        texto: str = input_ser.validated_data["texto"]
        top_k: int = input_ser.validated_data.get("top_k", 5)

        try:
            matcher = AliasMatcher()
            resultados = matcher.match_servico(texto, top_k=top_k)
        except Exception as exc:
            logger.error("Erro no match de serviço para texto=%r: %s", texto[:50], exc)
            return Response(
                {"detail": "Erro interno ao processar o match de serviço."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Resolver nomes dos canônicos
        ids = [r.canonico_id for r in resultados]
        nomes_map: dict[str, str] = {}
        if ids:
            for obj in ServicoCanonico.objects.filter(pk__in=ids, is_active=True).values(
                "id", "nome"
            ):
                nomes_map[str(obj["id"])] = obj["nome"]

        output = [
            {
                "canonico_id": r.canonico_id,
                "canonico_nome": nomes_map.get(r.canonico_id, ""),
                "score": r.score,
                "metodo": r.metodo,
                "confianca": r.confianca,
            }
            for r in resultados
        ]

        return Response(AliasMatchResultSerializer(output, many=True).data)


# ────────────────────────────────────────────────────────────────────────────
# MaterialCanonico
# ────────────────────────────────────────────────────────────────────────────


class MaterialCanonicoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Materiais Canônicos + endpoint POST /match/.

    Leitura: CONSULTANT+ · Escrita: MANAGER+.
    """

    def get_queryset(self):  # type: ignore[override]
        qs = MaterialCanonico.objects.filter(is_active=True).order_by("nome")
        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
        busca = self.request.query_params.get("busca")
        if busca:
            qs = qs.filter(nome__icontains=busca)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return MaterialCanonicoListSerializer
        if self.action == "create":
            return MaterialCanonicoCreateSerializer
        if self.action in ("update", "partial_update"):
            return MaterialCanonicoUpdateSerializer
        return MaterialCanonicoDetailSerializer


    @action(detail=False, methods=["post"], url_path="match")
    def match(self, request: Request) -> Response:
        """Resolve texto livre para MaterialCanonico.

        Body: {texto: str, top_k?: int (1–20, default 5)}
        Response: lista de {canonico_id, canonico_nome, score, metodo, confianca}
        """
        input_ser = AliasMatchInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        texto: str = input_ser.validated_data["texto"]
        top_k: int = input_ser.validated_data.get("top_k", 5)

        try:
            matcher = AliasMatcher()
            resultados = matcher.match_material(texto, top_k=top_k)
        except Exception as exc:
            logger.error("Erro no match de material para texto=%r: %s", texto[:50], exc)
            return Response(
                {"detail": "Erro interno ao processar o match de material."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        ids = [r.canonico_id for r in resultados]
        nomes_map: dict[str, str] = {}
        if ids:
            for obj in MaterialCanonico.objects.filter(pk__in=ids, is_active=True).values(
                "id", "nome"
            ):
                nomes_map[str(obj["id"])] = obj["nome"]

        output = [
            {
                "canonico_id": r.canonico_id,
                "canonico_nome": nomes_map.get(r.canonico_id, ""),
                "score": r.score,
                "metodo": r.metodo,
                "confianca": r.confianca,
            }
            for r in resultados
        ]

        return Response(AliasMatchResultSerializer(output, many=True).data)


# ────────────────────────────────────────────────────────────────────────────
# InsumoMaterial
# ────────────────────────────────────────────────────────────────────────────


class InsumoMaterialViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Insumos/Materiais + endpoint POST /by-gtin/.

    Leitura: CONSULTANT+ · Escrita: MANAGER+.
    """

    def get_queryset(self):  # type: ignore[override]
        qs = (
            InsumoMaterial.objects.filter(is_active=True)
            .select_related("material_canonico")
            .order_by("material_canonico", "descricao")
        )
        material = self.request.query_params.get("material_canonico")
        if material:
            qs = qs.filter(material_canonico=material)
        marca = self.request.query_params.get("marca")
        if marca:
            qs = qs.filter(marca__icontains=marca)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return InsumoMaterialListSerializer
        if self.action == "create":
            return InsumoMaterialCreateSerializer
        if self.action in ("update", "partial_update"):
            return InsumoMaterialUpdateSerializer
        return InsumoMaterialDetailSerializer


    @action(detail=False, methods=["post"], url_path="by-gtin")
    def by_gtin(self, request: Request) -> Response:
        """Busca InsumoMaterial por código GTIN/EAN.

        Body: {gtin: str}
        Response: InsumoMaterial ou 404.
        """
        input_ser = InsumoByGtinInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        gtin: str = input_ser.validated_data["gtin"]

        try:
            insumo = (
                InsumoMaterial.objects.filter(gtin=gtin, is_active=True)
                .select_related("material_canonico")
                .first()
            )
        except Exception as exc:
            logger.error("Erro ao buscar InsumoMaterial por GTIN=%r: %s", gtin, exc)
            return Response(
                {"detail": "Erro interno ao processar busca por GTIN."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not insumo:
            return Response(
                {"detail": "Insumo não encontrado para o GTIN informado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(InsumoMaterialDetailSerializer(insumo).data)


# ────────────────────────────────────────────────────────────────────────────
# PecaCanonica
# ────────────────────────────────────────────────────────────────────────────


class PecaCanonicoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Peças Canônicas + endpoint POST /match/.

    Leitura: CONSULTANT+ · Escrita: MANAGER+.
    """

    def get_queryset(self):  # type: ignore[override]
        qs = PecaCanonica.objects.filter(is_active=True).order_by("nome")
        tipo_peca = self.request.query_params.get("tipo_peca")
        if tipo_peca:
            qs = qs.filter(tipo_peca=tipo_peca)
        busca = self.request.query_params.get("busca")
        if busca:
            qs = qs.filter(nome__icontains=busca)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return PecaCanonicoListSerializer
        if self.action == "create":
            return PecaCanonicoCreateSerializer
        if self.action in ("update", "partial_update"):
            return PecaCanonicoUpdateSerializer
        return PecaCanonicoDetailSerializer


    @action(detail=False, methods=["post"], url_path="match")
    def match(self, request: Request) -> Response:
        """Resolve texto livre para PecaCanonica.

        Body: {texto: str, top_k?: int (1–20, default 5)}
        Response: lista de {canonico_id, canonico_nome, score, metodo, confianca}
        """
        input_ser = AliasMatchInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        texto: str = input_ser.validated_data["texto"]
        top_k: int = input_ser.validated_data.get("top_k", 5)

        try:
            matcher = AliasMatcher()
            resultados = matcher.match_peca(texto, top_k=top_k)
        except Exception as exc:
            logger.error("Erro no match de peça para texto=%r: %s", texto[:50], exc)
            return Response(
                {"detail": "Erro interno ao processar o match de peça."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        ids = [r.canonico_id for r in resultados]
        nomes_map: dict[str, str] = {}
        if ids:
            for obj in PecaCanonica.objects.filter(pk__in=ids, is_active=True).values(
                "id", "nome"
            ):
                nomes_map[str(obj["id"])] = obj["nome"]

        output = [
            {
                "canonico_id": r.canonico_id,
                "canonico_nome": nomes_map.get(r.canonico_id, ""),
                "score": r.score,
                "metodo": r.metodo,
                "confianca": r.confianca,
            }
            for r in resultados
        ]

        return Response(AliasMatchResultSerializer(output, many=True).data)


# ────────────────────────────────────────────────────────────────────────────
# Fornecedor — DEPRECATED (consolidado em persons.Person + SupplierProfile)
# ────────────────────────────────────────────────────────────────────────────


class FornecedorViewSet(PermissionsByActionMixin, viewsets.ViewSet):
    """Endpoint deprecated — fornecedores agora em /api/v1/persons/?role=SUPPLIER."""

    authentication_classes: list = []
    permission_classes: list = []

    def list(self, request):
        return self._gone()

    def retrieve(self, request, pk=None):
        return self._gone()

    def create(self, request):
        return self._gone()

    def update(self, request, pk=None):
        return self._gone()

    def partial_update(self, request, pk=None):
        return self._gone()

    def destroy(self, request, pk=None):
        return self._gone()

    @staticmethod
    def _gone():
        from rest_framework.response import Response
        from rest_framework import status
        return Response(
            {"detail": "Endpoint movido. Use /api/v1/persons/?role=SUPPLIER"},
            status=status.HTTP_410_GONE,
            headers={"Link": "</api/v1/persons/?role=SUPPLIER>; rel=successor-version"},
        )


# ────────────────────────────────────────────────────────────────────────────
# AliasServico
# ────────────────────────────────────────────────────────────────────────────


class AliasServicoViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """CRUD de Aliases de Serviço + ações de revisão/aprovação.

    Leitura: CONSULTANT+ · Escrita: MANAGER+.
    Actions especiais:
      GET /aliases/servico/revisao/ — lista aliases auto_media para curadoria
      POST /aliases/servico/{id}/approve/ — confirma mapeamento
      POST /aliases/servico/{id}/reject/ — rejeita (soft-delete)
    """

    def get_queryset(self):  # type: ignore[override]
        qs = (
            AliasServico.objects.filter(is_active=True)
            .select_related("canonico", "confirmado_por")
            .order_by("-ocorrencias", "texto_normalizado")
        )
        canonico = self.request.query_params.get("canonico")
        if canonico:
            qs = qs.filter(canonico=canonico)
        origem = self.request.query_params.get("origem")
        if origem:
            qs = qs.filter(origem=origem)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return AliasServicoListSerializer
        if self.action == "create":
            return AliasServicoCreateSerializer
        if self.action in ("update", "partial_update"):
            return AliasServicoUpdateSerializer
        return AliasServicoDetailSerializer

    write_actions = ("create", "update", "partial_update", "destroy", "approve", "reject")

    @action(detail=False, methods=["get"], url_path="revisao")
    def revisao(self, request: Request) -> Response:
        """Lista aliases auto_media aguardando revisão humana.

        Retorna aliases com origem='auto_media' ainda não confirmados,
        ordenados por número de ocorrências descendente.
        """
        qs = (
            AliasServico.objects.filter(
                is_active=True,
                origem="auto_media",
                confirmado_em__isnull=True,
            )
            .select_related("canonico")
            .order_by("-ocorrencias")
        )
        serializer = AliasServicoListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request: Request, pk: str | None = None) -> Response:
        """Confirma o mapeamento de um alias.

        Marca confirmado_em e confirmado_por no alias.
        Atualiza origem para 'auto_alta' se era 'auto_media'.
        """
        alias = self.get_object()

        try:
            alias.confirmado_em = timezone.now()
            alias.confirmado_por = request.user  # type: ignore[assignment]
            if alias.origem == "auto_media":
                alias.origem = "auto_alta"
            alias.save(update_fields=["confirmado_em", "confirmado_por", "origem"])
        except Exception as exc:
            logger.error("Erro ao aprovar alias %s: %s", pk, exc)
            return Response(
                {"detail": "Erro interno ao aprovar alias."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(AliasServicoDetailSerializer(alias).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request: Request, pk: str | None = None) -> Response:
        """Rejeita e desativa um alias com mapeamento incorreto.

        Executa soft-delete (is_active=False).
        """
        alias = self.get_object()

        try:
            alias.is_active = False
            alias.save(update_fields=["is_active"])
        except Exception as exc:
            logger.error("Erro ao rejeitar alias %s: %s", pk, exc)
            return Response(
                {"detail": "Erro interno ao rejeitar alias."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
