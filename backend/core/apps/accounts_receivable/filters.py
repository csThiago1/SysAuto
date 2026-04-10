"""
Paddock Solutions — Accounts Receivable Filters
"""
import django_filters

from .models import ReceivableDocument


class ReceivableDocumentFilter(django_filters.FilterSet):
    """Filtros para listagem de titulos a receber."""

    status = django_filters.CharFilter(field_name="status")
    origin = django_filters.CharFilter(field_name="origin")
    customer_id = django_filters.UUIDFilter(field_name="customer_id")
    due_date_gte = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_date_lte = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")
    search = django_filters.CharFilter(field_name="description", lookup_expr="icontains")

    class Meta:
        model = ReceivableDocument
        fields = [
            "status",
            "origin",
            "customer_id",
            "due_date_gte",
            "due_date_lte",
            "search",
        ]
