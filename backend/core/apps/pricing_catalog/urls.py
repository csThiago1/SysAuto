"""
Paddock Solutions — Pricing Catalog — URLs
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Padrão CLAUDE.md:
  - SimpleRouter para ViewSets com @action customizados (evita conflito de prefixo)
  - SimpleRouters incluídos ANTES do DefaultRouter principal
  - DefaultRouter apenas para ViewSets sem @action em rota vazia

Endpoints registrados:
  GET/POST        /api/v1/pricing/catalog/categorias-servico/
  GET/POST        /api/v1/pricing/catalog/categorias-mao-obra/
  GET/POST        /api/v1/pricing/catalog/servicos/
  POST            /api/v1/pricing/catalog/servicos/match/
  GET/POST        /api/v1/pricing/catalog/materiais/
  POST            /api/v1/pricing/catalog/materiais/match/
  GET/POST        /api/v1/pricing/catalog/insumos/
  POST            /api/v1/pricing/catalog/insumos/by-gtin/
  GET/POST        /api/v1/pricing/catalog/pecas/
  POST            /api/v1/pricing/catalog/pecas/match/
  GET/POST        /api/v1/pricing/catalog/fornecedores/
  GET/POST        /api/v1/pricing/catalog/aliases/servico/
  GET             /api/v1/pricing/catalog/aliases/servico/revisao/
  POST            /api/v1/pricing/catalog/aliases/servico/{id}/approve/
  POST            /api/v1/pricing/catalog/aliases/servico/{id}/reject/
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from apps.pricing_catalog import views

# ── DefaultRouter — ViewSets sem @action em rota raiz ─────────────────────
router = DefaultRouter()
router.register(
    r"categorias-servico", views.CategoriaServicoViewSet, basename="categoria-servico"
)
router.register(
    r"categorias-mao-obra", views.CategoriaMaoObraViewSet, basename="categoria-mao-obra"
)
router.register(r"fornecedores", views.FornecedorViewSet, basename="fornecedor")

# ── SimpleRouters — ViewSets com @action customizados ─────────────────────
# Registrar com prefixo vazio + incluir com path explícito ANTES do router principal
# (padrão CLAUDE.md para evitar que DefaultRouter capture ações como PK)

servico_router = SimpleRouter()
servico_router.register(r"", views.ServicoCanonicoViewSet, basename="servico-canonico")

material_router = SimpleRouter()
material_router.register(r"", views.MaterialCanonicoViewSet, basename="material-canonico")

insumo_router = SimpleRouter()
insumo_router.register(r"", views.InsumoMaterialViewSet, basename="insumo-material")

peca_router = SimpleRouter()
peca_router.register(r"", views.PecaCanonicoViewSet, basename="peca-canonica")

alias_servico_router = SimpleRouter()
alias_servico_router.register(
    r"", views.AliasServicoViewSet, basename="alias-servico"
)

urlpatterns = [
    # ViewSets com @action — SimpleRouters ANTES do DefaultRouter
    path("servicos/", include(servico_router.urls)),
    path("materiais/", include(material_router.urls)),
    path("insumos/", include(insumo_router.urls)),
    path("pecas/", include(peca_router.urls)),
    path("aliases/servico/", include(alias_servico_router.urls)),
    # DefaultRouter — ViewSets simples
    path("", include(router.urls)),
]
