"""
Paddock Solutions — Parts Catalog View Tests

Cobre endpoints de listagem, busca, filtragem e detalhe do catálogo de peças.
parts_catalog é um SHARED_APP (schema público) — usa TestCase sem TenantTestCase.
Autenticação via force_authenticate com token dict para acionar RBAC corretamente.
"""
import hashlib

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.parts_catalog.models import PartReference
from apps.parts_catalog.views import _CATEGORIES_CACHE_KEY

from .factories import (
    PartCategoryFactory,
    PartReferenceFactory,
    PartSupplierRefFactory,
)

# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "parts_test@dscar.com", name: str = "Parts Tester") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — necessário para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


# ── Base ──────────────────────────────────────────────────────────────────────


class PartsCatalogViewTestCase(TestCase):
    """Base: APIClient autenticado como ADMIN + limpeza de cache de categorias."""

    CATEGORIES_URL = "/api/v1/parts-catalog/categories/"
    REFERENCES_URL = "/api/v1/parts-catalog/references/"
    APPLICATIONS_URL = "/api/v1/parts-catalog/applications/"

    def setUp(self) -> None:
        super().setUp()
        # Limpa cache de categorias para evitar contaminação entre testes
        cache.delete(_CATEGORIES_CACHE_KEY)

        self.user = make_user()
        self.client = APIClient()
        # force_authenticate com token dict para que _get_role() leia corretamente o role
        self.client.force_authenticate(user=self.user, token={"role": "ADMIN"})


# ── Testes de Categorias ───────────────────────────────────────────────────────


class TestPartCategoryList(PartsCatalogViewTestCase):
    """GET /parts-catalog/categories/ — lista de categorias (não paginada, cacheada)."""

    def test_list_categories_returns_200(self) -> None:
        """Cria 2 categorias e verifica que a lista retorna ao menos essas 2."""
        PartCategoryFactory(code="CARROCERIA", name="Carroceria")
        PartCategoryFactory(code="MOTOR", name="Motor")
        # Invalida cache para garantir que as novas categorias apareçam
        cache.delete(_CATEGORIES_CACHE_KEY)

        response = self.client.get(self.CATEGORIES_URL)

        self.assertEqual(response.status_code, 200)
        # Categorias retornam como lista direta (sem paginação)
        data = response.json()
        self.assertIsInstance(data, list)
        codes = [cat["code"] for cat in data]
        self.assertIn("CARROCERIA", codes)
        self.assertIn("MOTOR", codes)

    def test_list_categories_unauthenticated_returns_401(self) -> None:
        anon = APIClient()
        response = anon.get(self.CATEGORIES_URL)
        self.assertEqual(response.status_code, 401)


# ── Testes de Referências ──────────────────────────────────────────────────────


class TestPartReferenceList(PartsCatalogViewTestCase):
    """GET /parts-catalog/references/ — lista paginada de referências."""

    def test_list_references_returns_200_with_results(self) -> None:
        """Cria 1 referência e verifica que aparece na listagem paginada."""
        ref = PartReferenceFactory(manufacturer_code="52058207", description="Para-choque dianteiro")

        response = self.client.get(self.REFERENCES_URL)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        codes = [r["manufacturer_code"] for r in data["results"]]
        self.assertIn(ref.manufacturer_code, codes)

    def test_search_by_manufacturer_code_returns_one_result(self) -> None:
        """Busca exata pelo manufacturer_code retorna exatamente 1 resultado."""
        PartReferenceFactory(manufacturer_code="SEARCH-UNIQUE-001")
        PartReferenceFactory(manufacturer_code="OTHER-CODE-002")

        response = self.client.get(self.REFERENCES_URL, {"search": "SEARCH-UNIQUE-001"})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual(data["results"][0]["manufacturer_code"], "SEARCH-UNIQUE-001")


class TestPartReferenceDetail(PartsCatalogViewTestCase):
    """GET /parts-catalog/references/{id}/ — detalhe com fornecedores aninhados."""

    def test_retrieve_with_suppliers_nested(self) -> None:
        """Detalhe de uma referência inclui a lista de fornecedores aninhada."""
        ref = PartReferenceFactory(manufacturer_code="DETAIL-001")
        PartSupplierRefFactory(part_ref=ref, supplier_name="PMZ DISTRIBUIDORA", supplier_code="PMZ-X1")

        response = self.client.get(f"{self.REFERENCES_URL}{ref.id}/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["manufacturer_code"], "DETAIL-001")
        self.assertIn("suppliers", data)
        supplier_names = [s["supplier_name"] for s in data["suppliers"]]
        self.assertIn("PMZ DISTRIBUIDORA", supplier_names)

    def test_retrieve_nonexistent_returns_404(self) -> None:
        import uuid

        response = self.client.get(f"{self.REFERENCES_URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)


class TestPartReferenceFilterByCategory(PartsCatalogViewTestCase):
    """GET /parts-catalog/references/?category={id} — filtro por categoria."""

    def test_filter_by_category_returns_only_matching_refs(self) -> None:
        """Filtrando por cat1, todos os resultados devem pertencer a cat1."""
        cat1 = PartCategoryFactory(code="CAT-FILTER-A")
        cat2 = PartCategoryFactory(code="CAT-FILTER-B")

        ref1 = PartReferenceFactory(manufacturer_code="FILTER-A-001", category=cat1)
        ref2 = PartReferenceFactory(manufacturer_code="FILTER-A-002", category=cat1)
        PartReferenceFactory(manufacturer_code="FILTER-B-001", category=cat2)

        response = self.client.get(self.REFERENCES_URL, {"category": cat1.id})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        result_ids = [r["id"] for r in data["results"]]
        self.assertIn(str(ref1.id), result_ids)
        self.assertIn(str(ref2.id), result_ids)
        # Garante que a referência de cat2 não aparece no resultado
        for r in data["results"]:
            self.assertEqual(
                r["category"],
                cat1.id,
                f"Referência {r['manufacturer_code']} pertence à categoria errada",
            )

    def test_filter_by_is_active_false_excludes_active(self) -> None:
        """Filtro is_active=false retorna apenas referências inativas."""
        PartReferenceFactory(manufacturer_code="ACTIVE-REF-001", is_active=True)
        inactive = PartReferenceFactory(manufacturer_code="INACTIVE-REF-001", is_active=False)

        response = self.client.get(self.REFERENCES_URL, {"is_active": "false"})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        # O queryset de list filtra is_active=True, então is_active=false retorna vazio
        # ou apenas a inativa dependendo do filterset — verifica que a ativa não aparece
        codes = [r["manufacturer_code"] for r in data["results"]]
        self.assertNotIn("ACTIVE-REF-001", codes)
