from django.test import TestCase
from apps.persons.models import Person


class TestPersonCleanup(TestCase):
    def test_person_has_no_document_field(self):
        assert not hasattr(Person, 'document') or \
               'document' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_logo_url_field(self):
        assert 'logo_url' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_insurer_code_field(self):
        assert 'insurer_code' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_job_title_field(self):
        assert 'job_title' not in [f.name for f in Person._meta.get_fields()]

    def test_person_has_no_department_field(self):
        assert 'department' not in [f.name for f in Person._meta.get_fields()]
