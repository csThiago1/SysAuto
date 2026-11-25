from django.urls import path

from apps.realtime.views import TicketView

urlpatterns = [path("ticket/", TicketView.as_view(), name="realtime-ticket")]
