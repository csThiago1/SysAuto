"""
Paddock Solutions — Followups URLs
"""

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import FollowUpRuleViewSet, FollowUpViewSet

# Prefixo explícito para "rules" ANTES do router raiz — sem isso o router em ""
# capturaria "rules" como pk.
rules_router = SimpleRouter()
rules_router.register(r"rules", FollowUpRuleViewSet, basename="followup-rule")

router = SimpleRouter()
router.register(r"", FollowUpViewSet, basename="followup")

urlpatterns = [
    path("", include(rules_router.urls)),
    path("", include(router.urls)),
]
