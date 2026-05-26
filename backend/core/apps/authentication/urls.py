from django.conf import settings
from django.urls import path

from .views import (
    ForgotPasswordView,
    LoginView,
    MeView,
    PushTokenView,
    RefreshView,
    RegisterView,
    ResetPasswordView,
    StaffDetailView,
    StaffListView,
    VerifyEmailView,
)

urlpatterns = [
    # Auth endpoints (native JWT)
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("register/", RegisterView.as_view(), name="auth-register"),
    # Staff management
    path("push-token/", PushTokenView.as_view(), name="auth-push-token"),
    path("staff/", StaffListView.as_view(), name="auth-staff-list"),
    path("staff/<str:pk>/", StaffDetailView.as_view(), name="auth-staff-detail"),
]

if settings.DEBUG:
    from .views import DevTokenView

    urlpatterns += [
        path("dev-token/", DevTokenView.as_view(), name="auth-dev-token"),
    ]
