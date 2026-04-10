"""
Paddock Solutions — HR Employee View Tests — Sprint 5 + Sprint 9
Testa endpoints de colaborador com TenantTestCase (tabelas TENANT_APPS isoladas).
Sprint 9: admissão por nome+e-mail — GlobalUser criado automaticamente.
"""
import hashlib
import uuid
from datetime import date

from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.hr.models import Employee, SalaryHistory


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_user(email: str = "admin@dscar.com", name: str = "Admin User") -> GlobalUser:
    """Cria GlobalUser com email_hash calculado — necessário para unique constraint."""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()
    return GlobalUser.objects.create_user(
        email=email, password="test123", name=name, email_hash=email_hash
    )


def make_employee(user: GlobalUser, reg: str = "E001") -> Employee:
    return Employee.objects.create(
        user=user,
        department="reception",
        position="receptionist",
        registration_number=reg,
        hire_date=date.today(),
        base_salary="2000.00",
    )


class HRTestCase(TenantTestCase):
    """Base: TenantTestCase + APIClient com force_authenticate (DRF JWT bypass)."""

    def setUp(self) -> None:
        super().setUp()
        # APIClient com SERVER_NAME apontando para o domínio do tenant de teste
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain


# ── Employee CRUD ─────────────────────────────────────────────────────────────


class TestEmployeeListView(HRTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)
        self.employee_user = make_user("emp@dscar.com", "Carlos Souza")
        make_employee(self.employee_user)

    def test_list_employees_authenticated(self) -> None:
        response = self.client.get("/api/v1/hr/employees/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 1)

    def test_list_unauthenticated_returns_401(self) -> None:
        anon = APIClient()
        anon.defaults["SERVER_NAME"] = self.domain.domain
        response = anon.get("/api/v1/hr/employees/")
        self.assertEqual(response.status_code, 401)

    def test_filter_by_status(self) -> None:
        response = self.client.get("/api/v1/hr/employees/?status=active")
        self.assertEqual(response.status_code, 200)
        for emp in response.json()["results"]:
            self.assertEqual(emp["status"], "active")

    def test_filter_by_department(self) -> None:
        response = self.client.get("/api/v1/hr/employees/?department=reception")
        self.assertEqual(response.status_code, 200)
        for emp in response.json()["results"]:
            self.assertEqual(emp["department"], "reception")


class TestEmployeeCreateView(HRTestCase):
    """Sprint 9: admissão aceita name+email — GlobalUser criado automaticamente."""

    URL = "/api/v1/hr/employees/"

    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)

    def _base_payload(
        self,
        email: str = "novo@dscar.com",
        name: str = "Novo Colaborador",
        reg: str = "E100",
    ) -> dict:
        return {
            "name": name,
            "email": email,
            "department": "bodywork",
            "position": "bodyworker",
            "registration_number": reg,
            "contract_type": "clt",
            "hire_date": "2026-01-01",
            "base_salary": "2500.00",
        }

    def test_create_employee_creates_global_user_automatically(self) -> None:
        """Deve criar o GlobalUser a partir do e-mail e admitir o colaborador."""
        response = self.client.post(self.URL, self._base_payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Employee.objects.filter(registration_number="E100").exists())
        email_hash = hashlib.sha256("novo@dscar.com".encode()).hexdigest()
        self.assertTrue(GlobalUser.objects.filter(email_hash=email_hash).exists())

    def test_create_employee_returns_id(self) -> None:
        """Resposta deve incluir o id do Employee para redirect."""
        response = self.client.post(self.URL, self._base_payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn("id", response.json())

    def test_create_employee_reuses_existing_global_user(self) -> None:
        """Se GlobalUser já existe pelo e-mail, deve reutilizá-lo sem duplicar."""
        existing = make_user("existing@dscar.com", "Usuário Existente")
        payload = self._base_payload(
            email="existing@dscar.com", name="Usuário Existente", reg="E101"
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 201)
        emp = Employee.objects.get(registration_number="E101")
        self.assertEqual(emp.user.pk, existing.pk)

    def test_create_employee_duplicate_email_returns_400(self) -> None:
        """E-mail que já tem colaborador ativo deve retornar 400."""
        existing_user = make_user("dup@dscar.com", "Duplicado")
        make_employee(existing_user, reg="E_DUP")
        payload = self._base_payload(email="dup@dscar.com", reg="E_DUP2")
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json())

    def test_create_employee_negative_salary_returns_400(self) -> None:
        payload = self._base_payload(email="neg@dscar.com", reg="E200")
        payload["base_salary"] = "-100.00"
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("base_salary", response.json())

    def test_create_employee_duplicate_registration_returns_400(self) -> None:
        emp_user = make_user("emp2@dscar.com", "Existente")
        make_employee(emp_user, reg="DUPLIC")
        payload = self._base_payload(email="new2@dscar.com", reg="DUPLIC")
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, 400)


