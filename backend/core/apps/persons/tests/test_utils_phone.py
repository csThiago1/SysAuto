"""normalize_phone: formato único para casar recepção e WhatsApp."""

from apps.persons.utils import normalize_phone


def test_normalize_phone() -> None:
    assert normalize_phone("(92) 99125-5466") == "92991255466"
    assert normalize_phone("5592991255466") == "92991255466"
    assert normalize_phone("+55 92 3345-7860") == "9233457860"
    assert normalize_phone("92991255466") == "92991255466"
    assert normalize_phone("") == ""
    # Número com 11 dígitos começando com 55 é DDD 55 (RS), não DDI.
    assert normalize_phone("55991234567") == "55991234567"


from django_tenants.test.cases import TenantTestCase  # noqa: E402

from apps.persons.models import Person, PersonContact  # noqa: E402
from apps.persons.serializers import PersonContactSerializer  # noqa: E402
from apps.persons.utils import sha256_hex  # noqa: E402


class TestPhoneInPlainText(TenantTestCase):
    def test_contact_phone_saved_as_digits_and_shown_whole(self) -> None:
        person = Person.objects.create(full_name="Cliente WhatsApp", person_kind="PF")
        contact = PersonContact.objects.create(
            person=person, contact_type="WHATSAPP", value="+55 (92) 99123-4567"
        )
        contact.refresh_from_db()

        self.assertEqual(contact.value, "92991234567")
        self.assertEqual(contact.value_hash, sha256_hex("92991234567"))
        self.assertEqual(PersonContactSerializer(contact).data["value"], "92991234567")
        self.assertNotIn("value_masked", PersonContactSerializer(contact).data)
        # Busca direta pelo número, que a criptografia impedia
        self.assertTrue(Person.objects.filter(contacts__value__contains="991234567").exists())

    def test_email_not_normalized(self) -> None:
        person = Person.objects.create(full_name="Cliente E-mail", person_kind="PF")
        contact = PersonContact.objects.create(
            person=person, contact_type="EMAIL", value="Cliente@Example.com"
        )
        contact.refresh_from_db()
        self.assertEqual(contact.value, "Cliente@Example.com")
