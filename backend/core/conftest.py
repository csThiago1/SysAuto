import pytest


@pytest.fixture
def db_access(db):
    """Alias mais semântico do fixture 'db'."""
    return db
