from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.purchasing.views import (
    AdicionarItemOCView,
    DashboardComprasView,
    OrdemCompraViewSet,
    PedidoCompraViewSet,
    RegistrarRecebimentoView,
    RemoverItemOCView,
)

router = SimpleRouter()
router.register(r"pedidos", PedidoCompraViewSet, basename="pedido-compra")
router.register(r"ordens-compra", OrdemCompraViewSet, basename="ordem-compra")

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
