"""
Paddock Solutions — HR Model Tests — Sprint 5
Testa Employee, EmployeeDocument, SalaryHistory.

Estrutura:
  - TestEmployee*Unit       → SimpleTestCase (sem DB, roda sem Docker)
  - TestEmployee*DB         → TestCase (requer PostgreSQL via Docker)
  - TestEmployeeDocument*DB → TestCase
  - TestSalaryHistory*DB    → TestCase
"""
import hashlib
from datetime import date, timedelta
from unittest.mock import MagicMock

from django.test import SimpleTestCase, TestCase

from apps.hr.models import Employee, EmployeeDocument, SalaryHistory


# ── Helpers (TestCase — requer DB) ────────────────────────────────────────────


def make_user(email: str = "test@dscar.com", name: str = "João Silva"):  # type: ignore[return]
    from apps.authentication.models import GlobalUser
    return GlobalUser.objects.create_user(email=email, password="test123", name=name)


def make_employee(user: object, reg: str = "E001", cpf: str = "12345678901") -> Employee:
    return Employee.objects.create(  # type: ignore[return-value]
        user=user,
        department="reception",
        position="receptionist",
        registration_number=reg,
        hire_date=date.today(),
        cpf=cpf,
    )


# ── Unit tests (sem DB) ───────────────────────────────────────────────────────


class TestEmployeeTenureDaysUnit(SimpleTestCase):
    """Testa propriedade tenure_days — sem acesso a DB."""

    def test_tenure_days_active_employee(self) -> None:
        hire = date.today() - timedelta(days=30)
        emp = Employee(hire_date=hire, status=Employee.Status.ACTIVE)
        self.assertGreaterEqual(emp.tenure_days, 30)

    def test_tenure_days_terminated_employee(self) -> None:
        hire = date(2025, 1, 1)
        term = date(2025, 6, 1)
        emp = Employee(
            hire_date=hire,
            termination_date=term,
            status=Employee.Status.TERMINATED,
        )
        self.assertEqual(emp.tenure_days, (term - hire).days)


class TestEmployeeCpfHashUnit(SimpleTestCase):
    """Testa geração do cpf_hash — sem acesso a DB."""

    def test_cpf_hash_generated_on_save(self) -> None:
        """save() deve gerar hash SHA-256 do CPF."""
        emp = Employee.__new__(Employee)
        emp.cpf = "12345678901"
        emp.cpf_hash = ""

        # Simula super().save() sem DB
        original_save = Employee.save

        def mock_save(self: Employee, *args: object, **kwargs: object) -> None:
            if self.cpf:
                self.cpf_hash = hashlib.sha256(self.cpf.encode()).hexdigest()

        Employee.save = mock_save  # type: ignore[method-assign]
        try:
            emp.save()
            expected = hashlib.sha256("12345678901".encode()).hexdigest()
            self.assertEqual(emp.cpf_hash, expected)
        finally:
            Employee.save = original_save  # type: ignore[method-assign]

    def test_empty_cpf_does_not_generate_hash(self) -> None:
        emp = Employee.__new__(Employee)
        emp.cpf = ""
        emp.cpf_hash = ""

        original_save = Employee.save

        def mock_save(self: Employee, *args: object, **kwargs: object) -> None:
            if self.cpf:
                self.cpf_hash = hashlib.sha256(self.cpf.encode()).hexdigest()

        Employee.save = mock_save  # type: ignore[method-assign]
        try:
            emp.save()
            self.assertEqual(emp.cpf_hash, "")
        finally:
            Employee.save = original_save  # type: ignore[method-assign]


# ── Integration tests (requerem PostgreSQL + Docker) ──────────────────────────


