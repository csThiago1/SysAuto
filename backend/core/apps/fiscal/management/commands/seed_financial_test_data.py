"""
Paddock Solutions — Seed Financial/Fiscal Test Data

Cria dados de teste realistas para validacao do painel fiscal e financeiro:
  - 3 Suppliers
  - 5 FiscalDocuments (NFS-e + NF-e)
  - 5 NFeEntrada com itens
  - 8 PayableDocuments
  - 8 ReceivableDocuments
  - Links FiscalDocument -> ReceivableDocument

Idempotente: usa get_or_create / check-before-create em campos unicos.
"""

import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Seed financial/fiscal test data for validation"

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--schema",
            default="tenant_dscar",
            help="Tenant schema name (default: tenant_dscar)",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from django_tenants.utils import schema_context

        schema: str = options["schema"]
        self.stdout.write(f"Seeding financial data in schema '{schema}'...")

        with schema_context(schema):
            self._seed_prerequisites()
            self._seed_suppliers()
            self._seed_fiscal_documents()
            self._seed_nfe_entrada()
            self._seed_payables()
            self._seed_receivables()
            self._link_documents()

        self.stdout.write(self.style.SUCCESS("Seed financial data complete!"))

    # ── Prerequisites ─────────────────────────────────────────────────────

    def _seed_prerequisites(self) -> None:
        from apps.fiscal.models import FiscalConfigModel
        from apps.persons.models import Person

        self._config = FiscalConfigModel.objects.filter(is_active=True).first()
        if self._config:
            self.stdout.write(f"  FiscalConfig found: {self._config}")
        else:
            self.stdout.write(self.style.WARNING("  No active FiscalConfig found (optional)."))

        self._person, created = Person.objects.get_or_create(
            full_name="Auto Pecas Norte LTDA",
            defaults={"person_kind": "PJ", "is_active": True},
        )
        self.stdout.write(
            f"  Person: {self._person.full_name} ({'created' if created else 'exists'})"
        )

    # ── 1. Suppliers ──────────────────────────────────────────────────────

    def _seed_suppliers(self) -> None:
        from apps.accounts_payable.models import Supplier

        suppliers_data = [
            {
                "name": "Auto Pecas Manaus LTDA",
                "cnpj": "12345678000190",
                "email": "contato@autopm.com.br",
                "phone": "(92) 3234-5678",
            },
            {
                "name": "Tintas & Vernizes Norte",
                "cnpj": "98765432000121",
                "email": "vendas@tvnorte.com.br",
                "phone": "(92) 3345-6789",
            },
            {
                "name": "Polimentos Express AM",
                "cnpj": "11223344000155",
                "email": "comercial@polexpress.com.br",
                "phone": "(92) 3456-7890",
            },
        ]

        self._suppliers: list[Supplier] = []
        for data in suppliers_data:
            supplier, created = Supplier.objects.get_or_create(
                name=data["name"],
                defaults={
                    "cnpj": data["cnpj"],
                    "email": data["email"],
                    "phone": data["phone"],
                },
            )
            self._suppliers.append(supplier)
            status = "created" if created else "exists"
            self.stdout.write(f"  Supplier: {supplier.name} ({status})")

    # ── 2. FiscalDocuments ────────────────────────────────────────────────

    def _seed_fiscal_documents(self) -> None:
        from apps.fiscal.models import FiscalDocument

        now = timezone.now()

        fiscal_docs_data = [
            {
                "document_type": "nfse",
                "status": "authorized",
                "ref": "TEST-NFSE-001",
                "number": "1001",
                "total_value": Decimal("3500.00"),
                "environment": "homologacao",
                "manual_reason": "Seed: teste NFS-e autorizada",
                "authorized_at": now - timedelta(days=3),
            },
            {
                "document_type": "nfse",
                "status": "authorized",
                "ref": "TEST-NFSE-002",
                "number": "1002",
                "total_value": Decimal("7800.00"),
                "environment": "homologacao",
                "manual_reason": "Seed: teste NFS-e autorizada",
                "authorized_at": now - timedelta(days=7),
            },
            {
                "document_type": "nfse",
                "status": "authorized",
                "ref": "TEST-NFSE-003",
                "number": "1003",
                "total_value": Decimal("2100.00"),
                "environment": "homologacao",
                "manual_reason": "Seed: teste NFS-e autorizada",
                "authorized_at": now - timedelta(days=1),
            },
            {
                "document_type": "nfe",
                "status": "authorized",
                "ref": "TEST-NFE-001",
                "number": "5001",
                "total_value": Decimal("15200.00"),
                "key": "13260112345678000190550010000050011234567890",
                "environment": "homologacao",
                "manual_reason": "Seed: teste NF-e autorizada",
                "authorized_at": now - timedelta(days=5),
                "cce_count": 2,
            },
            {
                "document_type": "nfe",
                "status": "rejected",
                "ref": "TEST-NFE-002",
                "number": "",
                "total_value": Decimal("4300.00"),
                "rejection_reason": "SEFAZ: Erro 629 - Valor do produto difere",
                "environment": "homologacao",
                "manual_reason": "Seed: teste NF-e rejeitada",
            },
        ]

        self._fiscal_docs: list[FiscalDocument] = []
        for data in fiscal_docs_data:
            ref = data.pop("ref")
            doc, created = FiscalDocument.objects.get_or_create(
                ref=ref,
                defaults={
                    **data,
                    "config": self._config,
                    "destinatario": self._person,
                },
            )
            self._fiscal_docs.append(doc)
            status = "created" if created else "exists"
            self.stdout.write(
                f"  FiscalDocument: {doc.document_type.upper()} #{doc.number} "
                f"[{doc.status}] ({status})"
            )

    # ── 3. NFeEntrada + Items ─────────────────────────────────────────────

    def _seed_nfe_entrada(self) -> None:
        from apps.fiscal.models import NFeEntrada, NFeEntradaItem

        nfe_entrada_data = [
            {
                "chave_acesso": "13260198765432000121550010000010011234567891",
                "numero": "101",
                "serie": "1",
                "emitente_cnpj": "98765432000121",
                "emitente_nome": "Tintas & Vernizes Norte",
                "data_emissao": date.today() - timedelta(days=5),
                "valor_total": Decimal("4500.00"),
                "status": "importada",
                "auto_imported": True,
            },
            {
                "chave_acesso": "13260112345678000190550010000010021234567892",
                "numero": "102",
                "serie": "1",
                "emitente_cnpj": "12345678000190",
                "emitente_nome": "Auto Pecas Manaus LTDA",
                "data_emissao": date.today() - timedelta(days=10),
                "valor_total": Decimal("8200.00"),
                "status": "importada",
            },
            {
                "chave_acesso": "13260112345678000190550010000010031234567893",
                "numero": "103",
                "serie": "1",
                "emitente_cnpj": "12345678000190",
                "emitente_nome": "Auto Pecas Manaus LTDA",
                "data_emissao": date.today() - timedelta(days=15),
                "valor_total": Decimal("3100.00"),
                "status": "validada",
            },
            {
                "chave_acesso": "13260198765432000121550010000010041234567894",
                "numero": "104",
                "serie": "1",
                "emitente_cnpj": "98765432000121",
                "emitente_nome": "Tintas & Vernizes Norte",
                "data_emissao": date.today() - timedelta(days=20),
                "valor_total": Decimal("6700.00"),
                "status": "validada",
            },
            {
                "chave_acesso": "13260111223344000155550010000010051234567895",
                "numero": "105",
                "serie": "1",
                "emitente_cnpj": "11223344000155",
                "emitente_nome": "Polimentos Express AM",
                "data_emissao": date.today() - timedelta(days=30),
                "valor_total": Decimal("2300.00"),
                "status": "estoque_gerado",
                "estoque_gerado": True,
            },
        ]

        items_templates = [
            {
                "descricao_original": "Lixa dagua P400 folha",
                "ncm": "68052000",
                "unidade_compra": "UN",
                "quantidade": Decimal("50"),
                "valor_unitario_bruto": Decimal("3.50"),
                "valor_unitario_com_tributos": Decimal("4.20"),
                "valor_total_com_tributos": Decimal("210.00"),
            },
            {
                "descricao_original": "Primer PU cinza 900ml",
                "ncm": "32091010",
                "unidade_compra": "UN",
                "quantidade": Decimal("12"),
                "valor_unitario_bruto": Decimal("89.90"),
                "valor_unitario_com_tributos": Decimal("107.88"),
                "valor_total_com_tributos": Decimal("1294.56"),
            },
            {
                "descricao_original": "Massa plastica 500g",
                "ncm": "32141010",
                "unidade_compra": "UN",
                "quantidade": Decimal("20"),
                "valor_unitario_bruto": Decimal("25.00"),
                "valor_unitario_com_tributos": Decimal("30.00"),
                "valor_total_com_tributos": Decimal("600.00"),
            },
            {
                "descricao_original": "Fita crepe automotiva 48mm",
                "ncm": "48234000",
                "unidade_compra": "RL",
                "quantidade": Decimal("30"),
                "valor_unitario_bruto": Decimal("12.50"),
                "valor_unitario_com_tributos": Decimal("15.00"),
                "valor_total_com_tributos": Decimal("450.00"),
            },
            {
                "descricao_original": "Verniz PU bicomponente 750ml",
                "ncm": "32091010",
                "unidade_compra": "UN",
                "quantidade": Decimal("8"),
                "valor_unitario_bruto": Decimal("145.00"),
                "valor_unitario_com_tributos": Decimal("174.00"),
                "valor_total_com_tributos": Decimal("1392.00"),
            },
        ]

        self._nfe_entradas: list[NFeEntrada] = []
        for idx, data in enumerate(nfe_entrada_data):
            chave = data["chave_acesso"]
            nfe, created = NFeEntrada.objects.get_or_create(
                chave_acesso=chave,
                defaults=data,
            )
            self._nfe_entradas.append(nfe)
            status_label = "created" if created else "exists"
            self.stdout.write(
                f"  NFeEntrada: #{nfe.numero}/{nfe.serie} [{nfe.status}] ({status_label})"
            )

            if created:
                # Assign 2-3 items per NFeEntrada (cycling through templates)
                num_items = 2 if idx % 2 == 0 else 3
                for item_idx in range(num_items):
                    template = items_templates[(idx + item_idx) % len(items_templates)]
                    NFeEntradaItem.objects.create(
                        nfe_entrada=nfe,
                        numero_item=item_idx + 1,
                        **template,
                    )
                self.stdout.write(f"    -> {num_items} items created")

    # ── 4. PayableDocuments ───────────────────────────────────────────────

    def _seed_payables(self) -> None:
        from apps.accounts_payable.models import PayableDocument

        today = date.today()

        payable_data = [
            {
                "supplier": self._suppliers[0],
                "description": "NF 101 - Auto Pecas Manaus",
                "amount": Decimal("4500.00"),
                "due_date": today - timedelta(days=10),
                "status": "overdue",
                "origin": "NFE_E",
            },
            {
                "supplier": self._suppliers[0],
                "description": "NF 102 - Auto Pecas Manaus",
                "amount": Decimal("8200.00"),
                "due_date": today + timedelta(days=5),
                "status": "open",
                "origin": "NFE_E",
            },
            {
                "supplier": self._suppliers[1],
                "description": "Tintas para pintura OS 0087",
                "amount": Decimal("6700.00"),
                "due_date": today + timedelta(days=15),
                "status": "open",
                "origin": "NFE_E",
            },
            {
                "supplier": self._suppliers[1],
                "description": "Tintas para pintura OS 0092",
                "amount": Decimal("3200.00"),
                "due_date": today - timedelta(days=5),
                "status": "overdue",
                "origin": "MAN",
            },
            {
                "supplier": self._suppliers[2],
                "description": "Material polimento lote 04/2026",
                "amount": Decimal("2300.00"),
                "amount_paid": Decimal("1000.00"),
                "due_date": today + timedelta(days=2),
                "status": "partial",
                "origin": "NFE_E",
            },
            {
                "supplier": self._suppliers[0],
                "description": "Parafusos e fixadores variados",
                "amount": Decimal("850.00"),
                "amount_paid": Decimal("850.00"),
                "due_date": today - timedelta(days=20),
                "status": "paid",
                "origin": "MAN",
            },
            {
                "supplier": self._suppliers[2],
                "description": "Cera de polimento premium",
                "amount": Decimal("1200.00"),
                "due_date": today - timedelta(days=15),
                "status": "cancelled",
                "cancel_reason": "Fornecedor cancelou pedido",
                "origin": "MAN",
            },
            {
                "supplier": self._suppliers[1],
                "description": "Aluguel galpao maio/2026",
                "amount": Decimal("5000.00"),
                "due_date": today + timedelta(days=25),
                "status": "open",
                "origin": "AUTO",
            },
        ]

        self._payables: list[PayableDocument] = []
        for data in payable_data:
            description = data["description"]
            supplier = data["supplier"]

            # Use competence_date = due_date (required field)
            data.setdefault("competence_date", data["due_date"])

            existing = PayableDocument.objects.filter(
                description=description,
                supplier=supplier,
            ).first()

            if existing:
                self._payables.append(existing)
                self.stdout.write(f"  Payable: {description} (exists)")
            else:
                doc = PayableDocument.objects.create(**data)
                self._payables.append(doc)
                self.stdout.write(f"  Payable: {description} (created)")

    # ── 5. ReceivableDocuments ────────────────────────────────────────────

    def _seed_receivables(self) -> None:
        from apps.accounts_receivable.models import ReceivableDocument

        today = date.today()

        # Stable UUIDs for idempotency
        cust_uuids = {
            "cust-001": uuid.UUID("00000000-0000-4000-a001-000000000001"),
            "cust-002": uuid.UUID("00000000-0000-4000-a001-000000000002"),
            "cust-003": uuid.UUID("00000000-0000-4000-a001-000000000003"),
            "cust-004": uuid.UUID("00000000-0000-4000-a001-000000000004"),
            "cust-005": uuid.UUID("00000000-0000-4000-a001-000000000005"),
            "cust-006": uuid.UUID("00000000-0000-4000-a001-000000000006"),
        }

        receivable_data = [
            {
                "customer_name": "Seguradora Alfa S.A.",
                "customer_id": cust_uuids["cust-001"],
                "description": "OS 0087 - Funilaria Civic",
                "amount": Decimal("12500.00"),
                "due_date": today - timedelta(days=8),
                "status": "overdue",
                "origin": "NFSE",
            },
            {
                "customer_name": "Seguradora Alfa S.A.",
                "customer_id": cust_uuids["cust-001"],
                "description": "OS 0092 - Pintura HRV",
                "amount": Decimal("8700.00"),
                "due_date": today + timedelta(days=10),
                "status": "open",
                "origin": "NFSE",
            },
            {
                "customer_name": "Maria Silva",
                "customer_id": cust_uuids["cust-002"],
                "description": "OS 0095 - Polimento Corolla",
                "amount": Decimal("1800.00"),
                "due_date": today + timedelta(days=20),
                "status": "open",
                "origin": "NFSE",
            },
            {
                "customer_name": "Joao Santos",
                "customer_id": cust_uuids["cust-003"],
                "description": "OS 0098 - Lavagem completa Hilux",
                "amount": Decimal("450.00"),
                "amount_received": Decimal("450.00"),
                "due_date": today - timedelta(days=3),
                "status": "received",
                "origin": "NFSE",
            },
            {
                "customer_name": "Seguradora Beta LTDA",
                "customer_id": cust_uuids["cust-004"],
                "description": "OS 0100 - Funilaria Onix",
                "amount": Decimal("9200.00"),
                "due_date": today - timedelta(days=15),
                "status": "overdue",
                "origin": "NFE",
            },
            {
                "customer_name": "Seguradora Beta LTDA",
                "customer_id": cust_uuids["cust-004"],
                "description": "OS 0101 - Pecas Onix",
                "amount": Decimal("5600.00"),
                "amount_received": Decimal("2800.00"),
                "due_date": today + timedelta(days=3),
                "status": "partial",
                "origin": "NFE",
            },
            {
                "customer_name": "Carlos Oliveira",
                "customer_id": cust_uuids["cust-005"],
                "description": "OS 0103 - Particular mecanica",
                "amount": Decimal("3200.00"),
                "due_date": today - timedelta(days=25),
                "status": "cancelled",
                "cancel_reason": "Cliente desistiu do servico",
                "origin": "MAN",
            },
            {
                "customer_name": "Ana Costa",
                "customer_id": cust_uuids["cust-006"],
                "description": "OS 0105 - Polimento + cristalizacao",
                "amount": Decimal("2100.00"),
                "due_date": today + timedelta(days=30),
                "status": "open",
                "origin": "MAN",
            },
        ]

        self._receivables: list[ReceivableDocument] = []
        for data in receivable_data:
            description = data["description"]
            customer_id = data["customer_id"]

            # competence_date is required
            data.setdefault("competence_date", data["due_date"])

            existing = ReceivableDocument.objects.filter(
                description=description,
                customer_id=customer_id,
            ).first()

            if existing:
                self._receivables.append(existing)
                self.stdout.write(f"  Receivable: {description} (exists)")
            else:
                doc = ReceivableDocument.objects.create(**data)
                self._receivables.append(doc)
                self.stdout.write(f"  Receivable: {description} (created)")

    # ── 6. Link FiscalDocuments -> ReceivableDocuments ────────────────────

    def _link_documents(self) -> None:
        """Link the first 3 authorized NFS-e docs to the first 3 AR docs."""
        nfse_authorized = [
            d for d in self._fiscal_docs
            if d.document_type == "nfse" and d.status == "authorized"
        ]

        links_made = 0
        for fiscal_doc, receivable_doc in zip(nfse_authorized[:3], self._receivables[:3]):
            if receivable_doc.fiscal_document_id != fiscal_doc.pk:
                receivable_doc.fiscal_document = fiscal_doc
                receivable_doc.save(update_fields=["fiscal_document"])
                links_made += 1
                self.stdout.write(
                    f"  Linked: {fiscal_doc.ref} -> {receivable_doc.description}"
                )

        if links_made == 0:
            self.stdout.write("  Links: all already linked (no changes)")
        else:
            self.stdout.write(f"  Links: {links_made} fiscal -> receivable linked")
