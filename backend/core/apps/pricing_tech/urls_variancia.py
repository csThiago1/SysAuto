"""
Paddock Solutions — Pricing Tech — URLs de Variância
MO-9

Rotas:
  GET  /api/v1/pricing/variancias/fichas/         — lista VarianciaFicha
  GET  /api/v1/pricing/variancias/fichas/{id}/    — detalhe
  POST /api/v1/pricing/variancias/fichas/gerar/   — dispara task (ADMIN+)
  GET  /api/v1/pricing/variancias/pecas/          — lista VarianciaPecaCusto
  GET  /api/v1/pricing/variancias/pecas/{id}/     — detalhe
"""
from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.pricing_tech.views_variancia import VarianciaFichaViewSet, VarianciaPecaCustoViewSet

ficha_router = SimpleRouter()
ficha_router.register(r"fichas", VarianciaFichaViewSet, basename="variancia-ficha")

peca_router = SimpleRouter()
peca_router.register(r"pecas", VarianciaPecaCustoViewSet, basename="variancia-peca")

urlpatterns = [
    path("", include(ficha_router.urls)),
    path("", include(peca_router.urls)),
]
