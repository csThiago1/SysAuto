"""
Paddock Solutions — Persons Utils
Funções auxiliares para criptografia e hashing (LGPD).
"""

import hashlib
import re


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


def sha256_lookup_candidates(value: str) -> set[str]:
    """Retorna hashes possíveis para documentos salvos com ou sem máscara.

    Dados legados podem ter sido gravados como "12345678901", enquanto telas
    novas podem enviar "123.456.789-01". Para lookup fiscal, consultar ambos
    evita falso negativo sem regravar PII.
    """
    raw = str(value or "").strip()
    digits = re.sub(r"\D", "", raw)
    values = {raw}
    if digits:
        values.add(digits)
    return {sha256_hex(item) for item in values if item}
