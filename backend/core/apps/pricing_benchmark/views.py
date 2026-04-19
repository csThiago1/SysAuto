"""
Paddock Solutions — Pricing Benchmark — Views
Motor de Orçamentos (MO) — Sprint MO-8
"""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrAbove, IsManagerOrAbove
from apps.pricing_benchmark.models import (
    BenchmarkAmostra,
    BenchmarkFonte,
    BenchmarkIngestao,
    SugestaoIA,
)
from apps.pricing_benchmark.serializers import (
    AceitarMatchSerializer,
    AvaliarSugestaoSerializer,
    BenchmarkAmostraSerializer,
    BenchmarkFonteSerializer,
    BenchmarkIngestaoSerializer,
    DescartarAmostraSerializer,
    SugestaoIACreateSerializer,
    SugestaoIASerializer,
)

logger = logging.getLogger(__name__)


class BenchmarkFonteViewSet(viewsets.ModelViewSet):
    """CRUD de fontes de benchmark."""

    serializer_class = BenchmarkFonteSerializer
    queryset = BenchmarkFonte.objects.filter(is_active=True)

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAdminOrAbove()]
        return [IsAuthenticated(), IsManagerOrAbove()]


class BenchmarkIngestaoViewSet(viewsets.ModelViewSet):
    """Upload e consulta de ingestões de benchmark."""

    serializer_class = BenchmarkIngestaoSerializer
    queryset = BenchmarkIngestao.objects.select_related("fonte").order_by("-criado_em")

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    def perform_create(self, serializer: BenchmarkIngestaoSerializer) -> None:
        ing = serializer.save(criado_por=self.request.user)

        # Dispara task Celery se arquivo presente
        if ing.arquivo:
            from apps.pricing_benchmark.tasks import task_processar_pdf_seguradora
            from django.db import connection

            task_processar_pdf_seguradora.delay(ing.pk, connection.schema_name)
            logger.info(f"[benchmark] task de ingestão disparada id={ing.pk}")


class BenchmarkAmostraViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta e revisão de amostras de benchmark."""

    serializer_class = BenchmarkAmostraSerializer

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = BenchmarkAmostra.objects.select_related(
            "ingestao", "fonte", "servico_canonico", "peca_canonica",
            "segmento", "tamanho",
        ).order_by("-ingestao__criado_em")

        revisao_pendente = self.request.query_params.get("revisao_pendente")
        if revisao_pendente == "1":
            qs = qs.filter(revisado=False, descartada=False)

        ingestao_id = self.request.query_params.get("ingestao")
        if ingestao_id:
            qs = qs.filter(ingestao_id=ingestao_id)

        return qs

    @action(detail=True, methods=["post"], url_path="aceitar-match")
    def aceitar_match(self, request, pk=None):
        """Aceita match manual e cria alias."""
        ser = AceitarMatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        from apps.pricing_benchmark.services import AliasFeedbackService

        try:
            result = AliasFeedbackService.aceitar_match(
                amostra_id=str(pk),
                canonical_id=str(ser.validated_data["canonical_id"]),
                user_id=str(request.user.pk),
            )
            return Response(result)
        except Exception as exc:
            logger.error(f"[benchmark] erro aceitar_match amostra={pk}: {exc}")
            return Response(
                {"erro": "Erro interno ao aceitar match."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="descartar")
    def descartar(self, request, pk=None):
        """Descarta uma amostra do benchmark."""
        ser = DescartarAmostraSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        from apps.pricing_benchmark.services import AliasFeedbackService

        AliasFeedbackService.descartar(
            amostra_id=str(pk),
            motivo=ser.validated_data["motivo"],
            user_id=str(request.user.pk),
        )
        return Response({"status": "descartada"})


class BenchmarkEstatisticasView(viewsets.ViewSet):
    """Estatísticas de benchmark por serviço."""

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    @action(detail=False, methods=["get"], url_path=r"servico/(?P<servico_id>[^/.]+)")
    def servico(self, request, servico_id=None):
        """Estatísticas de um serviço: p50, p90, min, max, count."""
        segmento = request.query_params.get("segmento", "")
        tamanho = request.query_params.get("tamanho", "")

        from apps.pricing_engine.services.benchmark import BenchmarkService

        stats = BenchmarkService.estatisticas_servico(servico_id, segmento, tamanho)
        return Response(stats)


class IAComposicaoViewSet(viewsets.ViewSet):
    """Sugestão de composição via Claude e histórico de sugestões."""

    def get_permissions(self) -> list:  # type: ignore[override]
        return [IsAuthenticated(), IsManagerOrAbove()]

    @action(detail=False, methods=["post"], url_path="sugerir-composicao")
    def sugerir_composicao(self, request):
        """Chama Claude Sonnet 4.6 e retorna composição sugerida."""
        ser = SugestaoIACreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        from apps.pricing_benchmark.services import IAComposicaoService, IAComposicaoInvalida
        from apps.pricing_catalog.models import PecaCanonica, ServicoCanonico

        briefing = ser.validated_data["briefing"]
        veiculo = ser.validated_data["veiculo"]
        orcamento_id = ser.validated_data.get("orcamento_id")

        # Monta contexto reduzido para o Claude (max 50 de cada)
        servicos_ctx = list(
            ServicoCanonico.objects.values("codigo", "nome")[:50]
        )
        pecas_ctx = list(
            PecaCanonica.objects.values("codigo", "nome")[:50]
        )

        import time
        t0 = time.perf_counter()
        try:
            resultado = IAComposicaoService.sugerir(briefing, veiculo, servicos_ctx, pecas_ctx)
        except IAComposicaoInvalida as exc:
            return Response(
                {"erro": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        except Exception as exc:
            logger.error(f"[ia] erro sugestão: {exc}")
            return Response(
                {"erro": "Erro interno ao chamar IA."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        # Persiste para aprendizado
        sugestao = SugestaoIA.objects.create(
            orcamento_id=orcamento_id,
            briefing=briefing,
            veiculo_info=veiculo,
            resposta_raw=resultado,
            modelo_usado="claude-sonnet-4-6",
            tempo_resposta_ms=elapsed_ms,
            criado_por=request.user,
        )

        return Response({"sugestao_id": str(sugestao.id), "resultado": resultado})

    @action(detail=True, methods=["post"], url_path="avaliar")
    def avaliar(self, request, pk=None):
        """Registra avaliação e itens aceitos da sugestão IA."""
        ser = AvaliarSugestaoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            sugestao = SugestaoIA.objects.get(id=pk)
        except SugestaoIA.DoesNotExist:
            return Response({"erro": "Sugestão não encontrada."}, status=status.HTTP_404_NOT_FOUND)

        sugestao.avaliacao = ser.validated_data["avaliacao"]
        sugestao.save(update_fields=["avaliacao"])

        if ser.validated_data.get("servicos_aceitos_ids"):
            sugestao.servicos_aceitos.set(ser.validated_data["servicos_aceitos_ids"])
        if ser.validated_data.get("pecas_aceitas_ids"):
            sugestao.pecas_aceitas.set(ser.validated_data["pecas_aceitas_ids"])

        return Response({"status": "avaliado"})

    def list(self, request):
        """Histórico de sugestões IA."""
        qs = SugestaoIA.objects.order_by("-criado_em")[:100]
        return Response(SugestaoIASerializer(qs, many=True).data)
