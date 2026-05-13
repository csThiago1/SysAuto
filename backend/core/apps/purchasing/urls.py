from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.purchasing.views import (
    AdicionarItemOCView,
    CotacaoLogViewSet,
    DashboardComprasView,
    OrdemCompraViewSet,
    PedidoCompraViewSet,
    RegistrarRecebimentoView,
    RemoverItemOCView,
    RespostaCotacaoViewSet,
)

router = SimpleRouter()
router.register(r"pedidos", PedidoCompraViewSet, basename="pedido-compra")
router.register(r"ordens-compra", OrdemCompraViewSet, basename="ordem-compra")
router.register(r"cotacao-logs", CotacaoLogViewSet, basename="cotacao-log")
router.register(r"respostas-cotacao", RespostaCotacaoViewSet, basename="resposta-cotacao")

urlpatterns = [
    path(
        "ordens-compra/<uuid:oc_id>/itens/",
        AdicionarItemOCView.as_view(),
        name="oc-adicionar-item",
    ),
    path(
        "ordens-compra/<uuid:oc_id>/itens/<uuid:item_id>/",
        RemoverItemOCView.as_view(),
        name="oc-remover-item",
    ),
    path(
        "ordens-compra/<uuid:oc_id>/itens/<uuid:item_id>/receber/",
        RegistrarRecebimentoView.as_view(),
        name="oc-receber-item",
    ),
    path("dashboard-stats/", DashboardComprasView.as_view(), name="dashboard-compras"),
    path("", include(router.urls)),
]
