"""
Paddock Solutions — URL Configuration
"""
from django.conf import settings
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
    path("api/v1/persons/", include("apps.persons.urls")),
    path("api/v1/service-orders/", include("apps.service_orders.urls")),
    path("api/v1/inventory/", include("apps.inventory.urls")),
    path("api/v1/fiscal/", include("apps.fiscal.urls")),
    path("api/v1/crm/", include("apps.crm.urls")),
    path("api/v1/store/", include("apps.store.urls")),
    path("api/v1/ai/", include("apps.ai.urls")),
    path("api/v1/experts/", include("apps.experts.urls")),
    path("api/v1/insurers/", include("apps.insurers.urls")),
    path("api/v1/vehicle-catalog/", include("apps.vehicle_catalog.urls")),
    path("api/v1/pricing/", include("apps.pricing_profile.urls")),
    path("api/v1/pricing/catalog/", include("apps.pricing_catalog.urls")),
    path("api/v1/pricing/fichas/", include("apps.pricing_tech.urls")),
    path("api/v1/pricing/engine/", include("apps.pricing_engine.urls")),
    path("api/v1/cilia/", include("apps.cilia.urls")),
    path("api/v1/imports/", include("apps.imports.urls")),
    path("api/v1/hr/", include("apps.hr.urls")),
    path("api/v1/accounting/", include("apps.accounting.urls")),
    path("api/v1/accounts-payable/", include("apps.accounts_payable.urls")),
    path("api/v1/accounts-receivable/", include("apps.accounts_receivable.urls")),
    path("api/v1/quotes/", include("apps.quotes.urls")),
    path("api/v1/pricing/", include("apps.pricing_benchmark.urls")),
    path("api/v1/signatures/", include("apps.signatures.urls")),
    path("api/v1/authz/", include("apps.authz.urls")),
    path("api/v1/vehicles/", include("apps.vehicles.urls")),
    # MO-9: Capacidade + Variâncias
    path("api/v1/capacidade/", include("apps.service_orders.urls_capacidade")),
    path("api/v1/pricing/variancias/", include("apps.pricing_tech.urls_variancia")),
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

if settings.DEBUG:
    import debug_toolbar
    from django.conf.urls.static import static

    urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
