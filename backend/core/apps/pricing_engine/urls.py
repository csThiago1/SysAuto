"""
Paddock Solutions — Pricing Engine — URLs
Motor de Orçamentos (MO) — Sprint 03+06: Adapters de Custo + Motor de Precificação

Rotas registradas em /api/v1/pricing/engine/:
  GET/POST/...  parametros/rateio/
  GET/POST/...  parametros/custo-hora/
  GET/POST/...  parametros/custo-hora-fallback/
  GET/POST/...  margens/
  GET/POST/...  markup-peca/
  GET           snapshots/
  GET           snapshots/{id}/
  POST          calcular-servico/
  POST          calcular-peca/
  POST          simular/
  POST          debug/custo-hora/
  POST          debug/rateio/
  POST          debug/custo-peca/
  POST          debug/custo-insumo/
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.pricing_engine.views import (
    CalcularPecaView,
    CalcularServicoView,
    CalculoCustoSnapshotViewSet,
    CustoHoraFallbackViewSet,
    DebugCustoHoraView,
    DebugCustoInsumoView,
    DebugCustoPecaView,
    DebugRateioView,
    MargemOperacaoViewSet,
    MarkupPecaViewSet,
    ParametroCustoHoraViewSet,
    ParametroRateioViewSet,
    SimularView,
)

router = DefaultRouter()
router.register(
    "parametros/rateio",
    ParametroRateioViewSet,
    basename="parametro-rateio",
)
router.register(
    "parametros/custo-hora",
    ParametroCustoHoraViewSet,
    basename="parametro-custo-hora",
)
router.register(
    "parametros/custo-hora-fallback",
    CustoHoraFallbackViewSet,
    basename="custo-hora-fallback",
)
router.register(
    "margens",
    MargemOperacaoViewSet,
    basename="margem-operacao",
)
router.register(
    "markup-peca",
    MarkupPecaViewSet,
    basename="markup-peca",
)
router.register(
    "snapshots",
    CalculoCustoSnapshotViewSet,
    basename="calculo-custo-snapshot",
)

urlpatterns = [
    # Motor — endpoints de cálculo (antes do router para evitar conflito)
    path("calcular-servico/", CalcularServicoView.as_view(), name="calcular-servico"),
    path("calcular-peca/", CalcularPecaView.as_view(), name="calcular-peca"),
    path("simular/", SimularView.as_view(), name="simular"),
    # Debug endpoints — ADMIN+ apenas
    path("debug/custo-hora/", DebugCustoHoraView.as_view(), name="debug-custo-hora"),
    path("debug/rateio/", DebugRateioView.as_view(), name="debug-rateio"),
    path("debug/custo-peca/", DebugCustoPecaView.as_view(), name="debug-custo-peca"),
    path("debug/custo-insumo/", DebugCustoInsumoView.as_view(), name="debug-custo-insumo"),
    path("", include(router.urls)),
]
