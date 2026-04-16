"""URLs do app pricing_profile."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from apps.pricing_profile import views

router = DefaultRouter()
router.register(r"empresas", views.EmpresaViewSet, basename="empresa")
router.register(r"segmentos", views.SegmentoVeicularViewSet, basename="segmento")
router.register(r"tamanhos", views.CategoriaTamanhoViewSet, basename="tamanho")
router.register(r"tipos-pintura", views.TipoPinturaViewSet, basename="tipo-pintura")
router.register(
    r"faltantes", views.EnquadramentoFaltanteViewSet, basename="enquadramento-faltante"
)

# EnquadramentoVeiculo com action /resolver/ registrado antes do router principal
# (conforme padrão CLAUDE.md para evitar conflito de roteamento)
enquadramento_router = SimpleRouter()
enquadramento_router.register(
    r"", views.EnquadramentoVeiculoViewSet, basename="enquadramento"
)

urlpatterns = [
    path("enquadramentos/", include(enquadramento_router.urls)),
    path("", include(router.urls)),
]
