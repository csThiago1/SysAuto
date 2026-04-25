# Port `imports` App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `imports` app — orquestrador de importações multi-fonte (Cília API + XML IFX) com audit trail completo via `ImportAttempt` e deduplicação por hash SHA-256.

**Architecture:** TENANT_APP. Reutiliza `apps.cilia.client.CiliaClient`, `apps.cilia.sources.cilia_parser.CiliaParser`, `apps.cilia.sources.xml_ifx_parser.XmlIfxParser` e `apps.cilia.dtos.ParsedBudget` — **sem duplicar código**. `ImportService` orquestra: fetch → parse → dedup → persist via `ServiceOrderService.create_new_version_from_import()` (já existente).

**Tech Stack:** Django 5, DRF, Celery, `apps.cilia.*` (existente), `django_tenants.test.cases.TenantTestCase`, `unittest.mock.patch`.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/core/apps/imports/__init__.py` | Package marker |
| Create | `backend/core/apps/imports/apps.py` | AppConfig |
| Create | `backend/core/apps/imports/models.py` | ImportAttempt model |
| Create | `backend/core/apps/imports/services.py` | ImportService (fetch_cilia_budget, import_xml_ifx) |
| Create | `backend/core/apps/imports/tasks.py` | Celery tasks (poll_cilia_budget, sync_active_cilia_os) |
| Create | `backend/core/apps/imports/serializers.py` | ImportAttemptSerializer |
| Create | `backend/core/apps/imports/views.py` | ImportAttemptViewSet + FetchView + XmlUploadView |
| Create | `backend/core/apps/imports/urls.py` | URL patterns |
| Create | `backend/core/apps/imports/admin.py` | Admin |
| Create | `backend/core/apps/imports/migrations/__init__.py` | Package marker |
| Create | `backend/core/apps/imports/migrations/0001_initial.py` | ImportAttempt table |
| Create | `backend/core/apps/imports/tests/__init__.py` | Package marker |
| Create | `backend/core/apps/imports/tests/test_services.py` | ImportService tests |
| Create | `backend/core/apps/imports/tests/test_api.py` | API tests |
| Modify | `backend/core/config/settings/base.py` | Add `"apps.imports"` to TENANT_APPS |
| Modify | `backend/core/config/urls.py` | Add `/api/v1/imports/` |

---

### Task 1: Model + Migration

**Files:**
- Create: `backend/core/apps/imports/__init__.py`
- Create: `backend/core/apps/imports/apps.py`
- Create: `backend/core/apps/imports/models.py`
- Create: `backend/core/apps/imports/admin.py`
- Create: `backend/core/apps/imports/migrations/__init__.py`
- Create: `backend/core/apps/imports/migrations/0001_initial.py`

- [ ] **Step 1: Write model**

`backend/core/apps/imports/apps.py`:
```python
from django.apps import AppConfig


class ImportsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.imports"
    verbose_name = "Importações"
```

`backend/core/apps/imports/models.py`:
```python
"""ImportAttempt — audit trail completo de cada tentativa de importação."""
from django.db import models
from django.utils import timezone


class ImportAttempt(models.Model):
    """Registro imutável de cada chamada a API/upload de arquivo.

    Sempre criado — mesmo em falhas. Chave de deduplicação: raw_hash (SHA-256 do payload).
    """

    SOURCE_CHOICES = [
        ("cilia", "Cilia API"),
        ("hdi", "HDI HTML"),
        ("xml_porto", "XML Porto"),
        ("xml_azul", "XML Azul"),
        ("xml_itau", "XML Itaú"),
    ]

    TRIGGER_CHOICES = [
        ("polling", "Polling Automático"),
        ("upload_manual", "Upload Manual"),
        ("user_requested", "Solicitado pelo Usuário"),
    ]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    trigger = models.CharField(max_length=30, choices=TRIGGER_CHOICES)

    # Identificação do orçamento
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    budget_number = models.CharField(max_length=40, blank=True, default="")
    version_number = models.IntegerField(null=True, blank=True)

    # Resultado do processamento
    http_status = models.IntegerField(null=True, blank=True)
    parsed_ok = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")
    error_type = models.CharField(max_length=60, blank=True, default="")

    # Payload bruto + hash de deduplicação
    raw_payload = models.JSONField(null=True, blank=True)
    raw_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Vínculos com objetos criados
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_attempts",
    )
    version_created = models.ForeignKey(
        "service_orders.ServiceOrderVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_attempts",
    )
    duplicate_of = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="duplicates",
    )

    # Auditoria
    created_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)
    created_by = models.CharField(max_length=120, blank=True, default="Sistema")
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["source", "-created_at"], name="ia_source_created_idx"),
            models.Index(
                fields=["casualty_number", "budget_number", "-created_at"],
                name="ia_casualty_budget_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.source} {self.casualty_number}/{self.budget_number}"
            f" v{self.version_number or '?'} @ {self.created_at:%Y-%m-%d %H:%M}"
        )
