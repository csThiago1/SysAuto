"""
Paddock Solutions — Accounts Payable Filters
"""
import django_filters

from .models import PayableDocument, Supplier


class SupplierFilter(django_filters.FilterSet):
    """Filtros para listagem de fornecedores."""

    search = django_filters.CharFilter(field_name="name", lookup_expr="icontains")

    class Meta:
        model = Supplier
        fields = ["search", "is_active"]


class PayableDocumentFilter(django_filters.FilterSet):
    """Filtros para listagem de titulos a pagar."""

    status = django_filters.CharFilter(field_name="status")
    origin = django_filters.CharFilter(field_name="origin")
    supplier = django_filters.UUIDFilter(field_name="supplier__id")
    due_date_gte = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    due_date_lte = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")
    search = django_filters.CharFilter(field_name="description", lookup_expr="icontains")

    class Meta:
        model = PayableDocument
        fields = ["status", "origin", "supplier", "due_date_gte", "due_date_lte", "search"]
