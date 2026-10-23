from django.test import TestCase
from apps.hr.models import Employee


class TestEmployeeFields(TestCase):
    def test_rg_is_plain_charfield(self):
        field = Employee._meta.get_field('rg')
        assert field.__class__.__name__ == 'CharField'

    def test_mother_name_is_plain_charfield(self):
        field = Employee._meta.get_field('mother_name')
        assert field.__class__.__name__ == 'CharField'

    def test_father_name_is_plain_charfield(self):
        field = Employee._meta.get_field('father_name')
        assert field.__class__.__name__ == 'CharField'

    def test_emergency_contact_phone_is_plain_charfield(self):
        field = Employee._meta.get_field('emergency_contact_phone')
        assert field.__class__.__name__ == 'CharField'

    def test_has_bank_name_field(self):
        field = Employee._meta.get_field('bank_name')
        assert field.blank is True

    def test_has_bank_agency_field(self):
        Employee._meta.get_field('bank_agency')

    def test_has_bank_account_field(self):
        Employee._meta.get_field('bank_account')

    def test_has_bank_account_type_field(self):
        Employee._meta.get_field('bank_account_type')

    def test_has_emergency_contact_relationship_field(self):
        Employee._meta.get_field('emergency_contact_relationship')


class TestEmployeeCpfDV(TestCase):
    def test_cpf_com_dv_errado_e_recusado(self) -> None:
        from rest_framework import serializers

        from apps.hr.serializers import EmployeeCreateSerializer

        with self.assertRaisesMessage(serializers.ValidationError, "CPF inválido."):
            EmployeeCreateSerializer().validate_cpf("529.982.247-24")