```

`backend/core/apps/imports/admin.py`:
```python
from django.contrib import admin
from .models import ImportAttempt

admin.site.register(ImportAttempt)
```

- [ ] **Step 2: Write migration**

`backend/core/apps/imports/migrations/0001_initial.py`:
```python
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("service_orders", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True)),
                ("source", models.CharField(choices=[("cilia", "Cilia API"), ("hdi", "HDI HTML"), ("xml_porto", "XML Porto"), ("xml_azul", "XML Azul"), ("xml_itau", "XML Itaú")], db_index=True, max_length=20)),
                ("trigger", models.CharField(choices=[("polling", "Polling Automático"), ("upload_manual", "Upload Manual"), ("user_requested", "Solicitado pelo Usuário")], max_length=30)),
                ("casualty_number", models.CharField(blank=True, db_index=True, default="", max_length=40)),
                ("budget_number", models.CharField(blank=True, default="", max_length=40)),
                ("version_number", models.IntegerField(blank=True, null=True)),
                ("http_status", models.IntegerField(blank=True, null=True)),
                ("parsed_ok", models.BooleanField(default=False)),
                ("error_message", models.TextField(blank=True, default="")),
                ("error_type", models.CharField(blank=True, default="", max_length=60)),
                ("raw_payload", models.JSONField(blank=True, null=True)),
                ("raw_hash", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("service_order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="import_attempts", to="service_orders.serviceorder")),
                ("version_created", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="import_attempts", to="service_orders.serviceorderversion")),
                ("duplicate_of", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="duplicates", to="imports.importattempt")),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now, editable=False)),
                ("created_by", models.CharField(blank=True, default="Sistema", max_length=120)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="importattempt",
            index=models.Index(fields=["source", "-created_at"], name="ia_source_created_idx"),
        ),
        migrations.AddIndex(
            model_name="importattempt",
            index=models.Index(fields=["casualty_number", "budget_number", "-created_at"], name="ia_casualty_budget_idx"),
        ),
    ]
```

- [ ] **Step 3: Add to TENANT_APPS and migrate**

In `backend/core/config/settings/base.py`, add to `TENANT_APPS`:
```python
"apps.imports",
```

```bash
cd backend/core && .venv/bin/python manage.py migrate_schemas --schema=tenant_dscar --settings=config.settings.dev
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/imports/
git commit -m "feat(imports): ImportAttempt model + migration 0001"
```

---

### Task 2: `ImportService` + Tests

**Files:**
- Create: `backend/core/apps/imports/services.py`
- Create: `backend/core/apps/imports/tests/__init__.py`
- Create: `backend/core/apps/imports/tests/test_services.py`

IMPORTANT: `ImportService` imports from `apps.cilia.*` — NOT from internal `sources/` directory (does not exist in this app). Uses:
- `from apps.cilia.client import CiliaClient, CiliaError`
- `from apps.cilia.sources.cilia_parser import CiliaParser`
- `from apps.cilia.sources.xml_ifx_parser import XmlIfxParser`
- `from apps.cilia.dtos import ParsedBudget`

- [ ] **Step 1: Write failing tests**

`backend/core/apps/imports/tests/test_services.py`:
```python
"""Testes para ImportService."""
from unittest.mock import MagicMock, patch

from django_tenants.test.cases import TenantTestCase

