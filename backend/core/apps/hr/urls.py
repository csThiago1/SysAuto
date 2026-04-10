"""
Paddock Solutions — HR URLs
Sprint 5 + Sprint 6.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AllowanceViewSet,
    BonusViewSet,
    DeductionViewSet,
    EmployeeDocumentViewSet,
    EmployeeViewSet,
    GoalTargetViewSet,
    PayslipViewSet,
    SalaryHistoryViewSet,
    TimeClockViewSet,
    WorkScheduleViewSet,
)

router = DefaultRouter()
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"goals", GoalTargetViewSet, basename="goal")
router.register(r"allowances", AllowanceViewSet, basename="allowance")
router.register(r"time-clock", TimeClockViewSet, basename="timeclock")
router.register(r"payslips", PayslipViewSet, basename="payslip")

urlpatterns = [
    path("", include(router.urls)),
    # ── Nested em employee ────────────────────────────────────────────────────
    path(
        "employees/<uuid:employee_pk>/documents/",
        EmployeeDocumentViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-documents-list",
    ),
    path(
        "employees/<uuid:employee_pk>/documents/<uuid:pk>/",
        EmployeeDocumentViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="employee-documents-detail",
    ),
    path(
        "employees/<uuid:employee_pk>/salary-history/",
        SalaryHistoryViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-salary-history-list",
    ),
    path(
        "employees/<uuid:employee_pk>/bonuses/",
        BonusViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-bonuses-list",
    ),
    path(
        "employees/<uuid:employee_pk>/allowances/",
        AllowanceViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-allowances-list",
    ),
    path(
        "employees/<uuid:employee_pk>/deductions/",
        DeductionViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-deductions-list",
    ),
    path(
        "employees/<uuid:employee_pk>/schedules/",
        WorkScheduleViewSet.as_view({"get": "list", "post": "create"}),
        name="employee-schedules-list",
    ),
]
