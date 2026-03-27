from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", healthcheck),
    # Auth JWT
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Apps
    path("api/v1/persons/", include("apps.persons.urls")),
    path("api/v1/service-orders/", include("apps.service_orders.urls")),
    path("api/v1/vehicles/", include("apps.vehicles.urls")),
]
