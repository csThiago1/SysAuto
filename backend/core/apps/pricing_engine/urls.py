"""
Paddock Solutions — Pricing Engine — URLs
Motor de Orçamentos (MO) — Sprint 03: Adapters de Custo

Rotas registradas em /api/v1/pricing/engine/:
  GET/POST/...  parametros/rateio/
  GET/POST/...  parametros/custo-hora/
  GET/POST/...  parametros/custo-hora-fallback/
  POST          debug/custo-hora/
  POST          debug/rateio/
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.pricing_engine.views import (
    CustoHoraFallbackViewSet,
    DebugCustoHoraView,
    DebugCustoInsumoView,
    DebugCustoPecaView,
    DebugRateioView,
    ParametroCustoHoraViewSet,
    ParametroRateioViewSet,
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

urlpatterns = [
    # Debug endpoints — antes do router para evitar colisão com DefaultRouter
    path("debug/custo-hora/", DebugCustoHoraView.as_view(), name="debug-custo-hora"),
    path("debug/rateio/", DebugRateioView.as_view(), name="debug-rateio"),
    path("debug/custo-peca/", DebugCustoPecaView.as_view(), name="debug-custo-peca"),
    path("debug/custo-insumo/", DebugCustoInsumoView.as_view(), name="debug-custo-insumo"),
    path("", include(router.urls)),
]
