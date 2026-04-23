# backend/core/apps/budgets/urls.py
from rest_framework_nested import routers

from .views import BudgetVersionItemViewSet, BudgetVersionViewSet, BudgetViewSet

router = routers.SimpleRouter()
router.register(r"", BudgetViewSet, basename="budget")

budgets_router = routers.NestedSimpleRouter(router, r"", lookup="budget")
budgets_router.register(r"versions", BudgetVersionViewSet, basename="budget-version")

versions_router = routers.NestedSimpleRouter(
    budgets_router, r"versions", lookup="version",
)
versions_router.register(r"items", BudgetVersionItemViewSet, basename="budget-item")

urlpatterns = router.urls + budgets_router.urls + versions_router.urls
