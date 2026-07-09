from django.urls import path

from apps.notifications.views import (
    NotificationPreferenceView,
    PushSubscribeView,
    PushTestView,
)

urlpatterns = [
    path("subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("preferences/", NotificationPreferenceView.as_view(), name="push-preferences"),
    path("test/", PushTestView.as_view(), name="push-test"),
]
