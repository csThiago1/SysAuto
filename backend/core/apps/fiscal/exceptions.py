"""
Paddock Solutions — Fiscal — Hierarquia de exceções Focus NF-e
Ciclo 06B: Fiscal Foundation
"""


class FocusNFeError(Exception):
    """Erro base Focus NF-e — todos os erros fiscais herdam daqui."""


class FocusAuthError(FocusNFeError):
    """Erro de autenticação — 401/403. Verificar token."""


class FocusValidationError(FocusNFeError):
    """Payload inválido — 400/415/422. Não faz retry."""


class FocusNotFoundError(FocusNFeError):
    """Recurso não encontrado — 404."""


class FocusRateLimitError(FocusNFeError):
    """Limite de requisições excedido — 429. Faz retry com backoff."""


class FocusServerError(FocusNFeError):
    """Erro interno Focus/SEFAZ — 5xx. Faz retry com backoff."""


class FocusSEFAZError(FocusNFeError):
    """Rejeição SEFAZ — documento foi entregue mas rejeitado pelo fisco."""


class FocusTimeout(FocusNFeError):
    """Timeout de rede ao chamar a API Focus. Faz retry."""


class FocusConflict(FocusNFeError):
    """Conflito de ref — 409. A ref já existe com status diferente de erro."""


# ── Ciclo 06C: exceções de domínio (não HTTP) ────────────────────────────────


class NfseBuilderError(Exception):
    """Dados insuficientes para montar payload NFS-e (Person sem documento, sem endereço, etc.)."""


class FiscalDocumentAlreadyAuthorized(Exception):
    """Tentativa de reemissão de documento já autorizado pela SEFAZ."""


class FiscalInvalidStatus(Exception):
    """Operação inválida para o status atual do documento fiscal."""


class FiscalValidationError(Exception):
    """Erro de validação de entrada antes de chamar a Focus (ex: manual_reason vazio)."""
