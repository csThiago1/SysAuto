from rest_framework.routers import SimpleRouter

from .views import ImportAttemptViewSet

router = SimpleRouter()
router.register(r"attempts", ImportAttemptViewSet, basename="import-attempt")

urlpatterns = router.urls
