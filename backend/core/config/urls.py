from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", healthcheck),
    # OpenAPI
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/v1/schema/swagger/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="swagger"),
    # Auth JWT
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Persons / Vehicles (existing)
    path("api/v1/persons/", include("apps.persons.urls")),
    path("api/v1/vehicles/", include("apps.vehicles.urls")),
    # Modules
    path("api/v1/", include("apps.items.urls")),
    path("api/v1/", include("apps.budgets.urls")),
    path("api/v1/", include("apps.service_orders.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.imports.urls")),
]
