"""
Paddock Solutions — Parts Catalog URLs
"""
from rest_framework.routers import SimpleRouter

from apps.parts_catalog.views import (
    PartApplicationViewSet,
    PartCategoryViewSet,
    PartReferenceViewSet,
)

router = SimpleRouter()
router.register(r"categories", PartCategoryViewSet, basename="part-category")
router.register(r"references", PartReferenceViewSet, basename="part-reference")
router.register(r"applications", PartApplicationViewSet, basename="part-application")

urlpatterns = router.urls
