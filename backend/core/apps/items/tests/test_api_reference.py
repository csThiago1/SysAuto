import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="apitester", password="secret")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestOperationTypesAPI:

    def test_list(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 7  # 7 seeds
        codes = [r["code"] for r in data["results"]]
        assert "TROCA" in codes

    def test_retrieve_by_code(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/TROCA/")
        assert resp.status_code == 200
        assert resp.json()["code"] == "TROCA"

    def test_search(self, auth_client):
        resp = auth_client.get("/api/v1/items/operation-types/?search=Troca")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_requires_auth(self):
        client = APIClient()
        resp = client.get("/api/v1/items/operation-types/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestLaborCategoriesAPI:

    def test_list(self, auth_client):
        resp = auth_client.get("/api/v1/items/labor-categories/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 9


@pytest.mark.django_db
class TestInsurersAPI:

    def test_list_returns_all_active(self, auth_client):
        resp = auth_client.get("/api/v1/insurers/")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 10

    def test_retrieve_yelum(self, auth_client):
        resp = auth_client.get("/api/v1/insurers/yelum/")
        assert resp.status_code == 200
        assert resp.json()["import_source"] == "cilia_api"


@pytest.mark.django_db
class TestOpenAPISchema:

    def test_schema_available(self, auth_client):
        resp = auth_client.get("/api/v1/schema/")
        assert resp.status_code == 200
        assert b"openapi" in resp.content.lower()