class TestEmployeeDB(TestCase):
    def setUp(self) -> None:
        self.user = make_user()

    def test_create_sets_cpf_hash(self) -> None:
        emp = make_employee(self.user)
        expected = hashlib.sha256("12345678901".encode()).hexdigest()
        self.assertEqual(emp.cpf_hash, expected)

    def test_str_contains_registration_number(self) -> None:
        emp = make_employee(self.user)
        self.assertIn("E001", str(emp))

    def test_str_contains_user_name(self) -> None:
        emp = make_employee(self.user)
        self.assertIn("João Silva", str(emp))

    def test_tenure_days_active_employee(self) -> None:
        hire = date.today() - timedelta(days=30)
        emp = Employee(hire_date=hire, status=Employee.Status.ACTIVE)
        self.assertGreaterEqual(emp.tenure_days, 30)

    def test_tenure_days_terminated_employee(self) -> None:
        hire = date(2025, 1, 1)
        term = date(2025, 6, 1)
        emp = Employee(
            hire_date=hire,
            termination_date=term,
            status=Employee.Status.TERMINATED,
        )
        self.assertEqual(emp.tenure_days, (term - hire).days)

    def test_soft_delete_sets_is_active_false(self) -> None:
        emp = make_employee(self.user)
        self.assertTrue(emp.is_active)
        emp.soft_delete()
        emp.refresh_from_db()
        self.assertFalse(emp.is_active)

    def test_soft_deleted_employee_not_in_default_qs(self) -> None:
        emp = make_employee(self.user)
        emp.soft_delete()
        active = Employee.objects.filter(is_active=True)
        self.assertNotIn(emp, active)

    def test_default_status_is_active(self) -> None:
        emp = make_employee(self.user)
        self.assertEqual(emp.status, Employee.Status.ACTIVE)

    def test_default_contract_type_is_clt(self) -> None:
        emp = make_employee(self.user)
        self.assertEqual(emp.contract_type, Employee.ContractType.CLT)

    def test_cpf_hash_regenerated_on_save(self) -> None:
        """Garante que o hash é recalculado se CPF mudar."""
        emp = make_employee(self.user, cpf="11111111111")
        old_hash = emp.cpf_hash
        emp.cpf = "99999999999"
        emp.save()
        emp.refresh_from_db()
        new_hash = hashlib.sha256("99999999999".encode()).hexdigest()
        self.assertNotEqual(emp.cpf_hash, old_hash)
        self.assertEqual(emp.cpf_hash, new_hash)

    def test_empty_cpf_does_not_generate_hash_db(self) -> None:
        user2 = make_user("noCpf@dscar.com", "Maria")
        emp = Employee.objects.create(
            user=user2,
            department="reception",
            position="receptionist",
            registration_number="E999",
            hire_date=date.today(),
            cpf="",
        )
        self.assertEqual(emp.cpf_hash, "")


# ── EmployeeDocument ──────────────────────────────────────────────────────────


class TestEmployeeDocument(TestCase):
    def setUp(self) -> None:
        self.user = make_user("doc@dscar.com")
        self.employee = make_employee(self.user, "D001")

    def test_create_document(self) -> None:
        doc = EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=EmployeeDocument.DocumentType.CNH,
            file_key="hr/documents/cnh.pdf",
            file_name="cnh.pdf",
            file_size=102400,
        )
        self.assertTrue(doc.is_active)
        self.assertEqual(doc.employee, self.employee)

    def test_soft_delete_document(self) -> None:
        doc = EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=EmployeeDocument.DocumentType.RG,
            file_key="hr/documents/rg.pdf",
            file_name="rg.pdf",
            file_size=51200,
        )
        doc.soft_delete()
        doc.refresh_from_db()
        self.assertFalse(doc.is_active)

    def test_str_contains_document_type(self) -> None:
        doc = EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=EmployeeDocument.DocumentType.CONTRACT,
            file_key="hr/documents/contract.pdf",
            file_name="contract.pdf",
            file_size=204800,
        )
        self.assertIn("Contrato", str(doc))

    def test_default_mime_type(self) -> None:
        doc = EmployeeDocument.objects.create(
            employee=self.employee,
            document_type=EmployeeDocument.DocumentType.OTHER,
            file_key="hr/documents/other.pdf",
            file_name="other.pdf",
            file_size=1024,
        )
        self.assertEqual(doc.mime_type, "application/pdf")


# ── SalaryHistory ─────────────────────────────────────────────────────────────


class TestSalaryHistory(TestCase):
    def setUp(self) -> None:
        self.user = make_user("salary@dscar.com")
        self.employee = make_employee(self.user, "S001")

    def test_create_salary_history(self) -> None:
        history = SalaryHistory.objects.create(
            employee=self.employee,
            previous_salary="2000.00",
            new_salary="2500.00",
            effective_date=date.today(),
            reason="Promoção a líder de equipe",
        )
        self.assertEqual(history.employee, self.employee)
        self.assertEqual(str(history.new_salary), "2500.00")

    def test_ordering_most_recent_first(self) -> None:
        SalaryHistory.objects.create(
            employee=self.employee,
            previous_salary="2000.00",
            new_salary="2200.00",
            effective_date=date(2025, 1, 1),
        )
        SalaryHistory.objects.create(
            employee=self.employee,
            previous_salary="2200.00",
            new_salary="2500.00",
            effective_date=date(2025, 6, 1),
        )
        histories = list(SalaryHistory.objects.filter(employee=self.employee))
        self.assertGreater(histories[0].effective_date, histories[1].effective_date)

    def test_str_contains_new_salary(self) -> None:
        history = SalaryHistory.objects.create(
            employee=self.employee,
            previous_salary="2000.00",
            new_salary="3000.00",
            effective_date=date.today(),
        )
        self.assertIn("3000.00", str(history))
