from django.urls import path
from apps.cilia.views import consultar_orcamento

app_name = "cilia"

urlpatterns = [
    path("consultar/", consultar_orcamento, name="cilia-consultar"),
]
