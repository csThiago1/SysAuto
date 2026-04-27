from django.conf import settings
from django.urls import path

from .views import MeView, PushTokenView, StaffDetailView, StaffListView

urlpatterns = [
    path("me/", MeView.as_view(), name="auth-me"),
    path("push-token/", PushTokenView.as_view(), name="auth-push-token"),
    path("staff/", StaffListView.as_view(), name="auth-staff-list"),
    path("staff/<str:pk>/", StaffDetailView.as_view(), name="auth-staff-detail"),
]

if settings.DEBUG:
    from .views import DevTokenView

    urlpatterns += [
        path("dev-token/", DevTokenView.as_view(), name="auth-dev-token"),
    ]
