"""
Paddock Solutions — HR: Testes de admissão de colaborador
Verifica que a admissão cria automaticamente um Person com role EMPLOYEE.
"""
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.hr.models import Employee
from apps.persons.models import Person, PersonRole


class TestEmployeeAutoCreatesPerson(TenantTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = GlobalUser.objects.create_user(
            email="admin@test.com", name="Admin", password="test"
        )
        self.client = APIClient()
        # Aponta para o domínio do tenant de teste — necessário para TENANT_APPS
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain
        # token dict simula JWT payload — _get_role() lê request.auth["role"]
        self.client.force_authenticate(user=self.admin, token={"role": "MANAGER"})

    def test_admissao_cria_person(self) -> None:
        payload = {
            "name": "Maria Técnica",
            "email": "maria@dscar.com",
            "registration_number": "001",
            "department": "bodywork",
            "position": "bodyworker",
            "contract_type": "clt",
            "hire_date": "2026-04-24",
            "base_salary": "2500.00",
        }
        response = self.client.post("/api/v1/hr/employees/", payload, format="json")
        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.data}"
        )

        employee = Employee.objects.get(registration_number="001")
        assert employee.person is not None
        assert employee.person.full_name == "Maria Técnica"
        assert employee.person.person_kind == "PF"

    def test_admissao_cria_person_com_role_employee(self) -> None:
        payload = {
            "name": "Carlos Pintor",
            "email": "carlos@dscar.com",
            "registration_number": "002",
            "department": "painting",
            "position": "painter",
            "contract_type": "clt",
            "hire_date": "2026-04-24",
            "base_salary": "3000.00",
        }
        self.client.post("/api/v1/hr/employees/", payload, format="json")
        employee = Employee.objects.get(registration_number="002")
        assert employee.person is not None
        roles = list(employee.person.roles.values_list("role", flat=True))
        assert "EMPLOYEE" in roles