class TestEmployeeRetrieveView(HRTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)
        self.emp_user = make_user("emp3@dscar.com", "Detalhe User")
        self.employee = make_employee(self.emp_user)

    def test_retrieve_employee(self) -> None:
        response = self.client.get(f"/api/v1/hr/employees/{self.employee.id}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["registration_number"], "E001")
        # CPF mascarado — nunca exposto em claro (LGPD)
        self.assertNotIn("cpf", data)
        self.assertIn("cpf_masked", data)

    def test_retrieve_nonexistent_returns_404(self) -> None:
        response = self.client.get(f"/api/v1/hr/employees/{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)


class TestEmployeeUpdateView(HRTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)
        self.emp_user = make_user("upd@dscar.com", "Update User")
        self.employee = make_employee(self.emp_user)

    def test_partial_update_department(self) -> None:
        response = self.client.patch(
            f"/api/v1/hr/employees/{self.employee.id}/",
            {"department": "painting"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.department, "painting")


class TestEmployeeTerminateAction(HRTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)
        self.emp_user = make_user("term@dscar.com", "Para Desligar")
        self.employee = make_employee(self.emp_user)

    def test_terminate_employee(self) -> None:
        response = self.client.post(
            f"/api/v1/hr/employees/{self.employee.id}/terminate/"
        )
        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.status, Employee.Status.TERMINATED)
        self.assertIsNotNone(self.employee.termination_date)

    def test_terminate_already_terminated_returns_400(self) -> None:
        self.employee.status = Employee.Status.TERMINATED
        self.employee.termination_date = date.today()
        self.employee.save()
        response = self.client.post(
            f"/api/v1/hr/employees/{self.employee.id}/terminate/"
        )
        self.assertEqual(response.status_code, 400)


# ── SalaryHistory ─────────────────────────────────────────────────────────────


class TestSalaryHistoryViews(HRTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.admin = make_user()
        self.client.force_authenticate(user=self.admin)
        self.emp_user = make_user("sal@dscar.com", "Salário User")
        self.employee = make_employee(self.emp_user)

    def _url(self) -> str:
        return f"/api/v1/hr/employees/{self.employee.id}/salary-history/"

    def test_list_salary_history(self) -> None:
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, 200)

    def test_create_salary_history_updates_base_salary(self) -> None:
        payload = {
            "previous_salary": "2000.00",
            "new_salary": "2800.00",
            "effective_date": "2026-04-01",
            "reason": "Dissídio 2026",
        }
        response = self.client.post(self._url(), payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.employee.refresh_from_db()
        self.assertEqual(float(self.employee.base_salary), 2800.00)

    def test_create_salary_history_zero_salary_returns_400(self) -> None:
        payload = {
            "previous_salary": "2000.00",
            "new_salary": "0.00",
            "effective_date": "2026-04-01",
        }
        response = self.client.post(self._url(), payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_salary", response.json())
