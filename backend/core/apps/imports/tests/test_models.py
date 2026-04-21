import pytest

from apps.imports.models import ImportAttempt


@pytest.mark.django_db
class TestImportAttempt:

    def test_create_minimal(self):
        a = ImportAttempt.objects.create(source="cilia", trigger="polling")
        assert a.source == "cilia"
        assert a.parsed_ok is False
        assert a.http_status is None

    def test_create_full(self):
        a = ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="406571903", budget_number="1446508", version_number=2,
            http_status=200, parsed_ok=True,
            raw_hash="abc123",
        )
        assert a.casualty_number == "406571903"
        assert a.version_number == 2

    def test_str_representation(self):
        a = ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="406571903", budget_number="1446508", version_number=2,
        )
        assert "cilia" in str(a)
        assert "406571903" in str(a)
        assert "v2" in str(a)

    def test_ordering_desc_by_created_at(self):
        a1 = ImportAttempt.objects.create(source="cilia", trigger="polling")
        a2 = ImportAttempt.objects.create(source="cilia", trigger="polling")
        attempts = list(ImportAttempt.objects.all())
        assert attempts[0].pk == a2.pk
        assert attempts[1].pk == a1.pk

    def test_duplicate_of_self_ref(self):
        original = ImportAttempt.objects.create(
            source="cilia", trigger="polling", parsed_ok=True, raw_hash="xyz",
        )
        dup = ImportAttempt.objects.create(
            source="cilia", trigger="polling", raw_hash="xyz",
            duplicate_of=original,
        )
        assert dup.duplicate_of == original
        assert original.duplicates.count() == 1