from apps.imports.models import ImportAttempt
from apps.imports.services import ImportService
from apps.insurers.models import Insurer
from apps.persons.models import Person


class FetchCiliaBudgetTest(TenantTestCase):

    def _make_insurer(self) -> Insurer:
        # Insurer é SHARED_APP — cria no schema público
        return Insurer.objects.using("default").create(
            name="Tokio Marine",
            trade_name="Tokio",
            code="tokio",
        ) if not Insurer.objects.using("default").filter(code="tokio").exists() else Insurer.objects.using("default").get(code="tokio")

    def test_fetch_creates_attempt_with_parsed_ok_true(self) -> None:
        insurer = self._make_insurer()
        mock_parsed = MagicMock()
        mock_parsed.raw_hash = "abc123"
        mock_parsed.casualty_number = "SIN-001"
        mock_parsed.external_budget_number = "ORC-001"
        mock_parsed.insurer_code = "tokio"
        mock_parsed.external_version_id = None
        mock_parsed.segurado_name = "José"
        mock_parsed.segurado_phone = ""
        mock_parsed.vehicle_plate = "TST0001"
        mock_parsed.vehicle_description = "Honda Civic"
        mock_parsed.franchise_amount = 0
        mock_parsed.items = []
        mock_parsed.pareceres = []
        mock_parsed.raw_payload = {}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.data = {"dummy": True}
        mock_response.duration_ms = 100

        with patch("apps.imports.services.CiliaClient") as MockClient, \
             patch("apps.imports.services.CiliaParser") as MockParser, \
             patch("apps.imports.services.ServiceOrderService") as MockSOS:
            MockClient.return_value.get_budget.return_value = mock_response
            MockParser.parse.return_value = mock_parsed
            MockSOS.create_new_version_from_import.return_value = MagicMock()

            attempt = ImportService.fetch_cilia_budget(
                casualty_number="SIN-001",
                budget_number="ORC-001",
                version_number=1,
            )

        assert attempt.parsed_ok is True

    def test_network_error_creates_attempt_with_parsed_ok_false(self) -> None:
        from apps.cilia.client import CiliaError
        with patch("apps.imports.services.CiliaClient") as MockClient:
            MockClient.return_value.get_budget.side_effect = CiliaError("timeout")
            attempt = ImportService.fetch_cilia_budget(
                casualty_number="SIN-002",
                budget_number="ORC-002",
            )
        assert attempt.parsed_ok is False
        assert attempt.error_type == "NetworkError"
        assert "timeout" in attempt.error_message

    def test_duplicate_hash_sets_duplicate_of(self) -> None:
        # Cria tentativa original
        original = ImportAttempt.objects.create(
            source="cilia", trigger="user_requested",
            parsed_ok=True, raw_hash="duphash123",
        )

        mock_parsed = MagicMock()
        mock_parsed.raw_hash = "duphash123"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.data = {}
        mock_response.duration_ms = 50

        with patch("apps.imports.services.CiliaClient") as MockClient, \
             patch("apps.imports.services.CiliaParser") as MockParser:
            MockClient.return_value.get_budget.return_value = mock_response
            MockParser.parse.return_value = mock_parsed
            attempt = ImportService.fetch_cilia_budget(
                casualty_number="SIN-003",
                budget_number="ORC-003",
            )

        assert attempt.duplicate_of_id == original.pk
        assert attempt.parsed_ok is False
        assert attempt.error_type == "Duplicate"

    def test_os_without_casualty_number_skipped_by_poll_task(self) -> None:
        from apps.imports.tasks import poll_cilia_budget
        from apps.service_orders.models import ServiceOrder
        os_instance = ServiceOrder.objects.create(
            number=5001, customer_name="Sem Sinistro", plate="TST0002",
        )
        # casualty_number vazio → task deve retornar sem chamar CiliaClient
        with patch("apps.imports.tasks.CiliaClient") as MockClient:
            poll_cilia_budget(service_order_id=os_instance.pk)
        MockClient.assert_not_called()
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/imports/tests/test_services.py -v
```

Expected: ImportError (services.py doesn't exist).

- [ ] **Step 3: Write ImportService**

`backend/core/apps/imports/services.py`:
```python
"""ImportService: orquestra o pipeline Cília API + XML IFX.

Reutiliza sem duplicar:
- apps.cilia.client.CiliaClient + CiliaError
- apps.cilia.sources.cilia_parser.CiliaParser
- apps.cilia.sources.xml_ifx_parser.XmlIfxParser
- apps.service_orders.services.ServiceOrderService.create_new_version_from_import
"""
from __future__ import annotations

