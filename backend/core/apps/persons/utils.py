"""
Paddock Solutions — Persons Utils
Funções auxiliares para criptografia e hashing (LGPD).
"""

import hashlib


def sha256_hex(value: str) -> str:
    """Retorna hash SHA-256 em hexadecimal para uso em filter().

    Padrão do projeto: EncryptedField não suporta filter() —
    sempre filtrar pelo hash, nunca pelo valor criptografado.

    Args:
        value: String a ser hasheada (CPF, CNPJ, email, telefone, etc.)

    Returns:
        Hash SHA-256 em hexadecimal (64 chars).
    """
    return hashlib.sha256(value.encode()).hexdigest()
