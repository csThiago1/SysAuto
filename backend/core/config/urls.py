"""
Paddock Solutions — URL Configuration
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("apps.authentication.urls")),
    path("api/v1/tenants/", include("apps.tenants.urls")),
    path("api/v1/customers/", include("apps.customers.urls")),
    path("api/v1/service-orders/", include("apps.service_orders.urls")),
    path("api/v1/inventory/", include("apps.inventory.urls")),
    path("api/v1/fiscal/", include("apps.fiscal.urls")),
    path("api/v1/crm/", include("apps.crm.urls")),
    path("api/v1/store/", include("apps.store.urls")),
    path("api/v1/ai/", include("apps.ai.urls")),
    # OIDC
    path("oidc/", include("mozilla_django_oidc.urls")),
    # API Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
