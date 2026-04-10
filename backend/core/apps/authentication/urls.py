from django.urls import path

from .views import MeView, StaffDetailView, StaffListView

urlpatterns = [
    path("me/", MeView.as_view(), name="auth-me"),
    path("staff/", StaffListView.as_view(), name="auth-staff-list"),
    path("staff/<str:pk>/", StaffDetailView.as_view(), name="auth-staff-detail"),
]
