"""
Management command para importar pessoas do Databox (sistema legado).

Importa clientes, fornecedores e seguradoras.
- Clientes (cat bit 0) → Person + PersonRole(CLIENT)
- Fornecedores (cat bit 1 = '01...') → Person + PersonRole(SUPPLIER)
- Seguradoras (cat '10100000000') → insurers.Insurer (schema público)

Uso:
    python manage.py import_databox_clients /tmp/databox_clients.xls --tenant=tenant_dscar
    python manage.py import_databox_clients /tmp/databox_clients.xls --tenant=tenant_dscar --dry-run
"""

import logging
import re
from datetime import date
from typing import Any

import xlrd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django_tenants.utils import schema_context

from apps.insurers.models import Insurer
from apps.persons.models import (
    Person,
    PersonAddress,
    PersonContact,
    PersonDocument,
    PersonRole,
    TipoContato,
    TipoDocumento,
    TipoEndereco,
    TipoPessoa,
)
from apps.persons.utils import sha256_hex

logger = logging.getLogger(__name__)

# Categorias Databox — bitmask de 11 posições:
# pos 0 = Cliente, pos 1 = Fornecedor, pos 2 = Seguradora (na verdade, pela análise dos dados)
# Baseado nos dados reais:
#   10000000000 = Cliente PF/PJ
#   01000000000 = Fornecedor
#   10100000000 = Seguradora (cliente + seguradora)
#   11000000000 = Fornecedor + Cliente
INSURER_CATEGORIES = {"10100000000"}
SUPPLIER_CATEGORIES = {"01000000000", "01010000000"}


def classify_role(category: str, full_name: str) -> str:
    """Classifica o role da pessoa baseado na categoria Databox."""
    if category in INSURER_CATEGORIES:
        return "INSURER"
    if category in SUPPLIER_CATEGORIES:
        return "SUPPLIER"
    # Categorias mistas (11000000000, 11100000000, etc.) — bit 1 indica fornecedor
    if len(category) >= 2 and category[1] == "1" and category[0] == "0":
        return "SUPPLIER"
    return "CLIENT"


def clean_doc(value: str) -> str:
    """Remove formatação de CPF/CNPJ."""
    return re.sub(r"[.\-/]", "", value.strip())


def clean_phone(value: str) -> str:
    """Remove formatação de telefone, mantém apenas dígitos."""
    return re.sub(r"[^\d]", "", value.strip())


def is_valid_cpf(doc: str) -> bool:
    """Verifica se CPF tem 11 dígitos e não é zerado."""
    return len(doc) == 11 and doc != "00000000000"


def is_valid_cnpj(doc: str) -> bool:
    """Verifica se CNPJ tem 14 dígitos e não é zerado."""
    return len(doc) == 14 and doc != "00000000000000"


def excel_date_to_python(value: float) -> date | None:
    """Converte serial date do Excel para date Python."""
    if not value:
        return None
    try:
        return xlrd.xldate_as_datetime(value, 0).date()
    except (ValueError, OverflowError):
        return None


def map_inscription_type(raw: str) -> str:
    """Mapeia tipo de inscrição Databox para nosso enum."""
    raw_lower = raw.strip().lower()
    if "contribuinte" in raw_lower and "não" not in raw_lower:
        return "CONTRIBUINTE"
    if "isento" in raw_lower:
        return "ISENTO"
    return "NAO_CONTRIBUINTE"


def map_gender(raw: str) -> str:
    """Mapeia sexo do Databox para nosso campo."""
    raw_lower = raw.strip().lower()
    if raw_lower in ("masculino", "m"):
        return "M"
    if raw_lower in ("feminino", "f"):
        return "F"
    return ""


