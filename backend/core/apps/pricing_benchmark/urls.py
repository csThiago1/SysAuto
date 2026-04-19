"""
Paddock Solutions — Pricing Benchmark — URLs
Motor de Orçamentos (MO) — Sprint MO-8

Endpoints:
  /api/v1/pricing/benchmark/fontes/
  /api/v1/pricing/benchmark/ingestoes/
  /api/v1/pricing/benchmark/amostras/
  /api/v1/pricing/benchmark/estatisticas/servico/{id}/
  /api/v1/pricing/ia/sugestoes/
  /api/v1/pricing/ia/sugerir-composicao/
  /api/v1/pricing/ia/{id}/avaliar/
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from apps.pricing_benchmark.views import (
    BenchmarkAmostraViewSet,
    BenchmarkEstatisticasView,
    BenchmarkFonteViewSet,
    BenchmarkIngestaoViewSet,
    IAComposicaoViewSet,
)

router = DefaultRouter()
router.register(r"fontes", BenchmarkFonteViewSet, basename="benchmark-fonte")
router.register(r"ingestoes", BenchmarkIngestaoViewSet, basename="benchmark-ingestao")
router.register(r"amostras", BenchmarkAmostraViewSet, basename="benchmark-amostra")
router.register(r"estatisticas", BenchmarkEstatisticasView, basename="benchmark-stats")

ia_router = SimpleRouter()
ia_router.register(r"", IAComposicaoViewSet, basename="ia-composicao")

urlpatterns = [
    path("benchmark/", include(router.urls)),
    path("ia/", include(ia_router.urls)),
]