import hashlib
import logging
import time

from django.db import transaction

logger = logging.getLogger(__name__)


class ImportService:
    """Orquestra o pipeline: fetch/upload → parse → dedup → persist."""

    @classmethod
    def fetch_cilia_budget(
        cls,
        *,
        casualty_number: str,
        budget_number: int | str,
        version_number: int | None = None,
        trigger: str = "user_requested",
        created_by: str = "Sistema",
    ) -> "ImportAttempt":
        """Busca orçamento Cília e persiste como ServiceOrderVersion se novo.

        Returns:
            ImportAttempt (sempre, mesmo em erro). parsed_ok=True indica sucesso.
        """
        from apps.cilia.client import CiliaClient, CiliaError
        from apps.cilia.sources.cilia_parser import CiliaParser

        from .models import ImportAttempt

        client = CiliaClient()
        start = time.monotonic()

        try:
            response = client.get_budget(
                casualty_number=casualty_number,
                budget_number=budget_number,
                version_number=version_number,
            )
        except CiliaError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            return ImportAttempt.objects.create(
                source="cilia",
                trigger=trigger,
                created_by=created_by,
                casualty_number=casualty_number,
                budget_number=str(budget_number),
                version_number=version_number,
                parsed_ok=False,
                error_message=str(exc),
                error_type="NetworkError",
                duration_ms=duration_ms,
            )

        attempt = ImportAttempt.objects.create(
            source="cilia",
            trigger=trigger,
            created_by=created_by,
            casualty_number=casualty_number,
            budget_number=str(budget_number),
            version_number=version_number,
            http_status=response.status_code,
            duration_ms=response.duration_ms,
            raw_payload=response.data if response.status_code == 200 else None,
        )

        if response.status_code == 404:
            attempt.error_message = "Versão não encontrada"
            attempt.error_type = "NotFound"
            attempt.save(update_fields=["error_message", "error_type"])
            return attempt

        if response.status_code in (401, 403):
            attempt.error_message = str((response.data or {}).get("error", "Unauthorized"))
            attempt.error_type = "AuthError"
            attempt.save(update_fields=["error_message", "error_type"])
            return attempt

        if response.status_code != 200:
            attempt.error_message = f"HTTP {response.status_code}"
            attempt.error_type = f"HTTP{response.status_code}"
            attempt.save(update_fields=["error_message", "error_type"])
            return attempt

        # Parse
        try:
            parsed = CiliaParser.parse(response.data)
        except Exception as exc:
            logger.exception("Cilia parse error")
            attempt.error_message = f"Parse error: {exc}"
            attempt.error_type = "ParseError"
            attempt.save(update_fields=["error_message", "error_type"])
            return attempt

        attempt.raw_hash = parsed.raw_hash
        attempt.save(update_fields=["raw_hash"])

        # Dedup
        previous_ok = (
            ImportAttempt.objects.filter(source="cilia", parsed_ok=True, raw_hash=parsed.raw_hash)
            .exclude(pk=attempt.pk)
            .first()
        )
        if previous_ok:
            attempt.duplicate_of = previous_ok
            attempt.parsed_ok = False
            attempt.error_message = "Payload idêntico já processado"
            attempt.error_type = "Duplicate"
            attempt.save(update_fields=["duplicate_of", "parsed_ok", "error_message", "error_type"])
            return attempt

        # Persist
        try:
            os_instance, version = cls._persist_budget(parsed=parsed, attempt=attempt)
        except Exception as exc:
            logger.exception("Cilia persist error")
            attempt.error_message = f"Persist error: {exc}"
            attempt.error_type = "PersistError"
            attempt.save(update_fields=["error_message", "error_type"])
            return attempt

        attempt.service_order = os_instance
        attempt.version_created = version
        attempt.parsed_ok = True
        attempt.save(update_fields=["service_order", "version_created", "parsed_ok"])
        return attempt

    @classmethod
    def import_xml_ifx(
        cls,
        *,
        xml_bytes: bytes,
        insurer_code: str,
        trigger: str = "upload_manual",
        created_by: str = "Sistema",
    ) -> "ImportAttempt":
        """Importa orçamento via upload XML IFX (Porto/Azul/Itaú).

        Returns:
            ImportAttempt (sempre, mesmo em erro).
        """
        from apps.cilia.sources.xml_ifx_parser import XmlIfxParser

        from .models import ImportAttempt

        source_map = {"porto": "xml_porto", "azul": "xml_azul", "itau": "xml_itau"}
        source = source_map.get(insurer_code.lower(), "xml_porto")
        raw_hash = hashlib.sha256(xml_bytes).hexdigest() if xml_bytes else ""

        attempt = ImportAttempt.objects.create(
            source=source,
            trigger=trigger,
            created_by=created_by,
            raw_hash=raw_hash,
        )

        try:
            parsed = XmlIfxParser.parse(xml_bytes, insurer_code=insurer_code)
        except Exception as exc:
            logger.exception("XML IFX parse error")
            attempt.error_message = f"Parse error: {exc}"
            attempt.error_type = "ParseError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.casualty_number = parsed.casualty_number
        attempt.budget_number = parsed.external_budget_number
        attempt.raw_payload = parsed.raw_payload
        attempt.raw_hash = parsed.raw_hash
        attempt.save(update_fields=["casualty_number", "budget_number", "raw_payload", "raw_hash"])

        # Dedup
        previous_ok = (
            ImportAttempt.objects.filter(parsed_ok=True, raw_hash=parsed.raw_hash)
            .exclude(pk=attempt.pk)
            .first()
        )
        if previous_ok:
            attempt.duplicate_of = previous_ok
            attempt.parsed_ok = False
            attempt.error_message = "Payload idêntico já processado"
            attempt.error_type = "Duplicate"
            attempt.save(update_fields=["duplicate_of", "parsed_ok", "error_message", "error_type"])
            return attempt

        try:
            os_instance, version = cls._persist_budget(parsed=parsed, attempt=attempt)
        except Exception as exc:
            logger.exception("XML IFX persist error")
            attempt.error_message = f"Persist error: {exc}"
            attempt.error_type = "PersistError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.service_order = os_instance
        attempt.version_created = version
        attempt.parsed_ok = True
        attempt.save(update_fields=["service_order", "version_created", "parsed_ok"])
        return attempt

    @classmethod
    @transaction.atomic
    def _persist_budget(cls, *, parsed: "ParsedBudget", attempt: "ImportAttempt") -> tuple:
        """Encontra/cria OS + version via ServiceOrderService."""
        from apps.insurers.models import Insurer
        from apps.items.services import NumberAllocator
        from apps.persons.models import Person
        from apps.service_orders.models import ServiceOrder
        from apps.service_orders.services import ServiceOrderService

        insurer = Insurer.objects.filter(code=parsed.insurer_code).first()
        if insurer is None:
            raise ValueError(
                f"Insurer '{parsed.insurer_code}' não existe. Seed a seguradora primeiro."
            )

        os_instance = ServiceOrder.objects.filter(
            insurer=insurer, casualty_number=parsed.casualty_number,
        ).first()

        if os_instance is None:
            customer = Person.objects.create(
                full_name=parsed.segurado_name or "Cliente Importado",
                person_type="CLIENT",
                phone=parsed.segurado_phone or "",
            )
            next_number = ServiceOrderService.get_next_number()
            os_instance = ServiceOrder.objects.create(
                number=next_number,
                customer_name=customer.full_name,
                customer_type="insurer",
                insurer=insurer,
                casualty_number=parsed.casualty_number,
                plate=parsed.vehicle_plate,
                status="reception",
            )

        if parsed.external_version_id:
            existing = os_instance.versions.filter(
                external_version_id=parsed.external_version_id,
            ).first()
            if existing:
                return os_instance, existing

        version = ServiceOrderService.create_new_version_from_import(
            service_order=os_instance,
            parsed_budget=parsed,
            import_attempt=attempt,
        )
        return os_instance, version