class Command(BaseCommand):
    help = "Importa clientes, fornecedores e seguradoras do Databox (sistema legado)"

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("file", type=str, help="Caminho do arquivo .xls")
        parser.add_argument(
            "--tenant",
            type=str,
            default="tenant_dscar",
            help="Schema do tenant (default: tenant_dscar)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula importação sem salvar no banco",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        file_path = options["file"]
        tenant_schema = options["tenant"]
        dry_run = options["dry_run"]

        try:
            wb = xlrd.open_workbook(file_path)
        except FileNotFoundError:
            raise CommandError(f"Arquivo não encontrado: {file_path}")

        sheet = wb.sheets()[0]
        total = sheet.nrows - 1

        self.stdout.write(f"Arquivo: {file_path}")
        self.stdout.write(f"Total de registros: {total}")
        self.stdout.write(f"Tenant: {tenant_schema}")
        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN — nenhum dado será salvo ==="))

        stats = {
            "clients": 0,
            "suppliers": 0,
            "insurers": 0,
            "skipped_existing": 0,
            "skipped_invalid": 0,
            "errors": 0,
        }

        # --- Seguradoras vão no schema público ---
        existing_insurer_cnpjs = set(
            Insurer.objects.values_list("cnpj", flat=True)
        )

        with schema_context(tenant_schema):
            existing_codes = set(
                Person.objects.filter(legacy_code__gt="")
                .values_list("legacy_code", flat=True)
            )

            for row_idx in range(1, sheet.nrows):
                try:
                    self._import_row(
                        sheet, row_idx, existing_codes,
                        existing_insurer_cnpjs, stats, dry_run,
                    )
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"Erro na linha {row_idx}: {e}")
                    if stats["errors"] > 50:
                        raise CommandError("Muitos erros. Abortando.")

                if row_idx % 500 == 0:
                    self.stdout.write(f"  Processados: {row_idx}/{total}")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== Resultado ==="))
        self.stdout.write(f"  Clientes:          {stats['clients']}")
        self.stdout.write(f"  Fornecedores:      {stats['suppliers']}")
        self.stdout.write(f"  Seguradoras:       {stats['insurers']}")
        self.stdout.write(f"  Já existentes:     {stats['skipped_existing']}")
        self.stdout.write(f"  Inválidos:         {stats['skipped_invalid']}")
        self.stdout.write(f"  Erros:             {stats['errors']}")

    def _import_row(
        self,
        sheet: Any,
        row_idx: int,
        existing_codes: set,
        existing_insurer_cnpjs: set,
        stats: dict,
        dry_run: bool,
    ) -> None:
        """Importa uma linha do XLS."""
        row = [sheet.cell_value(row_idx, c) for c in range(sheet.ncols)]

        legacy_code = str(int(row[0])) if isinstance(row[0], float) else str(row[0]).strip()
        category = str(row[1]).strip()
        full_name = str(row[2]).strip()

        if not full_name or full_name in ("PARTICULAR", "PESSOA NAO CADASTRADA"):
            stats["skipped_invalid"] += 1
            return

        role = classify_role(category, full_name)

        # --- Seguradoras → Insurer (schema público) ---
        if role == "INSURER":
            self._import_insurer(row, existing_insurer_cnpjs, stats, dry_run)
            return

        # --- Clientes e Fornecedores → Person (schema tenant) ---
        if legacy_code in existing_codes:
            stats["skipped_existing"] += 1
            return

        tipo_raw = str(row[4]).strip().lower()
        person_kind = TipoPessoa.JURIDICA if "jurídica" in tipo_raw else TipoPessoa.FISICA

        doc_raw = clean_doc(str(row[5]))
        if person_kind == TipoPessoa.FISICA and not is_valid_cpf(doc_raw):
            doc_raw = ""
        if person_kind == TipoPessoa.JURIDICA and not is_valid_cnpj(doc_raw):
            doc_raw = ""

        fantasy_name = str(row[3]).strip()
        if fantasy_name == full_name or fantasy_name == "********":
            fantasy_name = ""

        inscription_type = map_inscription_type(str(row[6]))

        secondary_doc = str(row[7]).strip()
        if secondary_doc.upper() == "ISENTO":
            secondary_doc = ""

        is_simples = str(row[12]).strip().lower() in ("sim", "s", "1", "true")
        gender = map_gender(str(row[23]))
        birth_date = excel_date_to_python(row[24]) if isinstance(row[24], float) else None

        if dry_run:
            stats["clients" if role == "CLIENT" else "suppliers"] += 1
            existing_codes.add(legacy_code)
            return

        with transaction.atomic():
            person = Person.objects.create(
                person_kind=person_kind,
                full_name=full_name,
                fantasy_name=fantasy_name,
                inscription_type=inscription_type,
                secondary_document=secondary_doc,
                is_simples_nacional=is_simples,
                gender=gender,
                birth_date=birth_date,
                is_active=True,
                legacy_code=legacy_code,
                legacy_category=category,
            )

            PersonRole.objects.create(person=person, role=role)

            if doc_raw:
                doc_type = (
                    TipoDocumento.CPF
                    if person_kind == TipoPessoa.FISICA
                    else TipoDocumento.CNPJ
                )
                PersonDocument.objects.create(
                    person=person,
                    doc_type=doc_type,
                    value=doc_raw,
                    value_hash=sha256_hex(doc_raw),
                    is_primary=True,
                )

            self._create_contacts(person, row)
            self._create_address(person, row)

        stats["clients" if role == "CLIENT" else "suppliers"] += 1
        existing_codes.add(legacy_code)

    def _import_insurer(
        self,
        row: list,
        existing_cnpjs: set,
        stats: dict,
        dry_run: bool,
    ) -> None:
        """Importa seguradora no modelo Insurer (schema público)."""
        full_name = str(row[2]).strip()
        fantasy_name = str(row[3]).strip()
        if fantasy_name in (full_name, "********"):
            fantasy_name = ""

        cnpj_raw = str(row[5]).strip()
        cnpj_clean = clean_doc(cnpj_raw)

        if not is_valid_cnpj(cnpj_clean):
            stats["skipped_invalid"] += 1
            return

        # Formato com pontuação para o model Insurer
        cnpj_formatted = (
            f"{cnpj_clean[:2]}.{cnpj_clean[2:5]}.{cnpj_clean[5:8]}"
            f"/{cnpj_clean[8:12]}-{cnpj_clean[12:14]}"
        )

        if cnpj_formatted in existing_cnpjs:
            stats["skipped_existing"] += 1
            return

        if dry_run:
            stats["insurers"] += 1
            existing_cnpjs.add(cnpj_formatted)
            return

        Insurer.objects.create(
            name=full_name,
            trade_name=fantasy_name,
            cnpj=cnpj_formatted,
            is_active=True,
        )

        stats["insurers"] += 1
        existing_cnpjs.add(cnpj_formatted)

    def _create_contacts(self, person: Person, row: list) -> None:
        """Cria contatos da pessoa a partir da linha XLS."""
        contacts_to_create = []

        phone_com = clean_phone(str(row[8]))
        if phone_com and len(phone_com) >= 10:
            contacts_to_create.append(
                PersonContact(
                    person=person,
                    contact_type=TipoContato.COMERCIAL,
                    value=phone_com,
                    value_hash=sha256_hex(phone_com),
                    is_primary=True,
                )
            )

        phone_cel = clean_phone(str(row[9]))
        if phone_cel and len(phone_cel) >= 10:
            contacts_to_create.append(
                PersonContact(
                    person=person,
                    contact_type=TipoContato.CELULAR,
                    value=phone_cel,
                    value_hash=sha256_hex(phone_cel),
                    is_primary=not contacts_to_create,
                )
            )

        email_nfe = str(row[10]).strip()
        if email_nfe and "@" in email_nfe:
            contacts_to_create.append(
                PersonContact(
                    person=person,
                    contact_type=TipoContato.EMAIL_NFE,
                    value=email_nfe.lower(),
                    value_hash=sha256_hex(email_nfe.lower()),
                    is_primary=False,
                )
            )

        email_fin = str(row[11]).strip()
        if email_fin and "@" in email_fin:
            contacts_to_create.append(
                PersonContact(
                    person=person,
                    contact_type=TipoContato.EMAIL_FINANCEIRO,
                    value=email_fin.lower(),
                    value_hash=sha256_hex(email_fin.lower()),
                    is_primary=False,
                )
            )

        site = str(row[22]).strip()
        if site and ("." in site or "http" in site):
            contacts_to_create.append(
                PersonContact(
                    person=person,
                    contact_type=TipoContato.SITE,
                    value=site,
                    value_hash=sha256_hex(site),
                    is_primary=False,
                )
            )

        if contacts_to_create:
            PersonContact.objects.bulk_create(contacts_to_create)

    def _create_address(self, person: Person, row: list) -> None:
        """Cria endereço principal da pessoa."""
        street = str(row[14]).strip()
        city = str(row[17]).strip()

        if not street and not city:
            return

        number = str(row[15]).strip()
        if isinstance(row[15], float):
            number = str(int(row[15]))

        # CEP vem formatado (69.057-065) — limpar para 8 dígitos
        zip_code = re.sub(r"[.\-]", "", str(row[19]).strip())

        PersonAddress.objects.create(
            person=person,
            address_type=TipoEndereco.PRINCIPAL,
            street=street,
            number=number,
            neighborhood=str(row[16]).strip().replace("\xa0", ""),
            city=city,
            state=str(row[18]).strip().upper(),
            zip_code=zip_code,
            complement=str(row[20]).strip(),
            is_primary=True,
        )
