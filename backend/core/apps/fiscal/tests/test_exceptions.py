"""
Testes T3: Hierarquia de exceções Focus NF-e.
"""

import pytest

from apps.fiscal.exceptions import (
    FocusAuthError,
    FocusConflict,
    FocusNFeError,
    FocusNotFoundError,
    FocusRateLimitError,
    FocusSEFAZError,
    FocusServerError,
    FocusTimeout,
    FocusValidationError,
)


def test_all_exceptions_inherit_from_base():
    """Todas as exceptions filhas devem herdar de FocusNFeError."""
    children = [
        FocusAuthError,
        FocusValidationError,
        FocusNotFoundError,
        FocusRateLimitError,
        FocusServerError,
        FocusSEFAZError,
        FocusTimeout,
        FocusConflict,
    ]
    for cls in children:
        assert issubclass(cls, FocusNFeError), f"{cls.__name__} não herda de FocusNFeError"


def test_catch_base_catches_all_children():
    """Capturar FocusNFeError deve capturar qualquer exception filha."""
    exceptions_to_raise = [
        FocusAuthError("401"),
        FocusValidationError({"error": "invalid"}),
        FocusNotFoundError("ref-not-found"),
        FocusRateLimitError("429"),
        FocusServerError("500"),
        FocusSEFAZError("rejeicao"),
        FocusTimeout("timeout"),
        FocusConflict("409"),
    ]
    for exc in exceptions_to_raise:
        try:
            raise exc
        except FocusNFeError:
            pass  # esperado
        else:
            pytest.fail(f"{type(exc).__name__} não foi capturado por FocusNFeError")


def test_retry_vs_no_retry_separation():
    """Separação semântica: erros retryable vs não-retryable.

    FocusServerError e FocusRateLimitError → retry.
    FocusValidationError e FocusAuthError → NÃO retry.
    """
    retryable = (FocusServerError, FocusRateLimitError, FocusTimeout)
    non_retryable = (FocusValidationError, FocusAuthError, FocusNotFoundError)

    # Apenas verifica que são tipos distintos (o retry é decisão do caller/Celery)
    for cls in retryable:
        assert issubclass(cls, FocusNFeError)

    for cls in non_retryable:
        assert issubclass(cls, FocusNFeError)

    # Nenhuma classe retryable é subclasse de non_retryable e vice-versa
    for r_cls in retryable:
        for nr_cls in non_retryable:
            assert not issubclass(
                r_cls, nr_cls
            ), f"{r_cls.__name__} não deveria ser subclasse de {nr_cls.__name__}"
