"""
Paddock Solutions — Custom DRF Pagination
"""
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    Paginação padrão do Paddock.
    - page_size padrão: 25
    - Clientes podem solicitar até 200 registros via ?page_size=N
    - Acima de 200 é truncado silenciosamente (proteção contra DoS)
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200
