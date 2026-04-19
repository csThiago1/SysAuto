"""
Paddock Solutions — Quotes URLs
Motor de Orçamentos (MO) — Sprint MO-7
"""
from rest_framework.routers import DefaultRouter, SimpleRouter

from apps.quotes.views import AreaImpactoViewSet, OrcamentoViewSet

router = DefaultRouter()
router.register(r"orcamentos", OrcamentoViewSet, basename="orcamento")

# Áreas de impacto aninhadas: /orcamentos/{orcamento_pk}/areas/
area_router = SimpleRouter()
area_router.register(r"areas", AreaImpactoViewSet, basename="orcamento-area")

from django.urls import include, path  # noqa: E402

urlpatterns = [
    path("", include(router.urls)),
    path(
        "orcamentos/<uuid:orcamento_pk>/",
        include(area_router.urls),
    ),
]
