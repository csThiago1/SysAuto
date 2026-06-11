"""
Management command para importar fornecedores do Databox (sistema legado DS Car)
para o modelo Supplier (apps.accounts_payable).

O mesmo XLS "Lista Clientes DSCar Databox.xls" tem clientes E fornecedores
misturados — a coluna 'Categoria' (bitmask de 11 posicoes) marca o tipo:
  bit 0 = cliente, bit 1 = fornecedor, bit 2 = seguradora

Este command importa todas as linhas com bit 1 ativo (puro fornecedor ou
cliente+fornecedor); o `import_clientes_dscar` faz o caminho inverso.

Dedup:
  - PJ: por CNPJ (plaintext, campo nao criptografado)
  - PF: por nome + telefone (Supplier nao tem cpf_hash; CPF e EncryptedField,
    nao da pra dedupar com filter() em uma rodada)
  - Idempotente: re-rodar nao duplica

Uso:
    python manage.py import_fornecedores_dscar
    python manage.py import_fornecedores_dscar --dry-run --limit 100
    python manage.py import_fornecedores_dscar --tenant-schema tenant_dscar
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import xlrd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django_tenants.utils import schema_context

from apps.accounts_payable.models import Supplier

logger = logging.getLogger(__name__)

DEFAULT_FILE = (
    Path(__file__).resolve().parents[6]
    / "docs"
    / "Lista Clientes DSCar Databox.xls"
)

INVALID_NAMES = {"PARTICULAR", "PESSOA NAO CADASTRADA", ""}


def _is_supplier_row(category: str) -> bool:
    """Retorna True se categoria indica fornecedor (bit 1 ativo)."""
    if not category or len(category) < 2:
        return False
    return category[1] == "1"


def _clean_doc(value: str) -> str:
    return re.sub(r"[.\-/]", "", value.strip())


def _clean_phone(value: str) -> str:
    return re.sub(r"\D", "", value.strip())


def _is_valid_cpf(doc: str) -> bool:
    return len(doc) == 11 and doc != "00000000000"


def _is_valid_cnpj(doc: str) -> bool:
    return len(doc) == 14 and doc != "00000000000000"


def _cell(row: list, idx: int) -> str:
    try:
        raw = row[idx]
    except IndexError:
        return ""
    if isinstance(raw, float):
        if raw.is_integer():
            return str(int(raw))
        return str(raw)
    return str(raw or "").strip().replace("\xa0", " ")


class Command(BaseCommand):
    help = (
        "Importa fornecedores do Databox (Lista Clientes DSCar Databox.xls) "
        "para Supplier no schema do tenant."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--file",
            type=str,
            default=str(DEFAULT_FILE),
            help=f"Caminho do .xls (default: {DEFAULT_FILE})",
        )
        parser.add_argument(
            "--tenant-schema",
            type=str,
            default="tenant_dscar",
            dest="tenant_schema",
            help="Schema do tenant (default: tenant_dscar)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Simula a importacao sem persistir nada.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Processa apenas as N primeiras linhas (0 = todas).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        file_path = options["file"]
        tenant_schema = options["tenant_schema"]
        dry_run = options["dry_run"]
        limit = options["limit"]

        try:
            wb = xlrd.open_workbook(file_path)
        except FileNotFoundError as exc:
            raise CommandError(f"Arquivo nao encontrado: {file_path}") from exc
        except xlrd.XLRDError as exc:
            raise CommandError(f"Falha ao abrir XLS: {exc}") from exc

        sheet = wb.sheets()[0]
        total = sheet.nrows - 1
        if limit and limit < total:
            total = limit

        self.stdout.write(f"Arquivo: {file_path}")
        self.stdout.write(f"Total de linhas a processar: {total}")
        self.stdout.write(f"Tenant schema: {tenant_schema}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING("=== DRY RUN — nada sera gravado ===")
            )

        stats = {
            "created": 0,
            "skipped_existing": 0,
            "skipped_non_supplier": 0,
            "skipped_invalid_name": 0,
            "errors": 0,
        }
        errors: list[str] = []

        with schema_context(tenant_schema):
            existing_cnpjs = set(
                Supplier.objects.exclude(cnpj="").values_list("cnpj", flat=True)
            )
            # Para PF: usamos chave composta (nome_upper, phone) ja existente.
            existing_pf_keys = set(
                (s.name.upper().strip(), s.phone)
                for s in Supplier.objects.filter(cnpj="")
            )

            last_row = sheet.nrows if not limit else min(sheet.nrows, limit + 1)
            for row_idx in range(1, last_row):
                row = [sheet.cell_value(row_idx, c) for c in range(sheet.ncols)]
                try:
                    self._import_row(
                        row,
                        existing_cnpjs,
                        existing_pf_keys,
                        stats,
                        dry_run,
                    )
                except Exception as exc:  # noqa: BLE001
                    stats["errors"] += 1
                    msg = f"linha {row_idx}: {exc}"
                    errors.append(msg)
                    logger.exception("Erro ao importar linha %s", row_idx)
                    if stats["errors"] > 100:
                        raise CommandError(
                            "Muitos erros consecutivos. Abortando."
                        ) from exc

                if row_idx % 500 == 0:
                    self.stdout.write(
                        f"  ...processados {row_idx}/{total} "
                        f"(criados={stats['created']}, "
                        f"pulados={stats['skipped_existing']}, "
                        f"erros={stats['errors']})"
                    )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== Resultado ==="))
        self.stdout.write(f"  Criados:                  {stats['created']}")
        self.stdout.write(f"  Ja existentes:            {stats['skipped_existing']}")
        self.stdout.write(f"  Nao-fornecedores:         {stats['skipped_non_supplier']}")
        self.stdout.write(f"  Nome invalido:            {stats['skipped_invalid_name']}")
        self.stdout.write(f"  Erros:                    {stats['errors']}")

        if errors:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Primeiros erros:"))
            for err in errors[:20]:
                self.stdout.write(f"  - {err}")
            if len(errors) > 20:
                self.stdout.write(f"  ... +{len(errors) - 20} erros")

    def _import_row(
        self,
        row: list,
        existing_cnpjs: set,
        existing_pf_keys: set,
        stats: dict,
        dry_run: bool,
    ) -> None:
        category = _cell(row, 1)
        full_name = _cell(row, 2)
        fantasy_name = _cell(row, 3)

        upper_name = full_name.upper()
        if upper_name in INVALID_NAMES:
            stats["skipped_invalid_name"] += 1
            return

        if not _is_supplier_row(category):
            stats["skipped_non_supplier"] += 1
            return

        tipo_raw = _cell(row, 4).lower()
        is_pj = "jurídica" in tipo_raw or "juridica" in tipo_raw

        display_name = full_name
        if is_pj and fantasy_name and fantasy_name not in (full_name, "********"):
            display_name = fantasy_name

        doc_raw = _clean_doc(_cell(row, 5))
        cnpj_value = doc_raw if is_pj and _is_valid_cnpj(doc_raw) else ""
        cpf_value = doc_raw if not is_pj and _is_valid_cpf(doc_raw) else ""

        # Dedup
        if cnpj_value:
            if cnpj_value in existing_cnpjs:
                stats["skipped_existing"] += 1
                return
        else:
            # Fornecedor PF — chave composta name+phone
            phone_cel = _clean_phone(_cell(row, 9))
            phone_com = _clean_phone(_cell(row, 8))
            phone_dedup = (phone_cel or phone_com or "")[:20]
            pf_key = (upper_name.strip(), phone_dedup)
            if pf_key in existing_pf_keys:
                stats["skipped_existing"] += 1
                return

        phone_cel = _clean_phone(_cell(row, 9))
        phone_com = _clean_phone(_cell(row, 8))
        phone_value = (phone_cel or phone_com or "")[:20]

        email_raw = _cell(row, 10).lower()
        if "@" not in email_raw:
            email_raw = _cell(row, 11).lower()
        if "@" not in email_raw:
            email_raw = ""

        contact_name = _cell(row, 21)

        if dry_run:
            stats["created"] += 1
            if cnpj_value:
                existing_cnpjs.add(cnpj_value)
            else:
                existing_pf_keys.add((upper_name.strip(), phone_value))
            return

        with transaction.atomic():
            Supplier.objects.create(
                name=display_name[:200],
                cnpj=cnpj_value,
                cpf=cpf_value,
                email=email_raw[:254],
                phone=phone_value,
                contact_name=contact_name[:200],
            )

        stats["created"] += 1
        if cnpj_value:
            existing_cnpjs.add(cnpj_value)
        else:
            existing_pf_keys.add((upper_name.strip(), phone_value))