```

- [ ] **Step 4: Write Celery tasks**

`backend/core/apps/imports/tasks.py`:
```python
"""Celery tasks para polling automático Cília."""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def poll_cilia_budget(service_order_id: int) -> None:
    """Busca próxima versão disponível da OS no Cília.

    Pula se:
    - OS não tem casualty_number
    - OS está fechada (delivered/cancelled)
    - Versão ativa em status terminal (autorizado/negado)
    """
    from apps.service_orders.models import ServiceOrder

    try:
        os_instance = ServiceOrder.objects.get(pk=service_order_id, is_active=True)
    except ServiceOrder.DoesNotExist:
        logger.warning("poll_cilia_budget: OS %d não encontrada", service_order_id)
        return

    if not os_instance.casualty_number:
        logger.debug("poll_cilia_budget: OS %d sem casualty_number — pulando", service_order_id)
        return

    if os_instance.status in ("delivered", "cancelled"):
        logger.debug("poll_cilia_budget: OS %d fechada (%s) — pulando", service_order_id, os_instance.status)
        return

    active_version = os_instance.versions.order_by("-version_number").first()
    if active_version and active_version.status in ("autorizado", "negado"):
        logger.debug("poll_cilia_budget: OS %d versão em status terminal — pulando", service_order_id)
        return

    next_version = (active_version.version_number + 1) if active_version else 1

    from apps.imports.services import ImportService

    ImportService.fetch_cilia_budget(
        casualty_number=os_instance.casualty_number,
        budget_number=os_instance.external_budget_number or "",
        version_number=next_version,
        trigger="polling",
    )


