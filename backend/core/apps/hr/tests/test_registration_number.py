"""Matrícula EMP-AAAAMM-NNN compartilhada entre cadastro, convite e backfill."""
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.hr.models import Employee
from apps.hr.services import next_registration_number


class TestNextRegistrationNumber(TenantTestCase):
    def test_next_registration_number_sequence(self) -> None:
        prefix = f"EMP-{timezone.now().strftime('%Y%m')}"
        assert next_registration_number() == f"{prefix}-001"
        user = GlobalUser.objects.create_user(email="a@test.com", name="A", password="x")
        Employee.objects.create(
            user=user,
            department="administrative",
            position="administrative",
            registration_number=f"{prefix}-001",
            hire_date=timezone.now().date(),
        )
        assert next_registration_number() == f"{prefix}-002"


class TestEmployeeCpfHash(TenantTestCase):
    def test_cpf_hash_uses_digits_and_follows_update_fields(self) -> None:
        import hashlib

        user = GlobalUser.objects.create_user(email="h@test.com", name="H", password="x")
        emp = Employee.objects.create(
            user=user,
            department="administrative",
            position="administrative",
            registration_number="H-1",
            hire_date=timezone.now().date(),
            cpf="529.982.247-25",
        )
        assert emp.cpf_hash == hashlib.sha256(b"52998224725").hexdigest()
        emp.cpf = "11144477735"
        emp.save(update_fields=["cpf"])
        emp.refresh_from_db()
        assert emp.cpf_hash == hashlib.sha256(b"11144477735").hexdigest()
