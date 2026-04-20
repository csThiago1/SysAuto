"""
Paddock Solutions — Pricing Tech — URLs
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

Padrão CLAUDE.md: SimpleRouter para ViewSets com @action customizados,
incluído em config/urls.py sob /api/v1/pricing/fichas/.

Endpoints registrados:
  GET        /api/v1/pricing/fichas/                — lista fichas ativas (MANAGER+)
  GET        /api/v1/pricing/fichas/{id}/           — detalhe da ficha (MANAGER+)
  POST       /api/v1/pricing/fichas/resolver/       — resolve ficha para servico+tipo_pintura (MANAGER+)
  POST       /api/v1/pricing/fichas/{id}/nova-versao/ — cria nova versão (MANAGER+)
  DELETE     /api/v1/pricing/fichas/{id}/           — soft-delete (ADMIN+)
"""
from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.pricing_tech import views
from apps.pricing_tech.views_variancia import VarianciaFichaViewSet, VarianciaPecaCustoViewSet

# SimpleRouter — ViewSet com @action customizados (evita conflito de prefixo)
ficha_router = SimpleRouter()
ficha_router.register(r"", views.FichaTecnicaServicoViewSet, basename="ficha-tecnica")

variancia_ficha_router = SimpleRouter()
variancia_ficha_router.register(r"", VarianciaFichaViewSet, basename="variancia-ficha")

variancia_peca_router = SimpleRouter()
variancia_peca_router.register(r"", VarianciaPecaCustoViewSet, basename="variancia-peca")

urlpatterns = [
    path("", include(ficha_router.urls)),
]

# Exportado para inclusão em config/urls.py separadamente
variancia_urlpatterns = [
    path("fichas/", include(variancia_ficha_router.urls)),
    path("pecas/", include(variancia_peca_router.urls)),
]
