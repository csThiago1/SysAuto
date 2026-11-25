from django.db import connection
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.realtime.tickets import make_ticket


class TicketView(APIView):
    """Emite o ticket do usuário logado, preso ao tenant da requisição."""

    def get(self, request: Request) -> Response:
        return Response({"ticket": make_ticket(str(request.user.pk), connection.schema_name)})
