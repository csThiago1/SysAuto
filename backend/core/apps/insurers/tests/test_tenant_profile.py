from django_tenants.test.cases import TenantTestCase
from apps.insurers.models import Insurer, InsurerTenantProfile


class TestInsurerTenantProfile(TenantTestCase):
    def setUp(self):
        self.insurer = Insurer.objects.create(
            name="Porto Seguro Cia Seguros",
            cnpj="61198164000160",
        )

    def test_create_profile(self):
        profile = InsurerTenantProfile.objects.create(
            insurer=self.insurer,
            sla_dias_uteis=3,
            contact_sinistro_nome="João Sinistros",
        )
        assert profile.pk is not None
        assert profile.sla_dias_uteis == 3

    def test_upsert_idempotente(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer, sla_dias_uteis=3)
        profile, created = InsurerTenantProfile.objects.get_or_create(
            insurer=self.insurer, defaults={"sla_dias_uteis": 5}
        )
        assert not created
        assert profile.sla_dias_uteis == 3  # não sobrescreveu

    def test_insurer_tem_accessor(self):
        InsurerTenantProfile.objects.create(insurer=self.insurer)
        assert hasattr(self.insurer, 'tenant_profile')
