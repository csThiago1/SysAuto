"""
Paddock Solutions — Accounting URLs
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChartOfAccountViewSet,
    CostCenterViewSet,
    DespesaRecorrenteViewSet,
    FiscalPeriodViewSet,
    FiscalYearViewSet,
    JournalEntryViewSet,
)

router = DefaultRouter()
router.register(r"chart-of-accounts", ChartOfAccountViewSet, basename="chart-of-account")
router.register(r"cost-centers", CostCenterViewSet, basename="cost-center")
router.register(r"despesas-recorrentes", DespesaRecorrenteViewSet, basename="despesa-recorrente")
router.register(r"fiscal-years", FiscalYearViewSet, basename="fiscal-year")
router.register(r"fiscal-periods", FiscalPeriodViewSet, basename="fiscal-period")
router.register(r"journal-entries", JournalEntryViewSet, basename="journal-entry")

urlpatterns = [
    path("", include(router.urls)),
]
