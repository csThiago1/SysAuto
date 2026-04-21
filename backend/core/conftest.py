import pytest
from django.core.management import call_command


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Garante que seeds de data migrations estão aplicadas."""
    with django_db_blocker.unblock():
        # Migrations já rodam via pytest-django; nada extra por enquanto
        pass


@pytest.fixture
def db_access(db):
    """Alias mais semântico do fixture 'db'."""
    return db
