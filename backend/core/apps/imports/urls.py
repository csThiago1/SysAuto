"""URL routing do app imports."""
from rest_framework.routers import DefaultRouter

from .views import ImportAttemptViewSet


router = DefaultRouter()
router.register(r"imports/attempts", ImportAttemptViewSet, basename="import-attempt")
# O action `fetch_cilia` fica em /api/v1/imports/attempts/cilia/fetch/
# (detail=False com url_path="cilia/fetch")

urlpatterns = router.urls