@shared_task
def sync_active_cilia_os() -> None:
    """Encontra todas OS elegíveis e dispara poll_cilia_budget para cada uma.

    Elegível: customer_type=insurer, com casualty_number, não fechada, insurer com uses_cilia=True.
    """
    from apps.service_orders.models import ServiceOrder

    qs = ServiceOrder.objects.filter(
        is_active=True,
        customer_type="insurer",
        insurer__uses_cilia=True,
    ).exclude(
        casualty_number="",
    ).exclude(
        status__in=["delivered", "cancelled"],
    ).values_list("pk", flat=True)

    for os_id in qs:
        poll_cilia_budget.delay(os_id)

    logger.info("sync_active_cilia_os: disparou poll para %d OS", len(qs))
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
cd backend/core && .venv/bin/pytest apps/imports/tests/test_services.py -v
```

Expected: All tests pass (mocks isolam chamadas externas).

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/imports/services.py backend/core/apps/imports/tasks.py backend/core/apps/imports/tests/
git commit -m "feat(imports): ImportService + tasks + tests"
```

---

### Task 3: API Endpoints + Registration

**Files:**
- Create: `backend/core/apps/imports/serializers.py`
- Create: `backend/core/apps/imports/views.py`
- Create: `backend/core/apps/imports/urls.py`
- Create: `backend/core/apps/imports/tests/test_api.py`
- Modify: `backend/core/config/urls.py`

- [ ] **Step 1: Write failing API tests**

`backend/core/apps/imports/tests/test_api.py`:
```python
"""API tests para imports endpoints."""
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.imports.models import ImportAttempt


class ImportAPITest(TenantTestCase):

    def setUp(self) -> None:
        super().setUp()
        self.user = GlobalUser.objects.create_user(email="imp@x.com", password="pw")
        self.client = APIClient()
        self.client.defaults["HTTP_X_TENANT_DOMAIN"] = self.domain.domain
        self.client.force_authenticate(user=self.user, token={"role": "MANAGER"})

    def test_list_attempts_returns_200(self) -> None:
        ImportAttempt.objects.create(source="cilia", trigger="polling")
        resp = self.client.get("/api/v1/imports/attempts/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1

    def test_list_attempts_as_consultant(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.get("/api/v1/imports/attempts/")
        assert resp.status_code == 200

    def test_filter_attempts_by_source(self) -> None:
        ImportAttempt.objects.create(source="cilia", trigger="polling")
        ImportAttempt.objects.create(source="xml_porto", trigger="upload_manual")
        resp = self.client.get("/api/v1/imports/attempts/?source=cilia")
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 1
        assert resp.data["results"][0]["source"] == "cilia"

    def test_fetch_cilia_as_consultant_forbidden(self) -> None:
        self.client.force_authenticate(user=self.user, token={"role": "CONSULTANT"})
        resp = self.client.post(
            "/api/v1/imports/attempts/cilia/fetch/",
            {"casualty_number": "SIN-001", "budget_number": "ORC-001"},
            format="json",
        )
        assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
cd backend/core && .venv/bin/pytest apps/imports/tests/test_api.py -v
```

