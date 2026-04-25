"""
Paddock Solutions — Persons Views
CRM tenant-level: clientes, seguradoras, corretores, funcionários, fornecedores.

LGPD (Ciclo 06A):
  - PersonDocument retorna PII mascarada por padrão
  - GET /persons/{id}/documents/ retorna plain apenas para fiscal_admin
"""

import json
import logging
import urllib.error
import urllib.request

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .models import CargoPessoa, Person, PersonDocument, SetorPessoa
from .serializers import (
    PersonCreateUpdateSerializer,
    PersonDetailSerializer,
    PersonDocumentMaskedSerializer,
    PersonDocumentPlainSerializer,
    PersonListSerializer,
)

logger = logging.getLogger(__name__)


class PersonViewSet(viewsets.ModelViewSet):
    """ViewSet CRUD para pessoas do tenant."""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    queryset = Person.objects.prefetch_related(
        "roles", "contacts", "addresses", "documents"
    ).order_by("-created_at")
    filterset_fields = ["person_kind", "is_active"]
    search_fields = ["full_name", "fantasy_name", "legacy_code"]

    def get_permissions(self) -> list:  # type: ignore[override]
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(roles__role=role)
        kind = self.request.query_params.get("kind")
        if kind:
            qs = qs.filter(person_kind=kind)
        office_id = self.request.query_params.get("office_id")
        if office_id:
            qs = qs.filter(broker_person__office__person_id=office_id)
        return qs.filter(is_active=True).distinct()

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return PersonListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PersonCreateUpdateSerializer
        return PersonDetailSerializer

    def destroy(self, request, *args, **kwargs):  # type: ignore[override]
        """Soft delete — nunca remove do banco (LGPD: retenção obrigatória)."""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=204)

    @action(detail=True, methods=["get"], url_path="documents")
    def documents(self, request, pk: str | None = None) -> Response:
        """
        GET /persons/{id}/documents/

        Retorna documentos mascarados por padrão.
        Usuários com permissão 'persons.view_document_plain' (fiscal_admin)
        recebem os documentos em plaintext.

        LGPD Art. 46 — acesso a PII apenas quando necessário para finalidade específica.
        """
        person = self.get_object()
        qs = PersonDocument.objects.filter(person=person)
        can_view_plain = request.user.has_perm("persons.view_document_plain")

        if can_view_plain:
            serializer = PersonDocumentPlainSerializer(qs, many=True)
        else:
            serializer = PersonDocumentMaskedSerializer(qs, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="cep/(?P<cep>[0-9]{8})")
    def cep_lookup(self, request, cep: str = "") -> Response:
        """Consulta endereço pelo CEP via ViaCEP."""
        try:
            url = f"https://viacep.com.br/ws/{cep}/json/"
            with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
                data = json.loads(resp.read().decode())
            if "erro" in data:
                return Response({"error": "CEP não encontrado"}, status=404)
            return Response(
                {
                    "zip_code": data.get("cep", ""),
                    "street": data.get("logradouro", ""),
                    "neighborhood": data.get("bairro", ""),
                    "city": data.get("localidade", ""),
                    "state": data.get("uf", ""),
                    "complement": data.get("complemento", ""),
                }
            )
        except urllib.error.URLError:
            return Response({"error": "Erro ao consultar CEP"}, status=400)
        except Exception:
            logger.exception("Erro inesperado no lookup de CEP %s", cep)
            return Response({"error": "Erro interno"}, status=500)

    @action(detail=False, methods=["get"], url_path="employee-options")
    def employee_options(self, request) -> Response:
        """
        GET /persons/employee-options/
        Retorna as opções válidas de cargo e setor para funcionários.
        Usado pelo frontend para popular os selects sem hardcodar valores.
        """
        return Response(
            {
                "job_titles": [{"value": v, "label": l} for v, l in CargoPessoa.choices],
                "departments": [{"value": v, "label": l} for v, l in SetorPessoa.choices],
            }
        )
