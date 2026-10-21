"""
Paddock Solutions — Lookups URLs
"""

from django.urls import path, re_path

from apps.lookups.views import LookupView, MunicipioListView

urlpatterns = [
    path("municipios/", MunicipioListView.as_view(), name="lookups-municipios"),
    # Regex fechada nos tipos: "municipios/" nunca cai aqui, qualquer que seja a ordem.
    re_path(r"^(?P<kind>cep|cnpj|placa)/$", LookupView.as_view(), name="lookups-lookup"),
]
