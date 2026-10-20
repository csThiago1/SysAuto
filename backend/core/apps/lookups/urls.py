"""
Paddock Solutions — Lookups URLs
"""

from django.urls import path

from apps.lookups.views import MunicipioListView

urlpatterns = [
    path("municipios/", MunicipioListView.as_view(), name="lookups-municipios"),
]
