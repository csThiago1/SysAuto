"""
Paddock Solutions — Banks Views
CRUD de bancos (schema público). logo_url é um campo de texto simples
(cole a URL do logo) — sem endpoint de upload dedicado.
"""
import logging

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import PermissionsByActionMixin
from apps.banks.models import Bank
from apps.banks.serializers import BankSerializer

logger = logging.getLogger(__name__)


class BankViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """
    - list / retrieve: qualquer usuário autenticado
    - create / update / destroy: MANAGER+
    """

    read_permission = IsAuthenticated
    serializer_class = BankSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "name"]

    def get_queryset(self):  # type: ignore[override]
        if self.action == "list":
            return Bank.objects.filter(is_active=True)
        return Bank.objects.all()
