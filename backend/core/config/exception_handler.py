"""
Paddock Solutions — DRF Exception Handler
"""

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions, serializers
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Erro de regra dos services (ValidationError do Django) responde 400 em vez de 500."""
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=serializers.as_serializer_error(exc))
    return drf_exception_handler(exc, context)