Expected: 404 (routes not registered).

- [ ] **Step 3: Write serializers**

`backend/core/apps/imports/serializers.py`:
```python
from rest_framework import serializers

from .models import ImportAttempt


class ImportAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportAttempt
        fields = [
            "id", "source", "trigger", "casualty_number", "budget_number",
            "version_number", "http_status", "parsed_ok", "error_message",
            "error_type", "raw_hash", "service_order", "version_created",
            "duplicate_of", "created_at", "created_by", "duration_ms",
        ]
        read_only_fields = fields
```

- [ ] **Step 4: Write views**

`backend/core/apps/imports/views.py`:
```python
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove

from .models import ImportAttempt
from .serializers import ImportAttemptSerializer
from .services import ImportService

logger = logging.getLogger(__name__)


class ImportAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista tentativas de importação com filtros."""

    serializer_class = ImportAttemptSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_queryset(self):  # type: ignore[override]
        qs = ImportAttempt.objects.select_related("service_order", "version_created").all()
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs

    @action(detail=False, methods=["post"], url_path="cilia/fetch",
            permission_classes=[IsAuthenticated, IsManagerOrAbove])
    def fetch_cilia(self, request: Request) -> Response:
        """POST /imports/attempts/cilia/fetch/ — busca manual no Cília."""
        casualty = request.data.get("casualty_number", "").strip()
        budget = request.data.get("budget_number", "").strip()
        version = request.data.get("version_number")
        if not casualty or not budget:
            return Response({"detail": "casualty_number e budget_number são obrigatórios."}, status=400)
        attempt = ImportService.fetch_cilia_budget(
            casualty_number=casualty,
            budget_number=budget,
            version_number=int(version) if version else None,
            trigger="user_requested",
            created_by=str(request.user),
        )
        return Response(ImportAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="xml/upload",
            permission_classes=[IsAuthenticated, IsManagerOrAbove])
    def upload_xml(self, request: Request) -> Response:
        """POST /imports/attempts/xml/upload/ — upload XML multipart."""
        file_obj = request.FILES.get("file")
        insurer_code = request.data.get("insurer_code", "").strip()
        if not file_obj or not insurer_code:
            return Response({"detail": "file e insurer_code são obrigatórios."}, status=400)
        xml_bytes = file_obj.read()
        attempt = ImportService.import_xml_ifx(
            xml_bytes=xml_bytes,
            insurer_code=insurer_code,
            trigger="upload_manual",
            created_by=str(request.user),
        )
        return Response(ImportAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 5: Write URLs**

`backend/core/apps/imports/urls.py`:
```python
from rest_framework.routers import SimpleRouter

from .views import ImportAttemptViewSet

router = SimpleRouter()
router.register(r"attempts", ImportAttemptViewSet, basename="import-attempt")

urlpatterns = router.urls
```

- [ ] **Step 6: Register in config/urls.py**

Add to `backend/core/config/urls.py`:
```python
path("api/v1/imports/", include("apps.imports.urls")),
```

- [ ] **Step 7: Run all imports tests**

```bash
cd backend/core && .venv/bin/pytest apps/imports/tests/ -v
```

Expected: All tests pass.

- [ ] **Step 8: Run full suite**

```bash
cd backend/core && .venv/bin/pytest --tb=short -q
```

Expected: No regressions.

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/imports/ backend/core/config/urls.py backend/core/config/settings/base.py
git commit -m "feat(imports): API endpoints + Celery tasks + registration — app completo"
```
