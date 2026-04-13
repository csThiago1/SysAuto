from django.urls import path

from .views import DevTokenView, MeView, PushTokenView, StaffDetailView, StaffListView

urlpatterns = [
    path("me/", MeView.as_view(), name="auth-me"),
    path("dev-token/", DevTokenView.as_view(), name="auth-dev-token"),
    path("push-token/", PushTokenView.as_view(), name="auth-push-token"),
    path("staff/", StaffListView.as_view(), name="auth-staff-list"),
    path("staff/<str:pk>/", StaffDetailView.as_view(), name="auth-staff-detail"),
]
