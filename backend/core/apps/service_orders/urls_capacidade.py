"""
Paddock Solutions — Service Orders — URLs de Capacidade
MO-9: Endpoints de capacidade técnica.

Rotas:
  GET/POST/...  /api/v1/capacidade/capacidades/    — CapacidadeTecnico CRUD
  GET/POST/...  /api/v1/capacidade/bloqueios/      — BloqueioCapacidade CRUD
  GET           /api/v1/capacidade/utilizacao/     — utilização por categoria+período
  GET           /api/v1/capacidade/heatmap-semana/ — heatmap semanal
  GET           /api/v1/capacidade/proxima-data/   — próxima data disponível
"""
from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.service_orders.views_capacidade import (
    BloqueioCapacidadeViewSet,
    CapacidadeTecnicoViewSet,
    HeatmapSemanaView,
    ProximaDataDisponivelView,
    UtilizacaoView,
)

cap_router = SimpleRouter()
cap_router.register(r"capacidades", CapacidadeTecnicoViewSet, basename="capacidade-tecnico")
cap_router.register(r"bloqueios", BloqueioCapacidadeViewSet, basename="bloqueio-capacidade")

urlpatterns = [
    path("utilizacao/", UtilizacaoView.as_view(), name="capacidade-utilizacao"),
    path("heatmap-semana/", HeatmapSemanaView.as_view(), name="capacidade-heatmap"),
    path("proxima-data/", ProximaDataDisponivelView.as_view(), name="capacidade-proxima-data"),
    path("", include(cap_router.urls)),
]
