from rest_framework.routers import DefaultRouter

from .views import ItemOperationTypeViewSet, LaborCategoryViewSet


router = DefaultRouter()
router.register(r"items/operation-types", ItemOperationTypeViewSet, basename="operation-type")
router.register(r"items/labor-categories", LaborCategoryViewSet, basename="labor-category")

urlpatterns = router.urls
