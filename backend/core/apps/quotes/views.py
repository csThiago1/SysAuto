"""
Paddock Solutions — Quotes Views
Motor de Orçamentos (MO) — Sprint MO-7
"""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.quotes.models import AreaImpacto, Orcamento, OrcamentoIntervencao, OrcamentoItemAdicional
from apps.quotes.serializers import (
    AprovarSerializer,
    AreaImpactoSerializer,
    OrcamentoCreateSerializer,
    OrcamentoIntervencaoCreateSerializer,
    OrcamentoIntervencaoSerializer,
    OrcamentoItemAdicionalCreateSerializer,
    OrcamentoItemAdicionalSerializer,
    OrcamentoListSerializer,
    OrcamentoSerializer,
)
from apps.quotes.services import (
    MapeamentoAcaoAusente,
    OrcamentoNaoEditavel,
    OrcamentoService,
)

logger = logging.getLogger(__name__)


class OrcamentoViewSet(viewsets.ModelViewSet):
    """CRUD + fluxo de aprovação de orçamentos.

    Permissões:
      - Leitura: CONSULTANT+
      - Criação / edição: CONSULTANT+
      - Aprovação / recusa: MANAGER+
    """

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("aprovar", "recusar"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = Orcamento.objects.filter(is_active=True).select_related(
            "empresa", "customer", "insurer"
        ).prefetch_related("areas", "intervencoes", "itens_adicionais")

        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)

        empresa = self.request.query_params.get("empresa")
        if empresa:
            qs = qs.filter(empresa_id=empresa)

        return qs.order_by("-created_at")

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return OrcamentoListSerializer
        if self.action == "create":
            return OrcamentoCreateSerializer
        return OrcamentoSerializer

    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[override]
        ser = OrcamentoCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            orc = OrcamentoService.criar(
                empresa_id=str(d["empresa_id"]),
                customer_id=str(d["customer_id"]),
                insurer_id=str(d["insurer_id"]) if d.get("insurer_id") else None,
                tipo_responsabilidade=d["tipo_responsabilidade"],
                sinistro_numero=d.get("sinistro_numero", ""),
                veiculo=d["veiculo"],
                user_id=str(request.user.id) if request.user else None,
                observacoes=d.get("observacoes", ""),
            )
        except Exception as exc:
            logger.error("OrcamentoViewSet.create error: %s", exc)
            return Response({"erro": "Erro interno ao criar orçamento."}, status=500)
        return Response(OrcamentoSerializer(orc).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[override]
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        allowed_fields = {"validade", "observacoes", "desconto", "tipo_responsabilidade", "sinistro_numero"}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        for field, value in data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(data.keys()) + ["updated_at"])
        return Response(OrcamentoSerializer(instance).data)

    # ── Actions ──────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="intervencoes")
    def adicionar_intervencao(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/intervencoes/ — adiciona intervenção via motor."""
        ser = OrcamentoIntervencaoCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            iv = OrcamentoService.adicionar_intervencao(
                orcamento_id=pk,
                area_impacto_id=str(d["area_impacto_id"]),
                peca_canonica_id=str(d["peca_canonica_id"]),
                acao=d["acao"],
                qualificador_peca=d.get("qualificador_peca", "PPO"),
                fornecimento=d.get("fornecimento", "oficina"),
                quantidade=d.get("quantidade", 1),
                user_id=str(request.user.id) if request.user else None,
                codigo_peca=d.get("codigo_peca", ""),
                inclusao_manual=d.get("inclusao_manual", False),
                descricao=d.get("descricao", ""),
            )
        except OrcamentoNaoEditavel as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_409_CONFLICT)
        except MapeamentoAcaoAusente as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception as exc:
            logger.error("adicionar_intervencao error: %s", exc)
            return Response({"erro": "Erro interno ao adicionar intervenção."}, status=500)
        return Response(OrcamentoIntervencaoSerializer(iv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="itens-adicionais")
    def adicionar_item_adicional(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/itens-adicionais/ — adiciona serviço adicional."""
        ser = OrcamentoItemAdicionalCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            item = OrcamentoService.adicionar_item_adicional(
                orcamento_id=pk,
                service_catalog_id=str(d["service_catalog_id"]),
                quantidade=d.get("quantidade", 1),
                fornecimento=d.get("fornecimento", "oficina"),
                user_id=str(request.user.id) if request.user else None,
                descricao=d.get("descricao", ""),
                inclusao_manual=d.get("inclusao_manual", False),
            )
        except OrcamentoNaoEditavel as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_409_CONFLICT)
        except Exception as exc:
            logger.error("adicionar_item_adicional error: %s", exc)
            return Response({"erro": "Erro interno ao adicionar item."}, status=500)
        return Response(OrcamentoItemAdicionalSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def enviar(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/enviar/ — envia ao cliente."""
        try:
            orc = OrcamentoService.enviar(orcamento_id=pk)
        except OrcamentoNaoEditavel as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(OrcamentoSerializer(orc).data)

    @action(detail=True, methods=["post"])
    def recusar(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/recusar/ — marca como recusado (MANAGER+)."""
        try:
            orc = OrcamentoService.recusar(orcamento_id=pk)
        except OrcamentoNaoEditavel as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(OrcamentoSerializer(orc).data)

    @action(detail=True, methods=["post"])
    def aprovar(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/aprovar/ — cria ServiceOrder (MANAGER+).

        Body:
          {
            "intervencoes_ids": null | [uuid...],
            "itens_adicionais_ids": null | [uuid...],
            "areas_negadas": null | [{area_id, motivo}...]
          }
        """
        ser = AprovarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            os_ = OrcamentoService.aprovar(
                orcamento_id=pk,
                intervencoes_ids=[str(x) for x in d["intervencoes_ids"]] if d["intervencoes_ids"] is not None else None,
                itens_adicionais_ids=[str(x) for x in d["itens_adicionais_ids"]] if d["itens_adicionais_ids"] is not None else None,
                areas_negadas=d.get("areas_negadas"),
                user_id=str(request.user.id) if request.user else None,
            )
        except OrcamentoNaoEditavel as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_409_CONFLICT)
        except ValueError as exc:
            return Response({"erro": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception as exc:
            logger.error("aprovar error: %s", exc)
            return Response({"erro": "Erro interno na aprovação."}, status=500)
        return Response({"os_id": str(os_.id), "os_number": os_.number}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="nova-versao")
    def nova_versao(self, request: Request, pk: str | None = None) -> Response:
        """POST /orcamentos/{id}/nova-versao/ — clona com custos recalculados."""
        try:
            nova = OrcamentoService.nova_versao(
                orcamento_id=pk,
                user_id=str(request.user.id) if request.user else None,
            )
        except Exception as exc:
            logger.error("nova_versao error: %s", exc)
            return Response({"erro": "Erro interno ao criar nova versão."}, status=500)
        return Response(OrcamentoListSerializer(nova).data, status=status.HTTP_201_CREATED)


class AreaImpactoViewSet(viewsets.ModelViewSet):
    """CRUD de áreas de impacto de um orçamento."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = AreaImpactoSerializer

    def get_queryset(self):  # type: ignore[override]
        return AreaImpacto.objects.filter(
            is_active=True,
            orcamento_id=self.kwargs.get("orcamento_pk"),
        ).order_by("ordem")

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        orcamento_id = self.kwargs.get("orcamento_pk")
        serializer.save(
            orcamento_id=orcamento_id,
            created_by=self.request.user,
        )
