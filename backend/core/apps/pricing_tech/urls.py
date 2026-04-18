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

# SimpleRouter — ViewSet com @action customizados (evita conflito de prefixo)
ficha_router = SimpleRouter()
ficha_router.register(r"", views.FichaTecnicaServicoViewSet, basename="ficha-tecnica")

urlpatterns = [
    path("", include(ficha_router.urls)),
]
