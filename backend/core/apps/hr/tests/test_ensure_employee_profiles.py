"""Backfill: toda conta ativa ganha perfil de funcionário no tenant."""
from io import StringIO

from django.core.management import call_command
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase

from apps.authentication.models import GlobalUser
from apps.hr.models import Employee


class TestEnsureEmployeeProfiles(TenantTestCase):
    def test_creates_missing_profiles_once(self) -> None:
        with_profile = GlobalUser.objects.create_user(email="a@test.com", name="A", password="x", role="OWNER")
        Employee.objects.create(
            user=with_profile,
            department="administrative",
            position="administrative",
            registration_number="X-1",
            hire_date=timezone.now().date(),
        )
        missing = GlobalUser.objects.create_user(email="b@test.com", name="B", password="x", role="MANAGER")
        GlobalUser.objects.create_user(email="c@test.com", name="C", password="x", is_active=False)

        out = StringIO()
        call_command("ensure_employee_profiles", schema=self.tenant.schema_name, stdout=out)
        assert "1 perfis criados" in out.getvalue()
        emp = Employee.objects.get(user=missing)
        assert emp.role == "MANAGER" and emp.department == "administrative"
        assert emp.registration_number.startswith("EMP-")

        out = StringIO()
        call_command("ensure_employee_profiles", schema=self.tenant.schema_name, stdout=out)
        assert "0 perfis criados" in out.getvalue()
