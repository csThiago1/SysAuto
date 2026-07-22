"""
Paddock Solutions — Persons Views
CRM tenant-level: clientes, seguradoras, corretores, funcionários, fornecedores.

LGPD (Ciclo 06A):
  - PersonDocument retorna PII mascarada por padrão
  - GET /persons/{id}/documents/ retorna plain apenas para fiscal_admin
"""

import logging

import httpx
from django.core.cache import cache
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import PermissionsByActionMixin

from .models import (
    CargoPessoa, ExpertProfile, Person, PersonDocument, SetorPessoa, SupplierProfile,
)
from .serializers import (
    ExpertProfileSerializer,
    PersonCreateUpdateSerializer,
    PersonDetailSerializer,
    PersonDocumentMaskedSerializer,
    PersonDocumentPlainSerializer,
    PersonListSerializer,
    SupplierProfileSerializer,
)

logger = logging.getLogger(__name__)


class PersonViewSet(PermissionsByActionMixin, viewsets.ModelViewSet):
    """ViewSet CRUD para pessoas do tenant."""

    queryset = Person.objects.all()
    filterset_fields = ["person_kind", "is_active"]
    search_fields = ["full_name", "fantasy_name", "legacy_code"]

    def get_queryset(self):  # type: ignore[override]
        base = Person.objects.filter(is_active=True)
        if self.action in ("retrieve", "update", "partial_update"):
            base = base.prefetch_related("roles", "contacts", "addresses", "documents")
        elif self.action == "list":
            base = base.prefetch_related("roles")
        role = self.request.query_params.get("role")
        if role:
            base = base.filter(roles__role=role)
        kind = self.request.query_params.get("kind")
        if kind:
            base = base.filter(person_kind=kind)
        office_id = self.request.query_params.get("office_id")
        if office_id:
            base = base.filter(broker_person__office__person_id=office_id)
        insurer_id = self.request.query_params.get("insurer_id")
        if insurer_id:
            base = base.filter(expert_profile__insurers__id=insurer_id)
        return base.distinct().order_by("-created_at")

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == "list":
            return PersonListSerializer
        if self.action in ("create", "update", "partial_update"):
            return PersonCreateUpdateSerializer
        return PersonDetailSerializer

    def create(self, request, *args, **kwargs):  # type: ignore[override]
        """Cria pessoa e retorna PersonDetailSerializer (inclui id, roles, contacts)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_data = PersonDetailSerializer(instance, context=self.get_serializer_context()).data
        return Response(response_data, status=status.HTTP_201_CREATED)

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

    @action(detail=False, methods=["get"], url_path=r"cep/(?P<cep>\d{8})")
    def cep_lookup(self, request, cep: str = "") -> Response:
        """Consulta endereço pelo CEP via ViaCEP."""
        cache_key = f"cep:{cep}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"https://viacep.com.br/ws/{cep}/json/")
            data = resp.json()
            if data.get("erro"):
                return Response({"detail": "CEP não encontrado."}, status=404)
            result = {
                "zip_code": data.get("cep", ""),
                "street": data.get("logradouro", ""),
                "complement": data.get("complemento", ""),
                "neighborhood": data.get("bairro", ""),
                "city": data.get("localidade", ""),
                "state": data.get("uf", ""),
            }
            cache.set(cache_key, result, timeout=86400)
            return Response(result)
        except httpx.TimeoutException:
            return Response({"detail": "Timeout na consulta de CEP."}, status=504)
        except Exception as e:
            logger.exception("Erro ao consultar CEP %s: %s", cep, e)
            return Response({"detail": "Erro ao consultar CEP."}, status=500)

    @action(detail=True, methods=["get", "patch"], url_path="supplier-profile")
    def supplier_profile(self, request, pk: str | None = None) -> Response:
        """GET/PATCH SupplierProfile da pessoa (auto-cria se não existir)."""
        person = self.get_object()
        profile, _ = SupplierProfile.objects.get_or_create(person=person)
        if request.method == "PATCH":
            serializer = SupplierProfileSerializer(
                profile, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(SupplierProfileSerializer(profile).data)

    @action(detail=True, methods=["get", "patch"], url_path="expert-profile")
    def expert_profile(self, request, pk: str | None = None) -> Response:
        """GET/PATCH ExpertProfile da pessoa (auto-cria se não existir)."""
        person = self.get_object()
        profile, _ = ExpertProfile.objects.get_or_create(person=person)
        if request.method == "PATCH":
            serializer = ExpertProfileSerializer(
                profile, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(ExpertProfileSerializer(profile).data)

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
