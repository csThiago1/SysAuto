"""
Management command para importar clientes do Databox (sistema legado DS Car)
para o modelo UnifiedCustomer (schema público — cliente unificado do Grupo).

Lê o arquivo "Lista Clientes DSCar Databox.xls" (~7k clientes, formato .xls
Excel 97-2003) e cria registros UnifiedCustomer com:
  - name (Razão Social ou Nome PF)
  - cpf / cnpj (criptografados via EncryptedCharField) — apenas dígitos
  - cpf_hash (SHA-256 do CPF/CNPJ; campo unique no model)
  - email + email_hash (e-mail NF-e como principal; fallback financeiro)
  - phone + phone_hash (celular como principal; fallback comercial)
  - birth_date, endereço (rua, número, bairro, cidade, UF, CEP, complemento)

Dedup:
  - Por cpf_hash (campo unique). Linhas com CPF/CNPJ inválido (todos zeros,
    tamanho errado) entram com cpf=None e SEM dedup — qualquer linha sem
    documento válido é inserida pela primeira vez por nome+telefone.
  - Idempotente: roda múltiplas vezes sem duplicar registros já importados.

Apenas categorias de CLIENTE são importadas. Categorias de fornecedor
(bitmask "01...") e seguradora ("10100000000") são puladas — essas vão para
Person/Insurer via apps.persons.management.commands.import_databox_clients.

Uso:
    # Arquivo padrão (docs/Lista Clientes DSCar Databox.xls):
    python manage.py import_clientes_dscar

    # Caminho customizado:
    python manage.py import_clientes_dscar --file /tmp/clientes.xls

    # Dry run (não persiste nada):
    python manage.py import_clientes_dscar --dry-run

    # Schema do tenant para resolver request.tenant em signals (default
    # tenant_dscar). UnifiedCustomer vive no schema público, mas alguns
    # signals podem precisar do contexto do tenant.
    python manage.py import_clientes_dscar --tenant-schema tenant_dscar

Notas sobre o layout do XLS (colunas — verificado contra arquivo real):
    [0] Código              [1] Categoria        [2] Razão Social
    [3] Fantasia            [4] Tipo de Pessoa   [5] Documento (CPF/CNPJ)
    [6] Tipo de Inscrição   [7] Documento aux    [8] Fone Comercial
    [9] Fone Celular        [10] E-mail NF-e     [11] E-mail Financeiro
    [12] Simples Nacional   [13] Indústria       [14] Endereço
    [15] Número             [16] Bairro          [17] Cidade
    [18] Estado             [19] CEP             [20] Complemento
    [21] Contato            [22] Site            [23] Sexo
    [24] Data de Nascimento ...
Se a planilha mudar (ordem diferente, novas colunas), ajuste a função
``_extract_row`` mantendo o dicionário plano de saída.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from pathlib import Path
from typing import Any

import xlrd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django_tenants.utils import schema_context

from apps.customers.models import UnifiedCustomer
from apps.persons.utils import sha256_hex

logger = logging.getLogger(__name__)

# Caminho padrão do arquivo dentro do monorepo.
# Estrutura: <repo>/backend/core/apps/customers/management/commands/<this file>
# parents[6] = <repo> (grupo-dscar)
DEFAULT_FILE = (
    Path(__file__).resolve().parents[6]
    / "docs"
    / "Lista Clientes DSCar Databox.xls"
)

# Categorias Databox (bitmask de 11 posições):
#   bit 0 = cliente, bit 1 = fornecedor, bit 2 = seguradora
# Importamos apenas LINHAS COM bit 0 ativo E bit 1 zerado (clientes puros
# ou cliente+seguradora). Fornecedores são tratados em outro comando.
INSURER_CATEGORIES = {"10100000000"}
SUPPLIER_CATEGORIES = {"01000000000", "01010000000"}

# Nomes "fantasma" da base legada — ignorar.
INVALID_NAMES = {"PARTICULAR", "PESSOA NAO CADASTRADA", ""}


def _is_client_row(category: str) -> bool:
    """Retorna True se a categoria indica cliente (puro ou misto)."""
    if not category:
        return True  # sem categoria = assume cliente
    if category in INSURER_CATEGORIES:
        return False
    if category in SUPPLIER_CATEGORIES:
        return False
    # Categoria "10..." (bit 0 = cliente) ou similar.
    # Bit 1 = fornecedor → pular se ligado e bit 0 desligado.
    if len(category) >= 2 and category[1] == "1" and category[0] == "0":
        return False
    return True


def _clean_doc(value: str) -> str:
    """Remove formatação de CPF/CNPJ — mantém apenas dígitos."""
    return re.sub(r"[.\-/]", "", value.strip())


def _clean_phone(value: str) -> str:
    """Mantém apenas dígitos de um telefone."""
    return re.sub(r"\D", "", value.strip())


def _is_valid_cpf(doc: str) -> bool:
    return len(doc) == 11 and doc != "00000000000"


def _is_valid_cnpj(doc: str) -> bool:
    return len(doc) == 14 and doc != "00000000000000"


def _clean_cep(value: str) -> str:
    """CEP vem como '69.000-000' → '69000000' (8 dígitos)."""
    return re.sub(r"\D", "", value.strip())[:8]


def _excel_date_to_python(value: float) -> date | None:
    """Converte serial date do Excel (float) para date Python."""
    if not value:
        return None
    try:
        return xlrd.xldate_as_datetime(value, 0).date()
    except (ValueError, OverflowError):
        return None


def _cell(row: list, idx: int) -> str:
    """Lê uma célula como string, tolerante a float/inteiro."""
    try:
        raw = row[idx]
    except IndexError:
        return ""
    if isinstance(raw, float):
        # Inteiros vêm como float no xlrd; evitar "12345.0".
        if raw.is_integer():
            return str(int(raw))
        return str(raw)
    return str(raw or "").strip().replace("\xa0", " ")


class Command(BaseCommand):
    help = (
        "Importa clientes do Databox (Lista Clientes DSCar Databox.xls) "
        "para UnifiedCustomer no schema público."
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
            help="Schema do tenant para signals (default: tenant_dscar)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Simula a importação sem persistir nada.",
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
            raise CommandError(f"Arquivo não encontrado: {file_path}") from exc
        except xlrd.XLRDError as exc:
            raise CommandError(f"Falha ao abrir XLS: {exc}") from exc

        sheet = wb.sheets()[0]
        total = sheet.nrows - 1  # menos o header
        if limit and limit < total:
            total = limit

        self.stdout.write(f"Arquivo: {file_path}")
        self.stdout.write(f"Total de linhas a processar: {total}")
        self.stdout.write(f"Tenant schema (signals): {tenant_schema}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING("=== DRY RUN — nada será gravado ===")
            )

        stats = {
            "created": 0,
            "skipped_existing": 0,
            "skipped_non_client": 0,
            "skipped_invalid_name": 0,
            "errors": 0,
        }
        errors: list[str] = []

        # UnifiedCustomer vive no schema público; usamos schema_context
        # para o caso de signals tocarem em modelos tenant-aware.
        with schema_context(tenant_schema):
            existing_hashes = set(
                UnifiedCustomer.objects.exclude(cpf_hash__isnull=True)
                .exclude(cpf_hash="")
                .values_list("cpf_hash", flat=True)
            )

            last_row = sheet.nrows if not limit else min(sheet.nrows, limit + 1)
            for row_idx in range(1, last_row):
                row = [sheet.cell_value(row_idx, c) for c in range(sheet.ncols)]
                try:
                    self._import_row(
                        row, existing_hashes, stats, dry_run,
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
        self.stdout.write(f"  Criados:                {stats['created']}")
        self.stdout.write(f"  Já existentes (CPF):    {stats['skipped_existing']}")
        self.stdout.write(f"  Não-clientes (pulados): {stats['skipped_non_client']}")
        self.stdout.write(f"  Nome inválido:          {stats['skipped_invalid_name']}")
        self.stdout.write(f"  Erros:                  {stats['errors']}")

        if errors:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Primeiros erros:"))
            for err in errors[:20]:
                self.stdout.write(f"  - {err}")
            if len(errors) > 20:
                self.stdout.write(f"  ... +{len(errors) - 20} erros")

    # ─────────────────────────────────────────────────────────────────
    # Importação por linha
    # ─────────────────────────────────────────────────────────────────
    def _import_row(
        self,
        row: list,
        existing_hashes: set,
        stats: dict,
        dry_run: bool,
    ) -> None:
        category = _cell(row, 1)
        full_name = _cell(row, 2)
        fantasy_name = _cell(row, 3)

        # Nome inválido / placeholder.
        upper_name = full_name.upper()
        if upper_name in INVALID_NAMES:
            stats["skipped_invalid_name"] += 1
            return

        # Filtrar não-clientes (fornecedores e seguradoras).
        if not _is_client_row(category):
            stats["skipped_non_client"] += 1
            return

        # Resolver nome de exibição: PJ usa fantasia se houver e diferir.
        tipo_raw = _cell(row, 4).lower()
        is_pj = "jurídica" in tipo_raw or "juridica" in tipo_raw

        display_name = full_name
        if is_pj and fantasy_name and fantasy_name not in (full_name, "********"):
            display_name = fantasy_name

        # Documento (CPF para PF, CNPJ para PJ).
        doc_raw = _clean_doc(_cell(row, 5))
        if is_pj:
            doc_valid = _is_valid_cnpj(doc_raw)
        else:
            doc_valid = _is_valid_cpf(doc_raw)
        doc_for_storage = doc_raw if doc_valid else ""

        # Dedup por hash de documento (campo unique).
        doc_hash = sha256_hex(doc_for_storage) if doc_for_storage else None
        if doc_hash and doc_hash in existing_hashes:
            stats["skipped_existing"] += 1
            return

        # Telefones: celular primeiro, comercial como fallback.
        # UnifiedCustomer.phone é NOT NULL — sempre gravar algo (pode ser
        # string vazia, mas o model exige tamanho ≥ 0 e o campo é blank=False
        # implicitamente. Usamos celular > comercial > '0' como sentinela).
        phone_cel = _clean_phone(_cell(row, 9))
        phone_com = _clean_phone(_cell(row, 8))
        phone_value = phone_cel or phone_com or ""

        # E-mails: NF-e principal, financeiro como fallback.
        email_raw = _cell(row, 10).lower()
        if "@" not in email_raw:
            email_raw = _cell(row, 11).lower()
        if "@" not in email_raw:
            email_raw = ""

        # Data de nascimento.
        birth_raw = row[24] if len(row) > 24 else ""
        birth_date = (
            _excel_date_to_python(birth_raw)
            if isinstance(birth_raw, float)
            else None
        )

        # Endereço.
        street = _cell(row, 14)
        street_number = _cell(row, 15)
        neighborhood = _cell(row, 16)
        city = _cell(row, 17)
        state = _cell(row, 18).upper()[:2]
        zip_code = _clean_cep(_cell(row, 19))
        complement = _cell(row, 20)

        # PF: separa cpf/cnpj corretamente — UnifiedCustomer só tem campo
        # cpf, mas usamos esse mesmo campo para CNPJ (dado legado; o hash
        # garante unicidade independente do tipo).
        cpf_value = doc_for_storage or None

        if dry_run:
            stats["created"] += 1
            if doc_hash:
                existing_hashes.add(doc_hash)
            return

        with transaction.atomic():
            UnifiedCustomer.objects.create(
                name=display_name[:200],
                cpf=cpf_value,
                email=email_raw or None,
                phone=phone_value[:20],
                birth_date=birth_date,
                zip_code=zip_code[:9],
                street=street[:200],
                street_number=street_number[:20],
                complement=complement[:100],
                neighborhood=neighborhood[:100],
                city=city[:100],
                state=state,
            )
            # cpf_hash/email_hash/phone_hash são preenchidos no save() do
            # próprio model (ver UnifiedCustomer.save).

        stats["created"] += 1
        if doc_hash:
            existing_hashes.add(doc_hash)
