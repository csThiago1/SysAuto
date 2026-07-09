"""API Web Push — subscribe/unsubscribe/preferences/test (spec 2026-06-22)."""
import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import NotificationPreference, PushSubscription
from apps.notifications.serializers import (
    NotificationPreferenceSerializer,
    PushSubscribeSerializer,
    PushUnsubscribeSerializer,
)

logger = logging.getLogger(__name__)


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PushSubscribeSerializer, responses={201: None}, summary="Registrar subscription Web Push")
    def post(self, request: Request) -> Response:
        serializer = PushSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        PushSubscription.objects.update_or_create(
            endpoint=d["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": d["keys"]["p256dh"],
                "auth": d["keys"]["auth"],
                "device_id": d.get("device_id", ""),
                "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300],
                "is_active": True,
            },
        )
        return Response(status=status.HTTP_201_CREATED)

    @extend_schema(request=PushUnsubscribeSerializer, responses={204: None}, summary="Remover subscription Web Push")
    def delete(self, request: Request) -> Response:
        serializer = PushUnsubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushSubscription.objects.filter(
            user=request.user, endpoint=serializer.validated_data["endpoint"]
        ).update(is_active=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=NotificationPreferenceSerializer, summary="Preferências de notificação")
    def get(self, request: Request) -> Response:
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response(NotificationPreferenceSerializer(pref).data)

    @extend_schema(
        request=NotificationPreferenceSerializer,
        responses=NotificationPreferenceSerializer,
        summary="Atualizar preferências de notificação",
    )
    def patch(self, request: Request) -> Response:
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PushTestView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: None}, summary="Enviar push de teste pro próprio usuário")
    def post(self, request: Request) -> Response:
        from apps.notifications.services import send_push

        result = send_push(
            request.user.pk,
            title="DS Car ERP",
            body="Notificações funcionando neste dispositivo.",
            url="/dashboard",
        )
        return Response(result)
