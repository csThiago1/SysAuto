"""
Paddock Solutions — Pricing Tech — Views DRF
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

ViewSets:
  FichaTecnicaServicoViewSet:
    - list/retrieve: MANAGER+
    - CREATE proibido via ViewSet padrão (usar nova-versao/)
    - PATCH/PUT/DELETE proibidos por design (fichas são imutáveis — Armadilha A1)
    - @action POST "resolver/": resolve ficha para servico+tipo_pintura
    - @action POST "{id}/nova-versao/": cria nova versão da ficha

Sem ViewSet para FichaTecnicaMaoObra nem FichaTecnicaInsumo (imutáveis — Armadilha P1).
"""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrAbove, IsManagerOrAbove
from apps.pricing_tech.models import FichaTecnicaServico
from apps.pricing_tech.serializers import (
    FichaTecnicaServicoDetailSerializer,
    FichaTecnicaServicoListSerializer,
    NovaVersaoInputSerializer,
    ResolverInputSerializer,
)
from apps.pricing_tech.services import FichaNaoEncontrada, FichaTecnicaService

logger = logging.getLogger(__name__)


class FichaTecnicaServicoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de FichaTecnicaServico — somente leitura + actions de negócio.

    Fichas técnicas são imutáveis após criação. Mudanças devem criar nova
    versão via action nova-versao/ (Armadilha A1).

    Endpoints:
      GET  /fichas/                       — lista fichas ativas (MANAGER+)
      GET  /fichas/{id}/                  — detalhe da ficha (MANAGER+)
      POST /fichas/resolver/              — resolve ficha para servico+tipo_pintura (MANAGER+)
      POST /fichas/{id}/nova-versao/      — cria nova versão da ficha (MANAGER+)
      DELETE /fichas/{id}/               — soft-delete (ADMIN+)
    """

    def get_queryset(self):  # type: ignore[override]
        qs = (
            FichaTecnicaServico.objects.filter(is_active=True)
            .select_related("servico", "tipo_pintura", "criada_por")
            .order_by("servico__nome", "tipo_pintura__nome", "-versao")
        )
        servico = self.request.query_params.get("servico")
        if servico:
            qs = qs.filter(servico_id=servico)
        tipo_pintura = self.request.query_params.get("tipo_pintura")
        if tipo_pintura:
            qs = qs.filter(tipo_pintura__codigo=tipo_pintura)
        return qs

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return FichaTecnicaServicoListSerializer
        return FichaTecnicaServicoDetailSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action == "destroy":
            return [IsAuthenticated(), IsAdminOrAbove()]
        # list, retrieve, resolver, nova_versao — MANAGER+
        return [IsAuthenticated(), IsManagerOrAbove()]

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        """Soft-delete de ficha técnica (ADMIN+).

        Marca is_active=False sem remover do banco.
        Requer ADMIN+ pois desativa uma ficha que pode estar em uso.
        """
        ficha = self.get_object()
        try:
            ficha.is_active = False
            ficha.save(update_fields=["is_active"])
        except Exception as exc:
            logger.error("Erro ao desativar ficha técnica %s: %s", pk, exc)
            return Response(
                {"erro": "Erro interno ao desativar a ficha técnica."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="resolver")
    def resolver(self, request: Request) -> Response:
        """Resolve a ficha técnica ativa para um serviço e tipo de pintura.

        Body: {servico_id: UUID, tipo_pintura_codigo?: str}
        Response: FichaResolvida com maos_obra e insumos.
        Fallback: se tipo_pintura não encontrado, retorna ficha genérica.
        """
        input_ser = ResolverInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)

        servico_id = str(input_ser.validated_data["servico_id"])
        tipo_pintura_codigo: str | None = input_ser.validated_data.get("tipo_pintura_codigo")

        try:
            ficha_resolvida = FichaTecnicaService.resolver(
                servico_id=servico_id,
                tipo_pintura_codigo=tipo_pintura_codigo,
            )
        except FichaNaoEncontrada:
            return Response(
                {
                    "detail": (
                        f"Nenhuma ficha técnica ativa encontrada para o serviço informado"
                        f"{' e tipo de pintura ' + tipo_pintura_codigo if tipo_pintura_codigo else ''}."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as exc:
            logger.error(
                "Erro inesperado ao resolver ficha para servico_id=%s tipo_pintura=%s: %s",
                servico_id,
                tipo_pintura_codigo,
                exc,
            )
            return Response(
                {"erro": "Erro interno ao resolver a ficha técnica."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "ficha_id": ficha_resolvida.ficha_id,
                "versao": ficha_resolvida.versao,
                "maos_obra": ficha_resolvida.maos_obra,
                "insumos": ficha_resolvida.insumos,
            }
        )

    @action(detail=True, methods=["post"], url_path="nova-versao")
    def nova_versao(self, request: Request, pk: str | None = None) -> Response:
        """Cria nova versão da ficha técnica, desativando a atual.

        A nova versão herda o mesmo servico e tipo_pintura da ficha atual.
        Body: {maos_obra: [...], insumos: [...], motivo: str}
        Response: FichaTecnicaServicoDetailSerializer da nova versão.
        """
        ficha_atual = self.get_object()

        input_ser = NovaVersaoInputSerializer(
            data=request.data,
            context={
                "servico_id": str(ficha_atual.servico_id),
                "ficha_atual_id": str(ficha_atual.pk),
            },
        )
        input_ser.is_valid(raise_exception=True)

        maos_obra_data = [
            {
                "categoria_id": str(mo["categoria"]),
                "horas": mo["horas"],
                "afetada_por_tamanho": mo["afetada_por_tamanho"],
                "observacao": mo.get("observacao", ""),
            }
            for mo in input_ser.validated_data["maos_obra"]
        ]
        insumos_data = [
            {
                "material_canonico_id": str(ins["material_canonico"]),
                "quantidade": ins["quantidade"],
                "unidade": ins["unidade"],
                "afetado_por_tamanho": ins["afetado_por_tamanho"],
                "observacao": ins.get("observacao", ""),
            }
            for ins in input_ser.validated_data["insumos"]
        ]

        try:
            nova = FichaTecnicaService.criar_nova_versao(
                servico_id=str(ficha_atual.servico_id),
                tipo_pintura_id=str(ficha_atual.tipo_pintura_id) if ficha_atual.tipo_pintura_id else None,
                maos_obra_data=maos_obra_data,
                insumos_data=insumos_data,
                motivo=input_ser.validated_data["motivo"],
                user_id=str(request.user.pk),
            )
        except Exception as exc:
            logger.error("Erro ao criar nova versão da ficha %s: %s", pk, exc)
            return Response(
                {"erro": "Erro interno ao criar nova versão da ficha técnica."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        nova_refresh = (
            FichaTecnicaServico.objects.select_related("servico", "tipo_pintura", "criada_por")
            .prefetch_related(
                "maos_obra__categoria",
                "insumos__material_canonico",
            )
            .get(pk=nova.pk)
        )

        return Response(
            FichaTecnicaServicoDetailSerializer(nova_refresh).data,
            status=status.HTTP_201_CREATED,
        )
