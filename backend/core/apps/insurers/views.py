"""
Paddock Solutions — Insurers Views
CRUD de seguradoras (schema público) + upload de logo via S3/local.
"""
import logging
import os
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connection
from rest_framework import filters, mixins, parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsManagerOrAbove

from apps.insurers.models import Insurer, InsurerTenantProfile
from apps.insurers.serializers import (
    InsurerMinimalSerializer,
    InsurerSerializer,
    InsurerTenantProfileSerializer,
)

logger = logging.getLogger(__name__)

MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB


def _logo_extension(file: object) -> str | None:
    """Retorna extensão (.png ou .svg) baseado em content_type e nome do arquivo."""
    content_type: str = getattr(file, "content_type", "") or ""
    name: str = getattr(file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()

    if content_type == "image/png" or ext == ".png":
        return ".png"
    if content_type in ("image/svg+xml", "text/xml", "application/xml") or ext == ".svg":
        return ".svg"
    return None


class InsurerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRUD de seguradoras.

    - list / retrieve: qualquer usuário autenticado
    - create / update / destroy: MANAGER+
    - upload_logo: POST {id}/upload_logo/ — MANAGER+
    """

    permission_classes = [IsAuthenticated]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy", "upload_logo"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated()]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "trade_name", "abbreviation"]

    def get_queryset(self):  # type: ignore[override]
        if self.action == "list":
            return Insurer.objects.filter(is_active=True)
        return Insurer.objects.all()

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return InsurerMinimalSerializer
        return InsurerSerializer

    @action(
        detail=True,
        methods=["post"],
        url_path="upload_logo",
        parser_classes=[parsers.MultiPartParser],
    )
    def upload_logo(self, request: Request, pk: str | None = None) -> Response:
        """
        Faz upload da logo (PNG ou SVG) para storage e atualiza logo_url.

        Request: multipart/form-data com campo "logo" (arquivo).
        Response: InsurerSerializer com logo_url atualizado.
        """
        insurer: Insurer = self.get_object()

        file = request.FILES.get("logo")
        if not file:
            return Response(
                {"detail": "Arquivo não enviado. Envie o campo 'logo'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = _logo_extension(file)
        if ext is None:
            return Response(
                {"detail": "Formato inválido. Envie PNG ou SVG."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > MAX_LOGO_SIZE:
            return Response(
                {"detail": "Arquivo muito grande. Tamanho máximo: 2 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Salva via default_storage (local em dev, S3 em prod)
        storage_path = f"insurers/logos/{uuid.uuid4()}{ext}"
        saved_path = default_storage.save(storage_path, ContentFile(file.read()))
        new_url = default_storage.url(saved_path)

        # Remove logo anterior se for arquivo gerenciado pelo storage
        if insurer.logo_url:
            old_path = _extract_storage_path(insurer.logo_url)
            if old_path and default_storage.exists(old_path):
                try:
                    default_storage.delete(old_path)
                except Exception:
                    logger.warning(
                        "Não foi possível remover logo anterior da seguradora %s",
                        insurer.id,
                    )

        insurer.logo_url = new_url
        insurer.save(update_fields=["logo_url", "updated_at"])
        logger.info("Logo atualizado para seguradora %s → %s", insurer.name, new_url)

        return Response(InsurerSerializer(insurer).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "put"], url_path="tenant_profile")
    def tenant_profile(self, request: Request, pk: str | None = None) -> Response:
        """
        GET  → retorna perfil operacional (ou defaults se não existir).
        PUT  → cria ou atualiza perfil operacional (upsert).
        """
        insurer: Insurer = self.get_object()

        company = connection.tenant
        if request.method == "GET":
            profile, _ = InsurerTenantProfile.objects.get_or_create(
                insurer=insurer, company=company
            )
            return Response(InsurerTenantProfileSerializer(profile).data)

        # PUT — upsert
        profile, _ = InsurerTenantProfile.objects.get_or_create(
            insurer=insurer, company=company
        )
        serializer = InsurerTenantProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _extract_storage_path(url: str) -> str | None:
    """
    Extrai o caminho relativo do storage a partir de uma URL.

    Funciona para URLs locais (/media/insurers/logos/x.png)
    e para URLs S3 completas.
    """
    if not url:
        return None
    # URL local: /media/insurers/logos/...
    if url.startswith("/media/"):
        return url[len("/media/"):]
    # URL S3: https://bucket.s3.region.amazonaws.com/insurers/logos/...
    if "amazonaws.com/" in url:
        return url.split("amazonaws.com/", 1)[-1].split("?")[0]
    # URL S3 path-style: https://s3.region.amazonaws.com/bucket/insurers/...
    if "s3." in url and ".amazonaws.com/" in url:
        parts = url.split(".amazonaws.com/", 1)
        if len(parts) > 1:
            path = parts[1].split("?")[0]
            # Remove bucket prefix if present
            if "/" in path:
                return path.split("/", 1)[1]
    return None
