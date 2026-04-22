# Ciclo 04 — Importador Cilia (real) · Módulo de Orçamentação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Integrar a API de Integração da Cilia (produção) ao módulo de orçamentação. Entregar:

1. **Polling incremental** de versões (v+1) por OS ativa, com parada em 404/status terminal
2. **Histórico de atualizações** (eventos `IMPORT_RECEIVED` + pareceres estruturados de `conclusion`)
3. **Snapshot imutável** por versão: `ServiceOrderVersion.raw_payload` + PDF/HTML oficiais da Cilia + content_hash

**Architecture:** App `imports` com `ImportAttempt` + `CiliaClient` (httpx) + `CiliaImporter` (parser DTO→service). Celery task `poll_cilia_budget(service_order_id)` roda a cada 15 min pra OSes que ainda não terminaram. Mapeia payload Cilia → `ParsedBudget` DTO → `ServiceOrderService.create_new_version_from_import()` (já existe no Ciclo 02).

**Tech Stack:** Python 3.12, Django 5, httpx, Celery 5, pytest-django, respx (mock httpx).

**Referência viva:**
- `/Users/thiagocampos/Documents/Projetos/intergracao_api_cilia/` — código Node funcional, docs, poller
- `backend/core/apps/imports/tests/fixtures/cilia_1446508_v1.json` e `_v2.json` — payloads reais capturados
- Docs Cilia em `intergracao_api_cilia/docs/API-COMPLETA-CILIA.md` e `ERP-INTEGRACAO.md`

**Dependências:** Ciclos 01-03 merged (174 PASS).

**Out of scope** (ciclos futuros):
- HDI HTML importer (precisa amostra real do usuário)
- XML IFX Porto/Azul/Itaú (Ciclo 04B separado)
- Upload de fotos pra S3 próprio (Cilia já entrega CDN URLs; upload fica no Ciclo 05)
- Reconciliação de peças com catálogo interno de Parts (Ciclo 07+)

---

## Factos da API Cilia (validados ao vivo — 2026-04-21)

### Auth
- Token fixo em query string: `?auth_token=<TOKEN>` (não expira, não precisa refresh, não usa cookies)
- Base URL: `https://sistema.cilia.com.br` (prod) ou `https://qa.cilia.com.br` (homolog)

### Endpoint principal
```
GET /api/integration/insurer_budgets/by_casualty_number_and_budget_number
    ?auth_token=...
    &casualty_number=<str>       # ex: "406571903"
    &budget_number=<int>          # ex: 1446508
    &version_number=<int?>        # opcional; default: versão atual
```

**Respostas observadas** (testadas com `casualty=406571903, budget=1446508`):
| version | HTTP | Key | Significado |
|---|---|---|---|
| `1` | 200 | `conclusion.key=not_authorized`, `budget_version_name=initial`, `flow=1` | Versão inicial, negada |
| `2` | 200 | `conclusion.key=authorized`, `budget_version_name=complement`, `flow=2` | Complemento, autorizada |
| `3` (inexistente) | **404** `{"error":"Versão do orçamento não encontrada."}` | Parada do polling |

### Endpoint de listagem
```
GET /api/integration/budgets/list_budgets
    ?auth_token=...
    &budget_type=InsurerBudget
    &status_ids=analyzed
    &date_type=finalized
    &date_range[start_date]=YYYY-MM-DD
    &date_range[end_date]=YYYY-MM-DD
    &page=1&per_page=25
```

**Status values**: `created, analyzing, with_expert, budgeting, ready_for_analysis, with_analyst, analyzed, distributed, done`
**Status terminais** (param parar polling): `refused, finalized` (conforme `cilia-poller.js`)

### Schema do payload (campos-chave)

```
{
  "budget_version_id": 30629056,         # UUID int único por versão
  "budget_id": 17732641,                 # UUID int do orçamento-pai
  "casualty_number": "406571903",
  "budget_number": 1446508,
  "version_number": 2,
  "budget_version_name": "initial" | "complement",
  "license_plate": "TAF8E63",
  "status": "analyzed" | ...,            # 9 status possíveis
  "budget_webservice_creation_date": ISO8601,
  "budget_version_creation_date": ISO8601,

  "report_html": "<base64 ~900KB>",      # laudo HTML completo
  "report_pdf": "<base64 ~90KB>",        # PDF idem

  "insurer": { document_identifier, trade, avatar_thumb_url, address{...}, phone{...} },
  "client":  { name, email, document_identifier, address{...}, phone{...} },
  "vehicle": { vehicle_id, license_plate, body (chassi), color, paint_type, mileage,
               model, model_year, brand, type_name, type_key },

  "budgetings": [                         # array de itens
    {
      "id": 323570387,
      "code": "A90788512009K83",          # código da peça (quando peça)
      "name": "PARACHOQUE TRAS",
      "type": "BudgetingPiece" | "BudgetingManualService" | "BudgetingVehicleMaintenance",
      "budgeting_type": "impact" | "without_coverage" | "estimated",
      "quantity": 1,
      "selling_cost": 5586.93,
      "piece_selling_cost_final": 5586.93,
      "piece_discount": 0,
      "piece_discount_percentage": 0,
      "vehicle_piece_type": "genuine" | "original" | "other_sources" | "green",
      "supplier_type": "workshop" | "insurer",  # quem fornece
      "impact_area": 1,
      # Horas granulares:
      "remove_install_used": bool,
      "remove_install_hours": 1.0,
      "paint_used": bool,
      "paint_hours": 0.0,
      "repair_used": bool,
      "repair_hours": 0.0,
      "exchange_used": bool,
      # Categoria MO (mapeia → labor_category):
      "remove_install_type": "tapestry" | "mechanic" | "auto_body" | "electrical" | "glazing",
      "vehicle_part_region_name": "parachoque tras - lanternas:",
      "inclusion_manual": bool,
      "selling_cost_changed": bool
    },
    ...
  ],

  "standard_labor": {                      # tabela MO do orçamento
    "repair_cost": 53.0,
    "paint_cost": 65.0,
    "paint_tricoat_cost": 65.0,
    "workforce_cost": 48.0,
    "increase": 0.0,
    "discount": 0.0
  },

  "totals": {                              # 32 campos agregados
    "total_liquid": 3339.85,
    "franchise": 0.0,
    "total_pieces_cost": ...,
    "total_impact_pieces_cost": ...,
    "total_without_coverage_pieces_cost": ...,
    "total_estimated_pieces_cost": ...,
    "total_workforce_cost": 196.0,
    "total_impact_workforce_cost": ...,
    "total_workforce_expense": 100.0,
    "total_piece_discount": ...,
    "total_workforce_discount": ...,
    # Horas por categoria:
    "total_paint_hours": 0.0,
    "total_repair_hours": 0.0,
    "total_remove_install_hours": 2.0,
    "total_auto_body_hours": 0.0,
    "total_glazing_hours": 0.0,
    "total_tapestry_hours": 2.0,
    "total_electrical_hours": 0.0,
    "total_mechanical_hours": 0.0,
    "total_manual_service_hours": 2.08,
    "total_hours": 4.08
  },

  "conclusion": {                          # parecer atual (virá pra ServiceOrderParecer)
    "id": 70436415,
    "author_name": "Webservice ",
    "author_document_identifier": "33164021000100",
    "created_at": "2026-03-31T08:38:52-03:00",
    "conclusion_type_title": "Reparo Autorizado",
    "description": "Parecer gerado via integração: 301 - REPARO AUTORIZADO",
    "key": "authorized" | "not_authorized" | "pending" | "supplement" | "refused",
    "flow_number": 2,
    "privacy_configuration": "external"
  },

  "albums": [                              # 3 álbuns de fotos
    { "id": 53971123, "album_type": null, "images": [ { url, original_filename, ... } ] },
    ...
  ]
}
```

---

## Chunks planejados

| # | Escopo | Target |
|---|---|---|
| **1** | App `imports` + `ImportAttempt` model + migrations + admin | 5 tests |
| **2** | `CiliaClient` httpx + tests com respx | 10 tests |
| **3** | `CiliaParser` (payload → ParsedBudget DTO) + tests com fixtures reais | 15 tests |
| **4** | `ImportService.import_from_cilia()` + integração com `ServiceOrderService.create_new_version_from_import` + snapshot fields | 12 tests |
| **5** | Celery task `poll_cilia_budget` + beat schedule + `sync_active_cilia_os` | 8 tests |
| **6** | API endpoints + Frontend `CiliaImporter` + smoke | 10 tests |

**Target final**: 174 + ~60 = **~234 PASS**.

---

## Task 1: App `imports` + `ImportAttempt`

**Files:**
- Create: `backend/core/apps/imports/` (app completo)
- Modify: `backend/core/config/settings.py` (registrar app)
- Modify: `backend/core/apps/service_orders/models.py` (+ `raw_payload`, `report_pdf_base64`, `report_html_base64` em `ServiceOrderVersion`)

- [ ] **Step 1.1: Estrutura do app**

```bash
mkdir -p backend/core/apps/imports/{tests/fixtures,migrations,sources}
touch backend/core/apps/imports/__init__.py
touch backend/core/apps/imports/tests/__init__.py
touch backend/core/apps/imports/migrations/__init__.py
touch backend/core/apps/imports/sources/__init__.py
```

Fixtures já estão em `backend/core/apps/imports/tests/fixtures/`:
- `cilia_1446508_v1.json` (1MB — resposta real v1)
- `cilia_1446508_v2.json` (1MB — resposta real v2)
- `cilia_404.json` (50B — resposta 404)

- [ ] **Step 1.2: AppConfig**

```python
# apps/imports/apps.py
from django.apps import AppConfig

class ImportsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.imports"
    verbose_name = "Importações de Seguradoras"
```

Adicionar `"apps.imports"` em `INSTALLED_APPS`.

- [ ] **Step 1.3: Model `ImportAttempt`**

```python
# apps/imports/models.py
from django.db import models
from django.utils import timezone


class ImportAttempt(models.Model):
    """Tentativa de importação — auditoria completa.

    Cada chamada à API/upload de arquivo gera um ImportAttempt, sucesso ou falha.
    Usado pra debug, rate limiting e histórico.
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

    # Input que motivou a tentativa
    casualty_number = models.CharField(max_length=40, blank=True, default="", db_index=True)
    budget_number = models.CharField(max_length=40, blank=True, default="")
    version_number = models.IntegerField(null=True, blank=True)

    # Resultado
    http_status = models.IntegerField(null=True, blank=True)
    parsed_ok = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")
    error_type = models.CharField(max_length=60, blank=True, default="")

    # Payload bruto — Ciclo 5 move pra S3; Ciclo 4 salva no banco mesmo (tamanho ok)
    raw_payload = models.JSONField(null=True, blank=True)
    raw_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Vínculo com objetos criados/atualizados
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.SET_NULL, null=True, blank=True, related_name="import_attempts",
    )
    version_created = models.ForeignKey(
        "service_orders.ServiceOrderVersion",
        on_delete=models.SET_NULL, null=True, blank=True, related_name="import_attempts",
    )
    duplicate_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="duplicates",
    )

    # Auditoria
    created_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)
    created_by = models.CharField(max_length=120, blank=True, default="Sistema")

    # Timing
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
        return f"{self.source} {self.casualty_number}/{self.budget_number} v{self.version_number or '?'} @ {self.created_at:%Y-%m-%d %H:%M}"
```

- [ ] **Step 1.4: Evoluir `ServiceOrderVersion` com snapshot completo**

Em `apps/service_orders/models.py`, adicionar campos ao `ServiceOrderVersion`:

```python
class ServiceOrderVersion(models.Model):
    # ... campos existentes ...

    # NOVO — snapshot completo da importação (preservar payload da fonte original)
    raw_payload = models.JSONField(
        null=True, blank=True,
        help_text="Payload bruto da fonte (Cilia JSON, XML parseado, etc) — preserva dados não-mapeados",
    )

    # NOVO — PDF/HTML oficiais da Cilia (base64 por ora; Ciclo 5 move pra S3)
    report_pdf_base64 = models.TextField(blank=True, default="")
    report_html_base64 = models.TextField(blank=True, default="")

    # NOVO — IDs externos específicos Cilia pra deduplicação
    external_budget_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    external_version_id = models.BigIntegerField(null=True, blank=True, db_index=True, unique=False)
    external_flow_number = models.IntegerField(null=True, blank=True)

    # ... resto igual ...
```

- [ ] **Step 1.5: Migration schema**

```bash
cd backend/core
python manage.py makemigrations imports --name add_import_attempt
python manage.py makemigrations service_orders --name add_snapshot_fields
```

- [ ] **Step 1.6: Tests do ImportAttempt**

Criar `backend/core/apps/imports/tests/test_models.py`:

```python
import pytest

from apps.imports.models import ImportAttempt


@pytest.mark.django_db
class TestImportAttempt:

    def test_create_minimal(self):
        a = ImportAttempt.objects.create(source="cilia", trigger="polling")
        assert a.source == "cilia"
        assert a.parsed_ok is False
        assert a.http_status is None

    def test_create_full(self):
        a = ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="406571903", budget_number="1446508", version_number=2,
            http_status=200, parsed_ok=True,
            raw_hash="abc123",
        )
        assert a.casualty_number == "406571903"
        assert a.version_number == 2

    def test_str_representation(self):
        a = ImportAttempt.objects.create(
            source="cilia", trigger="polling",
            casualty_number="406571903", budget_number="1446508", version_number=2,
        )
        assert "cilia" in str(a)
        assert "406571903" in str(a)
        assert "v2" in str(a)

    def test_ordering_desc_by_created_at(self):
        a1 = ImportAttempt.objects.create(source="cilia", trigger="polling")
        a2 = ImportAttempt.objects.create(source="cilia", trigger="polling")
        attempts = list(ImportAttempt.objects.all())
        assert attempts[0].pk == a2.pk
        assert attempts[1].pk == a1.pk

    def test_duplicate_of_self_ref(self):
        original = ImportAttempt.objects.create(
            source="cilia", trigger="polling", parsed_ok=True, raw_hash="xyz",
        )
        dup = ImportAttempt.objects.create(
            source="cilia", trigger="polling", raw_hash="xyz",
            duplicate_of=original,
        )
        assert dup.duplicate_of == original
        assert original.duplicates.count() == 1
```

- [ ] **Step 1.7: Tests dos campos snapshot em ServiceOrderVersion**

Append em `apps/service_orders/tests/test_service_order_models.py`:

```python
@pytest.mark.django_db
class TestSnapshotFields:

    def test_raw_payload_stores_json(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-SNAP-1", customer=person,
            vehicle_plate="SNP1234", vehicle_description="Test",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1,
            raw_payload={"source": "cilia", "budget_id": 17732641, "items": [1, 2, 3]},
            external_budget_id=17732641,
            external_version_id=30629056,
            external_flow_number=2,
        )
        assert v.raw_payload["budget_id"] == 17732641
        assert v.external_flow_number == 2

    def test_report_base64_fields(self, person):
        os = ServiceOrder.objects.create(
            os_number="OS-SNAP-2", customer=person,
            vehicle_plate="SNP5678", vehicle_description="Test",
        )
        v = ServiceOrderVersion.objects.create(
            service_order=os, version_number=1,
            report_pdf_base64="PDFCONTENT_BASE64",
            report_html_base64="<html>base64</html>",
        )
        assert v.report_pdf_base64 == "PDFCONTENT_BASE64"
```

- [ ] **Step 1.8: Admin registration**

```python
# apps/imports/admin.py
from django.contrib import admin
from .models import ImportAttempt


@admin.register(ImportAttempt)
class ImportAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "source", "casualty_number", "budget_number", "version_number",
        "http_status", "parsed_ok", "service_order", "created_at",
    )
    list_filter = ("source", "trigger", "parsed_ok", "http_status")
    search_fields = ("casualty_number", "budget_number")
    readonly_fields = (
        "source", "trigger", "casualty_number", "budget_number", "version_number",
        "http_status", "raw_hash", "raw_payload", "error_message", "error_type",
        "service_order", "version_created", "duplicate_of", "duration_ms",
        "created_at", "created_by",
    )
    date_hierarchy = "created_at"
```

- [ ] **Step 1.9: Rodar migrations e tests**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/ -v --tb=short
```

Expected: 174 + 5 (ImportAttempt) + 2 (snapshot fields) = **181 PASS**.

- [ ] **Step 1.10: Commit**

```bash
git add backend/core/
git commit -m "feat(imports): app imports + ImportAttempt model + snapshot fields em ServiceOrderVersion"
```

---

## Task 2: `CiliaClient` (Python httpx)

**Files:**
- Create: `backend/core/apps/imports/sources/cilia_client.py`
- Modify: `backend/core/requirements.txt` (+ respx)
- Create: `backend/core/apps/imports/tests/test_cilia_client.py`
- Modify: `backend/core/config/settings.py` (settings Cilia)

- [ ] **Step 2.1: Deps**

Em `requirements.txt`:
```
# Test stubbing de httpx
respx>=0.21,<1.0
```

- [ ] **Step 2.2: Settings Cilia**

Em `config/settings.py`, adicionar:

```python
# Cilia API
CILIA_BASE_URL = os.getenv("CILIA_BASE_URL", "https://sistema.cilia.com.br")
CILIA_AUTH_TOKEN = os.getenv("CILIA_AUTH_TOKEN", "")
CILIA_TIMEOUT_SECONDS = int(os.getenv("CILIA_TIMEOUT_SECONDS", "30"))
CILIA_POLLING_INTERVAL_MINUTES = int(os.getenv("CILIA_POLLING_INTERVAL_MINUTES", "15"))
```

- [ ] **Step 2.3: Criar `CiliaClient`**

Create `backend/core/apps/imports/sources/cilia_client.py`:

```python
"""Cliente HTTP para a API de Integração da Cilia.

Porta do cilia-client.js (Node) preservando interface e adicionando type hints.
Documentação: docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md + 
/intergracao_api_cilia/docs/API-COMPLETA-CILIA.md
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from django.conf import settings


logger = logging.getLogger(__name__)


class CiliaError(Exception):
    """Erro genérico da integração Cilia."""


class CiliaAuthError(CiliaError):
    """Token inválido ou ausente (HTTP 401)."""


class CiliaNotFoundError(CiliaError):
    """Orçamento/versão não encontrado (HTTP 404)."""


class CiliaForbiddenError(CiliaError):
    """Sem permissão ou orçamento de outra oficina (HTTP 403)."""


@dataclass
class CiliaResponse:
    """Resposta bruta com metadados de timing."""
    status_code: int
    data: dict[str, Any] | None
    duration_ms: int
    raw_text: str


class CiliaClient:
    """Cliente HTTP da API de Integração Cilia.

    Uso:
        client = CiliaClient()
        resp = client.get_budget(casualty_number="406571903", budget_number=1446508, version=2)
        if resp.status_code == 200:
            data = resp.data  # dict completo
    """

    def __init__(
        self,
        *,
        base_url: str | None = None,
        auth_token: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.CILIA_BASE_URL).rstrip("/")
        self.auth_token = auth_token or settings.CILIA_AUTH_TOKEN
        self.timeout = timeout or settings.CILIA_TIMEOUT_SECONDS

        if not self.auth_token:
            raise CiliaError(
                "CILIA_AUTH_TOKEN não configurado. Defina em .env ou no construtor.",
            )

    def _request(self, path: str, params: dict[str, Any]) -> CiliaResponse:
        """Faz request com auth_token. Retorna CiliaResponse mesmo em erros HTTP.

        Raises:
            CiliaError: apenas para erros de rede (não HTTP).
        """
        all_params = {"auth_token": self.auth_token, **params}
        url = f"{self.base_url}{path}"

        start = time.monotonic()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(
                    url,
                    params=all_params,
                    headers={
                        "accept": "application/json",
                        "User-Agent": "DSCAR-Paddock/1.0",
                    },
                )
        except httpx.RequestError as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.error("Cilia request failed: %s (duration=%dms)", exc, duration_ms)
            raise CiliaError(f"Network error: {exc}") from exc

        duration_ms = int((time.monotonic() - start) * 1000)
        raw_text = response.text

        try:
            data = response.json()
        except ValueError:
            data = None

        return CiliaResponse(
            status_code=response.status_code,
            data=data,
            duration_ms=duration_ms,
            raw_text=raw_text,
        )

    def get_budget(
        self,
        *,
        casualty_number: str,
        budget_number: int | str,
        version_number: int | None = None,
    ) -> CiliaResponse:
        """Busca orçamento específico.

        GET /api/integration/insurer_budgets/by_casualty_number_and_budget_number

        Args:
            casualty_number: número do sinistro (string).
            budget_number: número do orçamento (int).
            version_number: versão específica; se None, Cilia retorna a versão atual.

        Returns:
            CiliaResponse com status_code e data.
            - 200: sucesso — data contém payload completo
            - 404: versão não existe — data = {"error": "..."}
            - 401/403: auth errors
        """
        params: dict[str, Any] = {
            "casualty_number": casualty_number,
            "budget_number": budget_number,
        }
        if version_number is not None:
            params["version_number"] = version_number

        return self._request(
            "/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
            params,
        )

    def list_budgets(
        self,
        *,
        budget_type: str = "InsurerBudget",
        status_ids: str | None = None,
        date_type: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        page: int = 1,
        per_page: int = 25,
    ) -> CiliaResponse:
        """Lista orçamentos da oficina."""
        params: dict[str, Any] = {
            "budget_type": budget_type,
            "page": page,
            "per_page": per_page,
        }
        if status_ids:
            params["status_ids"] = status_ids
        if date_type:
            params["date_type"] = date_type
        if start_date:
            params["date_range[start_date]"] = start_date
        if end_date:
            params["date_range[end_date]"] = end_date

        return self._request("/api/integration/budgets/list_budgets", params)
```

- [ ] **Step 2.4: Tests com respx**

Create `backend/core/apps/imports/tests/test_cilia_client.py`:

```python
import json
from pathlib import Path

import pytest
import respx
from httpx import Response

from apps.imports.sources.cilia_client import (
    CiliaClient, CiliaError, CiliaResponse,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def client(settings):
    settings.CILIA_AUTH_TOKEN = "test-token-123"
    settings.CILIA_BASE_URL = "https://test.cilia.local"
    return CiliaClient()


class TestCiliaClientInit:

    def test_raises_if_no_token(self, settings):
        settings.CILIA_AUTH_TOKEN = ""
        with pytest.raises(CiliaError, match="CILIA_AUTH_TOKEN"):
            CiliaClient()

    def test_uses_settings_defaults(self, settings):
        settings.CILIA_AUTH_TOKEN = "abc"
        settings.CILIA_BASE_URL = "https://x.cilia.local"
        c = CiliaClient()
        assert c.auth_token == "abc"
        assert c.base_url == "https://x.cilia.local"

    def test_constructor_overrides(self, settings):
        settings.CILIA_AUTH_TOKEN = "from-settings"
        c = CiliaClient(auth_token="override", base_url="https://override.local")
        assert c.auth_token == "override"
        assert c.base_url == "https://override.local"


class TestGetBudget:

    @respx.mock
    def test_success_v2(self, client):
        payload = _load_fixture("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=payload))

        resp = client.get_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
        )
        assert resp.status_code == 200
        assert resp.data["budget_version_id"] == 30629056
        assert resp.data["version_number"] == 2
        assert resp.data["conclusion"]["key"] == "authorized"

    @respx.mock
    def test_404_version_not_found(self, client):
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(404, json={"error": "Versão do orçamento não encontrada."}))

        resp = client.get_budget(
            casualty_number="406571903", budget_number=1446508, version_number=99,
        )
        assert resp.status_code == 404
        assert "encontrada" in resp.data["error"]

    @respx.mock
    def test_401_unauthorized(self, client):
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(401, json={"error": "token inválido"}))

        resp = client.get_budget(casualty_number="X", budget_number=1)
        assert resp.status_code == 401

    @respx.mock
    def test_passes_auth_token_in_query(self, client):
        route = respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1)
        request = route.calls[0].request
        assert "auth_token=test-token-123" in str(request.url)

    @respx.mock
    def test_omits_version_when_none(self, client):
        route = respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1)  # version_number=None
        request = route.calls[0].request
        assert "version_number" not in str(request.url)

    @respx.mock
    def test_includes_version_when_set(self, client):
        route = respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json={}))

        client.get_budget(casualty_number="X", budget_number=1, version_number=3)
        request = route.calls[0].request
        assert "version_number=3" in str(request.url)

    @respx.mock
    def test_measures_duration_ms(self, client):
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json={}))

        resp = client.get_budget(casualty_number="X", budget_number=1)
        assert resp.duration_ms >= 0


class TestListBudgets:

    @respx.mock
    def test_default_params(self, client):
        route = respx.get(
            "https://test.cilia.local/api/integration/budgets/list_budgets",
        ).mock(return_value=Response(200, json={"results": []}))

        client.list_budgets()
        url_str = str(route.calls[0].request.url)
        assert "budget_type=InsurerBudget" in url_str
        assert "page=1" in url_str
        assert "per_page=25" in url_str

    @respx.mock
    def test_date_range_params(self, client):
        route = respx.get(
            "https://test.cilia.local/api/integration/budgets/list_budgets",
        ).mock(return_value=Response(200, json={"results": []}))

        client.list_budgets(
            date_type="finalized", start_date="2026-04-01", end_date="2026-04-21",
        )
        url_str = str(route.calls[0].request.url)
        # urlencoded []: date_range%5Bstart_date%5D=...
        assert "date_range" in url_str
        assert "2026-04-01" in url_str
        assert "2026-04-21" in url_str


class TestNetworkErrors:

    @respx.mock
    def test_network_error_raises(self, client):
        import httpx
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(side_effect=httpx.ConnectError("connection failed"))

        with pytest.raises(CiliaError, match="Network error"):
            client.get_budget(casualty_number="X", budget_number=1)
```

- [ ] **Step 2.5: Rodar**

Expected: 181 + 10 = **191 PASS**.

- [ ] **Step 2.6: Commit**

```bash
git add backend/core/
git commit -m "feat(imports): CiliaClient httpx + testes com respx e fixtures reais"
```

---

## Task 3: `CiliaParser` — payload → DTO

**Files:**
- Create: `backend/core/apps/imports/sources/cilia_parser.py`
- Create: `backend/core/apps/imports/services.py` (ParsedBudget DTO + ImportService stub)
- Create: `backend/core/apps/imports/tests/test_cilia_parser.py`

- [ ] **Step 3.1: ParsedBudget DTO em `services.py`**

Create `backend/core/apps/imports/services.py`:

```python
"""Services da camada de importação.

Define o DTO `ParsedBudget` consumido por
`ServiceOrderService.create_new_version_from_import()` (Ciclo 02).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass
class ParsedItemDTO:
    """Item parseado — agnóstico à fonte (Cilia/XML/HDI usam mesmo formato)."""

    # Classificação
    bucket: str = "IMPACTO"
    payer_block: str = "SEGURADORA"
    impact_area: int | None = None
    item_type: str = "PART"  # PART | SERVICE | EXTERNAL_SERVICE | FEE

    # Descrição
    description: str = ""
    external_code: str = ""

    # Tipo de peça
    part_type: str = ""  # GENUINA | ORIGINAL | OUTRAS_FONTES | VERDE
    supplier: str = "OFICINA"  # OFICINA | SEGURADORA

    # Financeiro
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    net_price: Decimal = Decimal("0")

    # Flags (serializados no persist)
    flag_abaixo_padrao: bool = False
    flag_acima_padrao: bool = False
    flag_inclusao_manual: bool = False
    flag_codigo_diferente: bool = False
    flag_servico_manual: bool = False
    flag_peca_da_conta: bool = False

    # Operations (lista de dict) — serão convertidas em ItemOperation
    operations: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ParsedParecerDTO:
    """Parecer/conclusion da fonte."""

    source: str = "cilia"
    flow_number: int | None = None
    author_external: str = ""
    author_org: str = ""
    author_document: str = ""
    parecer_type: str = ""  # AUTORIZADO, NEGADO, CORRECAO, etc
    body: str = ""
    created_at_external: str | None = None  # ISO8601 string


@dataclass
class ParsedBudget:
    """Resultado do parser. Feeds ServiceOrderService.create_new_version_from_import."""

    source: str = "cilia"

    # Identificação
    external_budget_number: str = ""
    external_version: str = ""  # "1446508.2"
    external_numero_vistoria: str = ""
    external_integration_id: str = ""  # Cilia budget_version_id
    external_budget_id: int | None = None  # Cilia budget_id
    external_version_id: int | None = None  # Cilia budget_version_id
    external_flow_number: int | None = None

    # Status Cilia
    external_status: str = "analisado"  # mapeado pra nossos status internos

    # Dados do segurado/cliente
    segurado_name: str = ""
    segurado_cpf: str = ""
    segurado_phone: str = ""
    segurado_email: str = ""

    # Veículo
    vehicle_plate: str = ""
    vehicle_description: str = ""
    vehicle_chassis: str = ""
    vehicle_color: str = ""
    vehicle_km: str = ""
    vehicle_year: int | None = None
    vehicle_brand: str = ""

    # Sinistro/apólice
    casualty_number: str = ""
    insurer_code: str = ""  # mapeado de insurer.trade pro nosso catálogo

    # Financeiro
    franchise_amount: Decimal = Decimal("0")
    global_discount_pct: Decimal = Decimal("0")
    hourly_rates: dict[str, str] = field(default_factory=dict)

    # Dados
    items: list[ParsedItemDTO] = field(default_factory=list)
    pareceres: list[ParsedParecerDTO] = field(default_factory=list)

    # Payload completo (preservado pra snapshot)
    raw_payload: dict[str, Any] = field(default_factory=dict)
    raw_hash: str = ""

    # Bonus Cilia
    report_pdf_base64: str = ""
    report_html_base64: str = ""
```

- [ ] **Step 3.2: CiliaParser**

Create `backend/core/apps/imports/sources/cilia_parser.py`:

```python
"""Parser do payload Cilia → ParsedBudget DTO.

Mapeamentos:
- insurer.trade → nosso Insurer.code
- budgetings[] → ParsedItemDTO com operations inferidas das horas
- conclusion → ParsedParecerDTO
- totals.franchise → ParsedBudget.franchise_amount
- standard_labor → hourly_rates dict
"""
from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any

from apps.imports.services import (
    ParsedBudget, ParsedItemDTO, ParsedParecerDTO,
)


# Mapeamento trade name Cilia → nosso Insurer.code
INSURER_TRADE_TO_CODE: dict[str, str] = {
    "Yelum Seguradora": "yelum",
    "Tokio Marine": "tokio",
    "Porto Seguro": "porto",
    "Azul Seguros": "azul",
    "Itaú Seguros": "itau",
    "HDI Seguros": "hdi",
    "Mapfre": "mapfre",
    "Bradesco Seguros": "bradesco",
    "Allianz": "allianz",
    "Suhai": "suhai",
}


# Mapeamento status Cilia → nosso ServiceOrderVersion.status
CILIA_STATUS_TO_INTERNAL: dict[str, str] = {
    "created": "analisado",
    "analyzing": "em_analise",
    "with_expert": "em_analise",
    "budgeting": "analisado",
    "ready_for_analysis": "analisado",
    "with_analyst": "em_analise",
    "analyzed": "analisado",
    "distributed": "autorizado",
    "done": "autorizado",
    "refused": "negado",
    "finalized": "autorizado",
}


# Mapeamento conclusion.key → nosso parecer_type
CILIA_CONCLUSION_KEY_TO_PARECER: dict[str, str] = {
    "authorized": "AUTORIZADO",
    "not_authorized": "NEGADO",
    "refused": "NEGADO",
    "supplement": "CORRECAO",
    "pending": "COMENTARIO_INTERNO",
}


# Mapeamento remove_install_type → nosso LaborCategory.code
CILIA_LABOR_TYPE_TO_CATEGORY: dict[str, str] = {
    "tapestry": "TAPECARIA",
    "mechanic": "MECANICA",
    "auto_body": "FUNILARIA",
    "electrical": "ELETRICA",
    "glazing": "VIDRACARIA",
}


# Mapeamento vehicle_piece_type → part_type
CILIA_PIECE_TYPE_TO_PART: dict[str, str] = {
    "genuine": "GENUINA",
    "original": "ORIGINAL",
    "other_sources": "OUTRAS_FONTES",
    "green": "VERDE",
}


class CiliaParser:
    """Converte payload JSON da Cilia em ParsedBudget DTO."""

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> ParsedBudget:
        pb = ParsedBudget(source="cilia")

        # Identificação
        pb.external_budget_id = payload.get("budget_id")
        pb.external_version_id = payload.get("budget_version_id")
        pb.external_budget_number = str(payload.get("budget_number", ""))
        version_num = payload.get("version_number", 1)
        pb.external_version = f"{pb.external_budget_number}.{version_num}"
        pb.casualty_number = str(payload.get("casualty_number", ""))
        pb.external_status = CILIA_STATUS_TO_INTERNAL.get(
            payload.get("status", ""), "analisado",
        )
        pb.external_flow_number = payload.get("conclusion", {}).get("flow_number")

        # Cliente
        client = payload.get("client", {}) or {}
        pb.segurado_name = client.get("name") or ""
        pb.segurado_cpf = client.get("document_identifier") or ""
        pb.segurado_email = client.get("email") or ""
        phone = client.get("phone") or {}
        pb.segurado_phone = f"{phone.get('ddd') or ''}{phone.get('number') or ''}".strip()

        # Veículo
        vehicle = payload.get("vehicle", {}) or {}
        pb.vehicle_plate = (vehicle.get("license_plate") or "").upper()
        pb.vehicle_description = cls._build_vehicle_description(vehicle)
        pb.vehicle_chassis = vehicle.get("body") or ""
        pb.vehicle_color = vehicle.get("color") or ""
        pb.vehicle_km = str(vehicle.get("mileage") or "")
        pb.vehicle_year = vehicle.get("model_year")
        pb.vehicle_brand = vehicle.get("brand") or ""

        # Seguradora
        insurer = payload.get("insurer", {}) or {}
        trade = insurer.get("trade") or ""
        pb.insurer_code = INSURER_TRADE_TO_CODE.get(trade, "")

        # Financeiro
        totals = payload.get("totals", {}) or {}
        pb.franchise_amount = cls._dec(totals.get("franchise", 0))

        # Tabela MO (standard_labor)
        labor = payload.get("standard_labor", {}) or {}
        pb.hourly_rates = {
            "FUNILARIA": str(labor.get("workforce_cost", 0)),
            "PINTURA": str(labor.get("paint_cost", 0)),
            "PINTURA_TRICOAT": str(labor.get("paint_tricoat_cost", 0)),
            "REPARACAO": str(labor.get("repair_cost", 0)),
            "MECANICA": str(labor.get("workforce_cost", 0)),
            "ELETRICA": str(labor.get("workforce_cost", 0)),
        }
        pb.global_discount_pct = cls._dec(labor.get("discount", 0))

        # Items
        for entry in payload.get("budgetings", []):
            pb.items.append(cls._parse_item(entry))

        # Parecer / conclusion (um único parecer por versão)
        conclusion = payload.get("conclusion")
        if conclusion:
            pb.pareceres.append(cls._parse_conclusion(conclusion))

        # Snapshot completo
        pb.raw_payload = payload
        pb.raw_hash = cls._compute_hash(payload)

        # Report PDF/HTML (base64 da Cilia)
        pb.report_pdf_base64 = payload.get("report_pdf") or ""
        pb.report_html_base64 = payload.get("report_html") or ""

        return pb

    @classmethod
    def _parse_item(cls, entry: dict[str, Any]) -> ParsedItemDTO:
        """Converte um budgeting da Cilia em ParsedItemDTO."""
        type_code = entry.get("type", "")
        if type_code == "BudgetingPiece":
            item_type = "PART"
        elif type_code == "BudgetingManualService":
            item_type = "SERVICE"
        elif type_code == "BudgetingVehicleMaintenance":
            item_type = "SERVICE"
        else:
            item_type = "SERVICE"

        # Bucket a partir de budgeting_type
        budgeting_type = entry.get("budgeting_type", "impact")
        bucket = {
            "impact": "IMPACTO",
            "without_coverage": "SEM_COBERTURA",
            "estimated": "SOB_ANALISE",
        }.get(budgeting_type, "IMPACTO")

        # Supplier
        supplier = "OFICINA" if entry.get("supplier_type") == "workshop" else "SEGURADORA"

        # Preços
        quantity = cls._dec(entry.get("quantity", 1))
        unit_price = cls._dec(
            entry.get("piece_selling_cost")
            or entry.get("selling_cost", 0),
        )
        net_price = cls._dec(
            entry.get("piece_selling_cost_final")
            or entry.get("selling_cost", 0),
        )
        discount_pct = cls._dec(entry.get("piece_discount_percentage", 0))

        # Part type
        part_type = CILIA_PIECE_TYPE_TO_PART.get(entry.get("vehicle_piece_type", ""), "")

        # Operations — cada tipo de hora vira uma ItemOperation
        operations: list[dict[str, Any]] = []
        labor_category = CILIA_LABOR_TYPE_TO_CATEGORY.get(
            entry.get("remove_install_type", ""), "FUNILARIA",
        )

        # R&I (remove_install) quando há horas
        ri_hours = cls._dec(entry.get("remove_install_hours", 0))
        if ri_hours > 0 or entry.get("remove_install_used"):
            operations.append({
                "op_type": "R_I",
                "labor_cat": labor_category,
                "hours": str(ri_hours),
                "rate": "0",  # rate vem do hourly_rates aplicado no service
            })

        # TROCA se exchange_used
        if entry.get("exchange_used"):
            operations.append({
                "op_type": "TROCA",
                "labor_cat": labor_category,
                "hours": "0",
                "rate": "0",
            })

        # Pintura quando há paint_hours
        paint_hours = cls._dec(entry.get("paint_hours", 0))
        if paint_hours > 0 or entry.get("paint_used"):
            operations.append({
                "op_type": "PINTURA",
                "labor_cat": "PINTURA",
                "hours": str(paint_hours),
                "rate": "0",
            })

        # Reparação quando há repair_hours
        repair_hours = cls._dec(entry.get("repair_hours", 0))
        if repair_hours > 0 or entry.get("repair_used"):
            operations.append({
                "op_type": "RECUPERACAO",
                "labor_cat": "REPARACAO",
                "hours": str(repair_hours),
                "rate": "0",
            })

        return ParsedItemDTO(
            bucket=bucket,
            payer_block="SEGURADORA",
            impact_area=entry.get("impact_area"),
            item_type=item_type,
            description=entry.get("name", ""),
            external_code=(entry.get("code") or "").strip(),
            part_type=part_type,
            supplier=supplier,
            quantity=quantity,
            unit_price=unit_price,
            discount_pct=discount_pct,
            net_price=net_price,
            flag_inclusao_manual=bool(entry.get("inclusion_manual", False)),
            operations=operations,
        )

    @classmethod
    def _parse_conclusion(cls, conclusion: dict[str, Any]) -> ParsedParecerDTO:
        return ParsedParecerDTO(
            source="cilia",
            flow_number=conclusion.get("flow_number"),
            author_external=conclusion.get("author_name", "").strip(),
            author_document=conclusion.get("author_document_identifier", ""),
            parecer_type=CILIA_CONCLUSION_KEY_TO_PARECER.get(
                conclusion.get("key", ""), "COMENTARIO_INTERNO",
            ),
            body=conclusion.get("description", ""),
            created_at_external=conclusion.get("created_at"),
        )

    @staticmethod
    def _build_vehicle_description(vehicle: dict[str, Any]) -> str:
        brand = vehicle.get("brand", "")
        model = vehicle.get("model", "")
        year = vehicle.get("model_year", "")
        color = vehicle.get("color", "")
        parts = [p for p in [brand, model, str(year) if year else "", color] if p]
        return " ".join(parts).strip()

    @staticmethod
    def _dec(value: Any) -> Decimal:
        if value is None or value == "":
            return Decimal("0")
        try:
            return Decimal(str(value))
        except Exception:
            return Decimal("0")

    @staticmethod
    def _compute_hash(payload: dict[str, Any]) -> str:
        """SHA256 do payload normalizado (exclui report_html/pdf — muitos MB)."""
        canonical = {k: v for k, v in payload.items() if k not in ("report_html", "report_pdf")}
        serialized = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
```

- [ ] **Step 3.3: Tests usando fixtures reais**

Create `backend/core/apps/imports/tests/test_cilia_parser.py`:

```python
import json
from decimal import Decimal
from pathlib import Path

import pytest

from apps.imports.sources.cilia_parser import CiliaParser


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def v1_payload():
    return _load("cilia_1446508_v1.json")


@pytest.fixture
def v2_payload():
    return _load("cilia_1446508_v2.json")


class TestCiliaParserIdentification:

    def test_basic_identifiers_v1(self, v1_payload):
        pb = CiliaParser.parse(v1_payload)
        assert pb.source == "cilia"
        assert pb.external_budget_id == 17732641
        assert pb.external_version_id == 30228697
        assert pb.external_budget_number == "1446508"
        assert pb.external_version == "1446508.1"
        assert pb.casualty_number == "406571903"
        assert pb.external_flow_number == 1

    def test_basic_identifiers_v2(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.external_version == "1446508.2"
        assert pb.external_version_id == 30629056  # diferente de v1
        assert pb.external_flow_number == 2

    def test_status_mapping(self, v1_payload):
        pb = CiliaParser.parse(v1_payload)
        assert pb.external_status == "analisado"  # status Cilia "analyzed"


class TestCiliaParserCustomer:

    def test_client_data(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert "FLEXCABLES" in pb.segurado_name.upper()
        assert pb.segurado_cpf == "04497844000140"

    def test_vehicle_data(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.vehicle_plate == "TAF8E63"
        assert pb.vehicle_chassis == "8AC907655SE254082"
        assert pb.vehicle_color == "BRANCA"
        assert pb.vehicle_year == 2025
        assert pb.vehicle_brand == "MERCEDES-BENZ"
        assert "SPRINTER" in pb.vehicle_description
        assert "BRANCA" in pb.vehicle_description

    def test_insurer_code_mapped(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.insurer_code == "tokio"  # Tokio Marine → "tokio"


class TestCiliaParserItems:

    def test_items_count(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert len(pb.items) == 3  # 2 peças + 1 serviço manual

    def test_piece_item(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parachoque = next(i for i in pb.items if "PARACHOQUE" in i.description)
        assert parachoque.item_type == "PART"
        assert parachoque.bucket == "IMPACTO"
        assert parachoque.external_code == "A90788512009K83"
        assert parachoque.part_type == "GENUINA"
        assert parachoque.supplier == "OFICINA"
        assert parachoque.unit_price == Decimal("5586.93")
        assert parachoque.net_price == Decimal("5586.93")
        assert parachoque.flag_inclusao_manual is True

    def test_item_with_remove_install(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parachoque = next(i for i in pb.items if "PARACHOQUE" in i.description)
        ri_op = next((op for op in parachoque.operations if op["op_type"] == "R_I"), None)
        assert ri_op is not None
        assert Decimal(ri_op["hours"]) == Decimal("1.0")
        assert ri_op["labor_cat"] == "TAPECARIA"  # remove_install_type "tapestry"

    def test_impact_area_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        for item in pb.items:
            if item.external_code.startswith("A"):  # peças
                assert item.impact_area == 1


class TestCiliaParserConclusion:

    def test_conclusion_v1_not_authorized(self, v1_payload):
        pb = CiliaParser.parse(v1_payload)
        assert len(pb.pareceres) == 1
        parecer = pb.pareceres[0]
        assert parecer.parecer_type == "NEGADO"  # not_authorized → NEGADO
        assert parecer.flow_number == 1
        assert parecer.source == "cilia"

    def test_conclusion_v2_authorized(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        parecer = pb.pareceres[0]
        assert parecer.parecer_type == "AUTORIZADO"
        assert parecer.flow_number == 2
        assert "REPARO AUTORIZADO" in parecer.body.upper()


class TestCiliaParserFinanceiro:

    def test_franchise(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.franchise_amount == Decimal("0")  # neste caso zero

    def test_hourly_rates(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.hourly_rates["PINTURA"] == "65.0"
        assert pb.hourly_rates["FUNILARIA"] == "48.0"
        assert pb.hourly_rates["REPARACAO"] == "53.0"


class TestCiliaParserSnapshot:

    def test_raw_payload_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.raw_payload == v2_payload
        assert "budget_version_id" in pb.raw_payload

    def test_hash_computed(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert len(pb.raw_hash) == 64  # SHA256 hex

    def test_hash_excludes_report_fields(self, v2_payload):
        """Hash deve ser o mesmo mesmo se report_html mudar."""
        pb1 = CiliaParser.parse(v2_payload)

        altered = {**v2_payload, "report_html": "OTHER"}
        pb2 = CiliaParser.parse(altered)

        assert pb1.raw_hash == pb2.raw_hash

    def test_hash_detects_item_changes(self, v2_payload):
        pb1 = CiliaParser.parse(v2_payload)

        altered = {**v2_payload}
        altered["totals"] = {**altered["totals"], "total_liquid": 9999.99}
        pb2 = CiliaParser.parse(altered)

        assert pb1.raw_hash != pb2.raw_hash

    def test_report_pdf_preserved(self, v2_payload):
        pb = CiliaParser.parse(v2_payload)
        assert pb.report_pdf_base64 != ""
        assert len(pb.report_pdf_base64) > 1000  # PDF em base64 tem muitos KB
```

- [ ] **Step 3.4: Rodar**

Expected: 191 + 15 = **206 PASS**.

- [ ] **Step 3.5: Commit**

```bash
git add backend/core/
git commit -m "feat(imports): CiliaParser maps payload → ParsedBudget DTO com fixtures reais"
```

---

## Task 4: `ImportService.import_from_cilia` — integração com ServiceOrderService

**Files:**
- Modify: `backend/core/apps/imports/services.py` (+ ImportService class)
- Modify: `backend/core/apps/service_orders/services.py` (expandir `create_new_version_from_import` pra consumir items + pareceres + report_pdf)
- Create: `backend/core/apps/imports/tests/test_import_service.py`

- [ ] **Step 4.1: Expandir `ServiceOrderService.create_new_version_from_import`**

Em `apps/service_orders/services.py`, expandir o método pra persistir items, pareceres e snapshot:

```python
    @classmethod
    @transaction.atomic
    def create_new_version_from_import(
        cls,
        *,
        service_order: ServiceOrder,
        parsed_budget,
        import_attempt=None,
    ) -> ServiceOrderVersion:
        """... (manter docstring existente)"""
        from apps.items.models import ItemOperation, ItemOperationType, LaborCategory
        from .models import ServiceOrderParecer, ServiceOrderVersionItem

        next_num = 1
        if service_order.active_version:
            next_num = service_order.active_version.version_number + 1

        version = ServiceOrderVersion.objects.create(
            service_order=service_order,
            version_number=next_num,
            source=parsed_budget.source,
            external_version=getattr(parsed_budget, "external_version", ""),
            external_numero_vistoria=getattr(parsed_budget, "external_numero_vistoria", ""),
            external_integration_id=getattr(parsed_budget, "external_integration_id", ""),
            status=getattr(parsed_budget, "external_status", "analisado"),
            content_hash=getattr(parsed_budget, "raw_hash", ""),
            raw_payload_s3_key=(
                import_attempt.raw_payload_s3_key if import_attempt else ""
            ) if hasattr(import_attempt, "raw_payload_s3_key") else "",
            hourly_rates=getattr(parsed_budget, "hourly_rates", {}),
            global_discount_pct=getattr(parsed_budget, "global_discount_pct", Decimal("0")),
            # NOVO — snapshot
            raw_payload=getattr(parsed_budget, "raw_payload", None),
            external_budget_id=getattr(parsed_budget, "external_budget_id", None),
            external_version_id=getattr(parsed_budget, "external_version_id", None),
            external_flow_number=getattr(parsed_budget, "external_flow_number", None),
            report_pdf_base64=getattr(parsed_budget, "report_pdf_base64", ""),
            report_html_base64=getattr(parsed_budget, "report_html_base64", ""),
        )

        # Persistir items
        hourly_rates = getattr(parsed_budget, "hourly_rates", {}) or {}
        for item_dto in getattr(parsed_budget, "items", []) or []:
            item = ServiceOrderVersionItem.objects.create(
                version=version,
                bucket=getattr(item_dto, "bucket", "IMPACTO"),
                payer_block=getattr(item_dto, "payer_block", "SEGURADORA"),
                impact_area=getattr(item_dto, "impact_area", None),
                item_type=getattr(item_dto, "item_type", "PART"),
                description=getattr(item_dto, "description", ""),
                external_code=getattr(item_dto, "external_code", ""),
                part_type=getattr(item_dto, "part_type", ""),
                supplier=getattr(item_dto, "supplier", "OFICINA"),
                quantity=getattr(item_dto, "quantity", Decimal("1")),
                unit_price=getattr(item_dto, "unit_price", Decimal("0")),
                discount_pct=getattr(item_dto, "discount_pct", Decimal("0")),
                net_price=getattr(item_dto, "net_price", Decimal("0")),
                flag_abaixo_padrao=getattr(item_dto, "flag_abaixo_padrao", False),
                flag_acima_padrao=getattr(item_dto, "flag_acima_padrao", False),
                flag_inclusao_manual=getattr(item_dto, "flag_inclusao_manual", False),
                flag_codigo_diferente=getattr(item_dto, "flag_codigo_diferente", False),
                flag_servico_manual=getattr(item_dto, "flag_servico_manual", False),
                flag_peca_da_conta=getattr(item_dto, "flag_peca_da_conta", False),
            )

            # Persistir operations
            for op_data in getattr(item_dto, "operations", []) or []:
                op_type_code = op_data.get("op_type")
                labor_cat_code = op_data.get("labor_cat")
                try:
                    op_type = ItemOperationType.objects.get(code=op_type_code)
                    labor_cat = LaborCategory.objects.get(code=labor_cat_code)
                except (ItemOperationType.DoesNotExist, LaborCategory.DoesNotExist):
                    continue  # pular operations com códigos desconhecidos

                # Rate: se op_data não tem rate, buscar em hourly_rates do parsed_budget
                rate_str = op_data.get("rate") or "0"
                if Decimal(rate_str) == Decimal("0"):
                    rate_str = hourly_rates.get(labor_cat_code, "0")

                hours = Decimal(op_data.get("hours", "0"))
                rate = Decimal(rate_str)

                ItemOperation.objects.create(
                    item_so=item,
                    operation_type=op_type,
                    labor_category=labor_cat,
                    hours=hours,
                    hourly_rate=rate,
                    labor_cost=hours * rate,
                )

        # Recalcular totais baseado nos items criados
        cls._recalculate_totals(version)

        # Persistir pareceres
        for parecer_dto in getattr(parsed_budget, "pareceres", []) or []:
            ServiceOrderParecer.objects.create(
                service_order=service_order,
                version=version,
                source=parecer_dto.source,
                flow_number=parecer_dto.flow_number,
                author_external=parecer_dto.author_external,
                author_org=parecer_dto.author_org,
                parecer_type=parecer_dto.parecer_type,
                body=parecer_dto.body,
                created_at_external=parecer_dto.created_at_external,
            )

        OSEventLogger.log_event(
            service_order, "VERSION_CREATED",
            payload={
                "version": next_num,
                "source": parsed_budget.source,
                "external": getattr(parsed_budget, "external_version", ""),
                "items_count": len(getattr(parsed_budget, "items", []) or []),
            },
        )
        OSEventLogger.log_event(
            service_order, "IMPORT_RECEIVED",
            payload={
                "source": parsed_budget.source,
                "attempt_id": import_attempt.pk if import_attempt else None,
            },
        )

        # Pausa se OS estava em estado de reparo
        non_pausable = {"reception", "budget", "delivered", "cancelled",
                        "ready", "final_survey"}
        if service_order.status not in non_pausable:
            cls.change_status(
                service_order=service_order, new_status="budget",
                changed_by="Sistema",
                notes=f"Nova versão importada: {version.status_label}",
                is_auto=True,
            )
        return version
```

- [ ] **Step 4.2: `ImportService.import_from_cilia()`**

Em `apps/imports/services.py`, adicionar no final:

```python
import logging
import time
from typing import Any

from django.db import transaction

from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion
from apps.service_orders.services import ServiceOrderService

from .models import ImportAttempt
from .sources.cilia_client import (
    CiliaClient, CiliaError, CiliaNotFoundError, CiliaResponse,
)
from .sources.cilia_parser import CiliaParser


logger = logging.getLogger(__name__)


class ImportService:

    @classmethod
    def fetch_cilia_budget(
        cls,
        *,
        casualty_number: str,
        budget_number: int | str,
        version_number: int | None = None,
        trigger: str = "user_requested",
        created_by: str = "Sistema",
        client: CiliaClient | None = None,
    ) -> ImportAttempt:
        """Busca orçamento Cilia e persiste como ServiceOrderVersion se novo.

        Pipeline:
          1. Chama Cilia API (com timing)
          2. Cria ImportAttempt (sucesso ou falha)
          3. Se 200: dedup por content_hash, se novo → cria OS+version ou só version
          4. Se 404: registra e retorna attempt com parsed_ok=False
          5. Se 4xx/5xx: registra erro

        Returns:
            ImportAttempt (sempre — mesmo em erro) com service_order e version_created
            populados quando aplicável.
        """
        client = client or CiliaClient()

        start = time.monotonic()
        try:
            response = client.get_budget(
                casualty_number=casualty_number,
                budget_number=budget_number,
                version_number=version_number,
            )
        except CiliaError as exc:
            # Erro de rede (timeout, DNS, etc)
            duration_ms = int((time.monotonic() - start) * 1000)
            return ImportAttempt.objects.create(
                source="cilia", trigger=trigger, created_by=created_by,
                casualty_number=casualty_number,
                budget_number=str(budget_number),
                version_number=version_number,
                parsed_ok=False,
                error_message=str(exc),
                error_type="NetworkError",
                duration_ms=duration_ms,
            )

        # Criar attempt base
        attempt = ImportAttempt.objects.create(
            source="cilia", trigger=trigger, created_by=created_by,
            casualty_number=casualty_number,
            budget_number=str(budget_number),
            version_number=version_number,
            http_status=response.status_code,
            duration_ms=response.duration_ms,
            raw_payload=response.data if response.status_code == 200 else None,
        )

        # Respostas não-200
        if response.status_code == 404:
            attempt.error_message = "Versão do orçamento não encontrada"
            attempt.error_type = "NotFound"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        if response.status_code in (401, 403):
            attempt.error_message = str((response.data or {}).get("error", "Unauthorized"))
            attempt.error_type = "AuthError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        if response.status_code != 200:
            attempt.error_message = f"HTTP {response.status_code}: {response.raw_text[:500]}"
            attempt.error_type = f"HTTP{response.status_code}"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        # 200 — parse
        try:
            parsed = CiliaParser.parse(response.data)
        except Exception as exc:
            logger.exception("Cilia parse error")
            attempt.error_message = f"Parse error: {exc}"
            attempt.error_type = "ParseError"
            attempt.parsed_ok = False
            attempt.save(update_fields=["error_message", "error_type", "parsed_ok"])
            return attempt

        attempt.raw_hash = parsed.raw_hash
        attempt.save(update_fields=["raw_hash"])

        # Dedup exato — se já processou esse hash, marca duplicate_of
        previous_ok = ImportAttempt.objects.filter(
            source="cilia", parsed_ok=True, raw_hash=parsed.raw_hash,
        ).exclude(pk=attempt.pk).first()
        if previous_ok:
            attempt.duplicate_of = previous_ok
            attempt.parsed_ok = False  # não é um "ok novo"
            attempt.error_message = "Payload idêntico já processado"
            attempt.error_type = "Duplicate"
            attempt.save(update_fields=["duplicate_of", "parsed_ok", "error_message", "error_type"])
            return attempt

        # Persist
        try:
            os_instance, version = cls._persist_cilia_budget(parsed=parsed, attempt=attempt)
        except Exception as exc:
            logger.exception("Cilia persist error")
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
    def _persist_cilia_budget(
        cls, *, parsed: ParsedBudget, attempt: ImportAttempt,
    ) -> tuple[ServiceOrder, ServiceOrderVersion]:
        """Encontra ou cria OS (matched por insurer+casualty), depois cria version."""
        from apps.items.services import NumberAllocator
        from apps.persons.models import Person

        insurer = Insurer.objects.filter(code=parsed.insurer_code).first()
        if insurer is None:
            raise ValueError(
                f"Insurer '{parsed.insurer_code}' não existe no catálogo "
                f"(Cilia trade: '{parsed.raw_payload.get('insurer', {}).get('trade', '?')}'). "
                f"Seed a seguradora primeiro.",
            )

        os_instance = ServiceOrder.objects.filter(
            insurer=insurer, casualty_number=parsed.casualty_number,
        ).first()

        if os_instance is None:
            # Resolver customer — busca por document_identifier; cria se não existe
            customer = Person.objects.filter(
                document=parsed.segurado_cpf,
            ).first()
            if customer is None:
                customer = Person.objects.create(
                    full_name=parsed.segurado_name or "Cliente Importado Cilia",
                    person_type="CLIENT",
                    document=parsed.segurado_cpf,
                )

            os_instance = ServiceOrder.objects.create(
                os_number=NumberAllocator.allocate("SERVICE_ORDER"),
                customer=customer,
                customer_type="SEGURADORA",
                insurer=insurer,
                casualty_number=parsed.casualty_number,
                external_budget_number=parsed.external_budget_number,
                franchise_amount=parsed.franchise_amount,
                vehicle_plate=parsed.vehicle_plate,
                vehicle_description=parsed.vehicle_description,
                status="reception",
            )

        # Verificar se já existe versão com external_version_id (idempotência)
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

- [ ] **Step 4.3: Tests**

Create `backend/core/apps/imports/tests/test_import_service.py`:

```python
import json
from pathlib import Path

import pytest
import respx
from httpx import Response

from apps.imports.models import ImportAttempt
from apps.imports.services import ImportService
from apps.imports.sources.cilia_client import CiliaClient
from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def cilia_client(settings):
    settings.CILIA_AUTH_TOKEN = "test"
    settings.CILIA_BASE_URL = "https://test.cilia.local"
    return CiliaClient()


@pytest.fixture
def tokio_insurer(db):
    insurer, _ = Insurer.objects.get_or_create(
        code="tokio", defaults={"name": "Tokio Marine", "import_source": "cilia_api"},
    )
    return insurer


@pytest.mark.django_db
class TestImportFromCiliaSuccess:

    @respx.mock
    def test_creates_os_and_version_v2(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903",
            budget_number=1446508,
            version_number=2,
            client=cilia_client,
        )

        assert attempt.parsed_ok is True
        assert attempt.http_status == 200
        assert attempt.service_order is not None
        assert attempt.version_created is not None

        os = attempt.service_order
        assert os.customer_type == "SEGURADORA"
        assert os.casualty_number == "406571903"
        assert os.insurer == tokio_insurer

        v = attempt.version_created
        assert v.external_version == "1446508.2"
        assert v.external_budget_id == 17732641
        assert v.external_version_id == 30629056
        assert v.external_flow_number == 2
        assert v.items.count() == 3  # 2 peças + 1 serviço manual

    @respx.mock
    def test_preserves_raw_payload_and_reports(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        v = attempt.version_created
        assert v.raw_payload is not None
        assert v.raw_payload["budget_version_id"] == 30629056
        assert v.report_pdf_base64 != ""
        assert v.report_html_base64 != ""

    @respx.mock
    def test_creates_parecer_from_conclusion(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        pareceres = attempt.service_order.pareceres.all()
        assert pareceres.count() == 1
        p = pareceres.first()
        assert p.source == "cilia"
        assert p.parecer_type == "AUTORIZADO"
        assert p.flow_number == 2

    @respx.mock
    def test_emits_events(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        events = attempt.service_order.events.all()
        assert events.filter(event_type="VERSION_CREATED").exists()
        assert events.filter(event_type="IMPORT_RECEIVED").exists()

    @respx.mock
    def test_second_call_with_same_version_dedup(self, cilia_client, tokio_insurer):
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        a1 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )
        a2 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        assert a1.parsed_ok is True
        assert a2.parsed_ok is False
        assert a2.duplicate_of == a1
        assert ServiceOrderVersion.objects.filter(
            external_version_id=30629056,
        ).count() == 1  # não duplicou

    @respx.mock
    def test_v1_then_v2_creates_two_versions(self, cilia_client, tokio_insurer):
        v1 = _load("cilia_1446508_v1.json")
        v2 = _load("cilia_1446508_v2.json")

        route = respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(side_effect=[
            Response(200, json=v1),
            Response(200, json=v2),
        ])

        a1 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=1,
            client=cilia_client,
        )
        a2 = ImportService.fetch_cilia_budget(
            casualty_number="406571903", budget_number=1446508, version_number=2,
            client=cilia_client,
        )

        assert a1.service_order == a2.service_order  # mesma OS
        assert a1.version_created.version_number == 1
        assert a2.version_created.version_number == 2
        assert a1.version_created.pk != a2.version_created.pk


@pytest.mark.django_db
class TestImportFromCiliaErrors:

    @respx.mock
    def test_404_version_not_found(self, cilia_client, tokio_insurer):
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(404, json={"error": "Versão não encontrada"}))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, version_number=999,
            client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.http_status == 404
        assert attempt.error_type == "NotFound"
        assert attempt.service_order is None
        assert attempt.version_created is None

    @respx.mock
    def test_401_auth_error(self, cilia_client, tokio_insurer):
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(401, json={"error": "token inválido"}))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "AuthError"

    @respx.mock
    def test_network_error(self, cilia_client, tokio_insurer):
        import httpx
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(side_effect=httpx.ConnectError("connection refused"))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "NetworkError"
        assert attempt.http_status is None

    @respx.mock
    def test_insurer_not_in_catalog_fails(self, cilia_client, db):
        """Se Insurer.code não bate, deve falhar com PersistError."""
        # Tokio insurer NÃO é criado
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        attempt = ImportService.fetch_cilia_budget(
            casualty_number="X", budget_number=1, version_number=2, client=cilia_client,
        )

        assert attempt.parsed_ok is False
        assert attempt.error_type == "PersistError"
        assert "catálogo" in attempt.error_message or "Insurer" in attempt.error_message
```

- [ ] **Step 4.4: Rodar e commit**

```bash
cd backend/core
DATABASE_URL="postgresql://paddock:paddock@localhost:5432/paddock_dev" pytest apps/ -v --tb=short
```

Expected: 206 + 12 = **218 PASS**.

```bash
git add backend/core/
git commit -m "feat(imports): ImportService.fetch_cilia_budget com dedup, snapshot, parecer e events"
```

---

## Task 5: Celery task de polling

**Files:**
- Create: `backend/core/apps/imports/tasks.py`
- Modify: `backend/core/config/celery.py` (beat schedule)
- Create: `backend/core/apps/imports/tests/test_tasks.py`

- [ ] **Step 5.1: Task `poll_cilia_budget(service_order_id)`**

Create `backend/core/apps/imports/tasks.py`:

```python
"""Celery tasks do importador Cilia."""
from __future__ import annotations

import logging

from celery import shared_task

from apps.service_orders.models import ServiceOrder

from .services import ImportService


logger = logging.getLogger(__name__)


# Status que indicam que não haverá mais versões (parar polling)
CILIA_TERMINAL_STATUSES: set[str] = {"refused", "finalized"}


@shared_task(name="apps.imports.tasks.poll_cilia_budget")
def poll_cilia_budget(service_order_id: int) -> dict:
    """Poll incremental — tenta buscar próxima versão (active + 1) na Cilia.

    Lógica:
      - Se active_version está em status terminal Cilia (refused/finalized) → skip
      - Se OS Kanban em delivered/cancelled → skip
      - Busca v+1 na Cilia:
          - 200: cria nova version (via ImportService, que dedupa pelo hash)
          - 404: não há próxima ainda — aguarda próximo ciclo
          - erro: loga mas não levanta

    Retorna dict com resultado ({action, version_created_id, attempt_id, ...}).
    """
    try:
        os_instance = ServiceOrder.objects.get(pk=service_order_id)
    except ServiceOrder.DoesNotExist:
        logger.warning("ServiceOrder %s não existe — skip polling", service_order_id)
        return {"action": "skipped", "reason": "os_not_found"}

    if os_instance.customer_type != "SEGURADORA":
        return {"action": "skipped", "reason": "not_insurance"}

    if os_instance.status in ("delivered", "cancelled"):
        return {"action": "skipped", "reason": "os_closed"}

    if not os_instance.casualty_number or not os_instance.external_budget_number:
        return {"action": "skipped", "reason": "missing_cilia_identifiers"}

    active = os_instance.active_version
    if active is None:
        return {"action": "skipped", "reason": "no_active_version"}

    # Checar status Cilia da versão ativa via raw_payload
    raw_status = (active.raw_payload or {}).get("status", "")
    if raw_status in CILIA_TERMINAL_STATUSES:
        return {
            "action": "skipped",
            "reason": f"cilia_terminal:{raw_status}",
            "active_version": active.version_number,
        }

    # Tentar próxima versão
    next_version = active.version_number + 1
    attempt = ImportService.fetch_cilia_budget(
        casualty_number=os_instance.casualty_number,
        budget_number=os_instance.external_budget_number,
        version_number=next_version,
        trigger="polling",
        created_by="Celery",
    )

    result = {
        "action": "unknown",
        "attempt_id": attempt.pk,
        "version_number": next_version,
        "http_status": attempt.http_status,
    }

    if attempt.parsed_ok and attempt.version_created:
        result["action"] = "version_created"
        result["version_created_id"] = attempt.version_created.pk
    elif attempt.http_status == 404:
        result["action"] = "not_yet"
    elif attempt.error_type == "Duplicate":
        result["action"] = "duplicate_skipped"
    else:
        result["action"] = "error"
        result["error"] = attempt.error_message

    logger.info("poll_cilia_budget OS=%s result=%s", service_order_id, result)
    return result


@shared_task(name="apps.imports.tasks.sync_active_cilia_os")
def sync_active_cilia_os() -> dict:
    """Dispara poll_cilia_budget pra cada OS Cilia ativa.

    Chamado via Celery beat a cada CILIA_POLLING_INTERVAL_MINUTES minutos.
    """
    qs = ServiceOrder.objects.filter(
        is_active=True,
        customer_type="SEGURADORA",
    ).exclude(
        status__in=["delivered", "cancelled"],
    ).exclude(
        casualty_number="",
    ).exclude(
        external_budget_number="",
    )

    total = 0
    for os_instance in qs.iterator():
        poll_cilia_budget.delay(os_instance.pk)
        total += 1

    logger.info("sync_active_cilia_os: %d OSes agendadas", total)
    return {"scheduled": total}
```

- [ ] **Step 5.2: Celery beat schedule**

Em `config/celery.py`, adicionar à `app.conf.beat_schedule`:

```python
from django.conf import settings

app.conf.beat_schedule = {
    "expire-stale-budgets-daily": {
        "task": "apps.budgets.tasks.expire_stale_budgets",
        "schedule": 60 * 60 * 24,  # 1x por dia
    },
    "sync-active-cilia-os": {
        "task": "apps.imports.tasks.sync_active_cilia_os",
        "schedule": settings.CILIA_POLLING_INTERVAL_MINUTES * 60,
    },
}
```

- [ ] **Step 5.3: Tests**

Create `backend/core/apps/imports/tests/test_tasks.py`:

```python
import json
from pathlib import Path
from unittest.mock import patch

import pytest
import respx
from httpx import Response

from apps.imports.models import ImportAttempt
from apps.imports.tasks import poll_cilia_budget, sync_active_cilia_os
from apps.persons.models import Person
from apps.service_orders.models import Insurer, ServiceOrder, ServiceOrderVersion


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


@pytest.fixture
def setup_cilia(settings):
    settings.CILIA_AUTH_TOKEN = "test"
    settings.CILIA_BASE_URL = "https://test.cilia.local"


@pytest.fixture
def os_seguradora(db):
    person = Person.objects.create(full_name="Poll Test", person_type="CLIENT")
    tokio = Insurer.objects.get(code="tokio")
    os = ServiceOrder.objects.create(
        os_number="OS-POLL-1", customer=person, customer_type="SEGURADORA",
        insurer=tokio, casualty_number="406571903",
        external_budget_number="1446508",
        vehicle_plate="TAF8E63", vehicle_description="Sprinter",
        status="repair",
    )
    return os


@pytest.mark.django_db
class TestPollCiliaBudget:

    def test_skips_non_seguradora(self, db):
        person = Person.objects.create(full_name="x", person_type="CLIENT")
        os = ServiceOrder.objects.create(
            os_number="OS-POLL-SKIP-1", customer=person, customer_type="PARTICULAR",
            vehicle_plate="X", vehicle_description="y",
        )
        result = poll_cilia_budget(os.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "not_insurance"

    def test_skips_delivered_os(self, db, os_seguradora):
        os_seguradora.status = "delivered"
        os_seguradora.save()
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "os_closed"

    def test_skips_missing_identifiers(self, db, os_seguradora):
        os_seguradora.casualty_number = ""
        os_seguradora.save()
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "missing_cilia_identifiers"

    def test_skips_no_active_version(self, db, os_seguradora):
        # Sem ServiceOrderVersion
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"] == "no_active_version"

    def test_skips_when_cilia_status_refused(self, db, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="negado",
            external_version="1446508.1",
            raw_payload={"status": "refused"},
        )
        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "skipped"
        assert result["reason"].startswith("cilia_terminal:refused")

    @respx.mock
    def test_404_returns_not_yet(self, setup_cilia, db, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="analisado",
            external_version="1446508.1",
            raw_payload={"status": "analyzed"},
        )
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(404, json={"error": "not found"}))

        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "not_yet"
        assert result["version_number"] == 2

    @respx.mock
    def test_200_creates_version(self, setup_cilia, db, os_seguradora):
        ServiceOrderVersion.objects.create(
            service_order=os_seguradora, version_number=1,
            source="cilia", status="analisado",
            external_version="1446508.1",
            raw_payload={"status": "analyzed"},
        )
        v2 = _load("cilia_1446508_v2.json")
        respx.get(
            "https://test.cilia.local/api/integration/insurer_budgets/by_casualty_number_and_budget_number",
        ).mock(return_value=Response(200, json=v2))

        result = poll_cilia_budget(os_seguradora.pk)
        assert result["action"] == "version_created"
        assert "version_created_id" in result


@pytest.mark.django_db
class TestSyncActiveCiliaOS:

    def test_schedules_only_active_seguradora_os(self, db):
        tokio = Insurer.objects.get(code="tokio")
        person = Person.objects.create(full_name="x", person_type="CLIENT")

        # Elegível
        os1 = ServiceOrder.objects.create(
            os_number="OS-SYNC-1", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="111",
            external_budget_number="222",
            vehicle_plate="A", vehicle_description="x", status="repair",
        )
        # Inelegível — delivered
        ServiceOrder.objects.create(
            os_number="OS-SYNC-2", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="333",
            external_budget_number="444",
            vehicle_plate="B", vehicle_description="y", status="delivered",
        )
        # Inelegível — particular
        ServiceOrder.objects.create(
            os_number="OS-SYNC-3", customer=person, customer_type="PARTICULAR",
            vehicle_plate="C", vehicle_description="z",
        )
        # Inelegível — sem identifiers
        ServiceOrder.objects.create(
            os_number="OS-SYNC-4", customer=person, customer_type="SEGURADORA",
            insurer=tokio, casualty_number="", external_budget_number="",
            vehicle_plate="D", vehicle_description="w",
        )

        with patch("apps.imports.tasks.poll_cilia_budget.delay") as mock_delay:
            result = sync_active_cilia_os()

        assert result["scheduled"] == 1
        mock_delay.assert_called_once_with(os1.pk)
```

- [ ] **Step 5.4: Rodar e commit**

Expected: 218 + 8 = **226 PASS**.

```bash
git add backend/core/
git commit -m "feat(imports): Celery task poll_cilia_budget + sync_active_cilia_os (beat 15min)"
```

---

## Task 6: API endpoints + Frontend + smoke

**Files:**
- Create: `backend/core/apps/imports/serializers.py`
- Create: `backend/core/apps/imports/views.py`
- Create: `backend/core/apps/imports/urls.py`
- Modify: `backend/core/config/urls.py`
- Create: `apps/dscar-web/src/api/imports.ts`
- Create: `apps/dscar-web/src/hooks/useImports.ts`
- Create: `apps/dscar-web/src/schemas/imports.ts`
- Create: `apps/dscar-web/src/components/CiliaImporter/CiliaImporter.tsx`
- Create: `backend/core/scripts/smoke_ciclo4.py`
- Modify: `backend/core/MVP_CHECKLIST.md`

- [ ] **Step 6.1: Serializers**

```python
# apps/imports/serializers.py
from rest_framework import serializers
from .models import ImportAttempt


class ImportAttemptReadSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    trigger_display = serializers.CharField(source="get_trigger_display", read_only=True)

    class Meta:
        model = ImportAttempt
        fields = [
            "id", "source", "source_display", "trigger", "trigger_display",
            "casualty_number", "budget_number", "version_number",
            "http_status", "parsed_ok", "error_message", "error_type",
            "raw_hash", "service_order", "version_created", "duplicate_of",
            "duration_ms", "created_at", "created_by",
        ]


class FetchCiliaSerializer(serializers.Serializer):
    casualty_number = serializers.CharField(max_length=40)
    budget_number = serializers.CharField(max_length=40)
    version_number = serializers.IntegerField(required=False, allow_null=True)
```

- [ ] **Step 6.2: Views**

```python
# apps/imports/views.py
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ImportAttempt
from .serializers import FetchCiliaSerializer, ImportAttemptReadSerializer
from .services import ImportService


class ImportAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportAttempt.objects.all()
    serializer_class = ImportAttemptReadSerializer
    filterset_fields = ["source", "parsed_ok", "http_status", "casualty_number"]
    ordering_fields = ["created_at", "duration_ms"]

    @action(detail=False, methods=["post"], url_path="cilia/fetch")
    def fetch_cilia(self, request):
        """Fetch imediato de um orçamento Cilia (trigger manual)."""
        ser = FetchCiliaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        attempt = ImportService.fetch_cilia_budget(
            casualty_number=ser.validated_data["casualty_number"],
            budget_number=ser.validated_data["budget_number"],
            version_number=ser.validated_data.get("version_number"),
            trigger="user_requested",
            created_by=request.user.username,
        )
        return Response(
            ImportAttemptReadSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )
```

- [ ] **Step 6.3: URLs**

Create `apps/imports/urls.py`:
```python
from rest_framework.routers import DefaultRouter
from .views import ImportAttemptViewSet

router = DefaultRouter()
router.register(r"imports/attempts", ImportAttemptViewSet, basename="import-attempt")
router.register(r"imports", ImportAttemptViewSet, basename="imports-root")  # pro action fetch-cilia em /imports/cilia/fetch/

urlpatterns = router.urls
```

Adicionar em `config/urls.py`: `path("api/v1/", include("apps.imports.urls")),`.

- [ ] **Step 6.4: Frontend — schema + api + hook**

```typescript
// apps/dscar-web/src/schemas/imports.ts
import { z } from 'zod';

export const ImportAttemptSchema = z.object({
  id: z.number(),
  source: z.string(),
  source_display: z.string(),
  trigger: z.string(),
  trigger_display: z.string(),
  casualty_number: z.string(),
  budget_number: z.string(),
  version_number: z.number().nullable(),
  http_status: z.number().nullable(),
  parsed_ok: z.boolean(),
  error_message: z.string(),
  error_type: z.string(),
  raw_hash: z.string(),
  service_order: z.number().nullable(),
  version_created: z.number().nullable(),
  duplicate_of: z.number().nullable(),
  duration_ms: z.number().nullable(),
  created_at: z.string(),
  created_by: z.string(),
});

export type ImportAttempt = z.infer<typeof ImportAttemptSchema>;
```

```typescript
// apps/dscar-web/src/api/imports.ts
import { apiRequest } from './client';
import { ImportAttemptSchema } from '../schemas/imports';
import { PaginatedSchema } from '../schemas/common';
import type { ImportAttempt } from '../schemas/imports';

export async function listAttempts(params: {
  casualty_number?: string;
  parsed_ok?: boolean;
  page?: number;
} = {}): Promise<{ count: number; results: ImportAttempt[] }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const data = await apiRequest<unknown>(`/imports/attempts/?${qs.toString()}`);
  const parsed = PaginatedSchema(ImportAttemptSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function fetchCilia(input: {
  casualty_number: string;
  budget_number: string;
  version_number?: number | null;
}): Promise<ImportAttempt> {
  const data = await apiRequest<unknown>('/imports/cilia/fetch/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return ImportAttemptSchema.parse(data);
}
```

```typescript
// apps/dscar-web/src/hooks/useImports.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/imports';

export function useImportAttempts(params: { casualty_number?: string } = {}) {
  return useQuery({
    queryKey: ['imports', 'attempts', params],
    queryFn: () => api.listAttempts(params),
  });
}

export function useFetchCilia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.fetchCilia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}
```

- [ ] **Step 6.5: Componente CiliaImporter**

```tsx
// apps/dscar-web/src/components/CiliaImporter/CiliaImporter.tsx
import { useState } from 'react';
import { useFetchCilia, useImportAttempts } from '../../hooks/useImports';
import { Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

export function CiliaImporter() {
  const [form, setForm] = useState({ casualty_number: '', budget_number: '', version_number: '' });
  const fetch = useFetchCilia();
  const attempts = useImportAttempts({
    casualty_number: form.casualty_number || undefined,
  });

  const submit = () => {
    fetch.mutate({
      casualty_number: form.casualty_number,
      budget_number: form.budget_number,
      version_number: form.version_number ? parseInt(form.version_number, 10) : null,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Importar Orçamento Cilia</h1>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input
            type="text" value={form.casualty_number}
            onChange={(e) => setForm({ ...form, casualty_number: e.target.value })}
            placeholder="Número do sinistro (ex: 406571903)"
            className="px-3 py-2 border border-slate-300 rounded"
          />
          <input
            type="text" value={form.budget_number}
            onChange={(e) => setForm({ ...form, budget_number: e.target.value })}
            placeholder="Número do orçamento (ex: 1446508)"
            className="px-3 py-2 border border-slate-300 rounded"
          />
          <input
            type="text" value={form.version_number}
            onChange={(e) => setForm({ ...form, version_number: e.target.value })}
            placeholder="Versão (vazio = atual)"
            className="px-3 py-2 border border-slate-300 rounded"
          />
        </div>
        <button
          onClick={submit}
          disabled={fetch.isPending || !form.casualty_number || !form.budget_number}
          className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          <Download size={16} />
          {fetch.isPending ? 'Buscando…' : 'Buscar orçamento'}
        </button>
        {fetch.error && (
          <div className="mt-3 text-sm text-red-600">Erro: {(fetch.error as Error).message}</div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-3">Histórico de importações</h2>

      {attempts.isLoading ? (
        <div className="animate-pulse h-24 bg-slate-200 rounded" />
      ) : attempts.data?.count === 0 ? (
        <div className="text-slate-500 text-center py-8">Nenhuma tentativa registrada.</div>
      ) : (
        <div className="space-y-2">
          {attempts.data?.results.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded p-3 flex items-start gap-3">
              <div className="mt-1">
                {a.parsed_ok ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : a.http_status === 404 ? (
                  <AlertCircle className="text-amber-500" size={20} />
                ) : (
                  <XCircle className="text-red-500" size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-800">
                    Sinistro {a.casualty_number} · Orçamento {a.budget_number}
                    {a.version_number && <span> v{a.version_number}</span>}
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(a.created_at)}</div>
                </div>
                <div className="text-sm text-slate-600">
                  {a.trigger_display} · HTTP {a.http_status || '—'}
                  {a.duration_ms !== null && <> · {a.duration_ms}ms</>}
                </div>
                {a.error_message && (
                  <div className="text-xs text-red-600 mt-1">{a.error_message}</div>
                )}
                {a.version_created && (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ Versão #{a.version_created} criada
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.6: Integrar no App.tsx**

Adicionar view `"cilia-import"` no App.tsx com `<CiliaImporter />`. Adicionar item no Sidebar.

- [ ] **Step 6.7: Smoke script**

Create `backend/core/scripts/smoke_ciclo4.py`:

```python
"""Smoke Ciclo 04 — validar pipeline Cilia live com DB migrado.

Requer: CILIA_AUTH_TOKEN configurado + Insurer.code=tokio seedado + DB migrado.
"""
from apps.imports.services import ImportService


def check(cond, msg):
    print(f"[{'OK' if cond else 'FAIL'}] {msg}")
    assert cond, msg


def main():
    print("=== Smoke Ciclo 04 — Cilia live ===\n")

    # V1 (not_authorized)
    a1 = ImportService.fetch_cilia_budget(
        casualty_number="406571903", budget_number="1446508", version_number=1,
    )
    check(a1.parsed_ok, f"v1 fetched: {a1.error_message or 'OK'}")
    check(a1.version_created.version_number == 1, "v1 is version 1")
    check(a1.version_created.items.count() == 3, "v1 has 3 items")
    os = a1.service_order
    check(os.customer_type == "SEGURADORA", "OS seguradora")
    check(os.insurer.code == "tokio", "Tokio Marine")
    check(os.casualty_number == "406571903", "casualty ok")

    # V2 (authorized)
    a2 = ImportService.fetch_cilia_budget(
        casualty_number="406571903", budget_number="1446508", version_number=2,
    )
    check(a2.parsed_ok, "v2 fetched")
    check(a2.service_order == os, "mesma OS")
    check(a2.version_created.version_number == 2, "v2 is version 2")

    # V3 (404 — não existe)
    a3 = ImportService.fetch_cilia_budget(
        casualty_number="406571903", budget_number="1446508", version_number=3,
    )
    check(not a3.parsed_ok and a3.http_status == 404, "v3 returns 404")

    # Events timeline
    events = os.events.all()
    check(events.filter(event_type="VERSION_CREATED").count() >= 2, "2+ VERSION_CREATED events")
    check(events.filter(event_type="IMPORT_RECEIVED").count() >= 2, "2+ IMPORT_RECEIVED events")

    # Pareceres
    check(os.pareceres.count() >= 2, "2+ pareceres (1 por versão)")
    v1_parecer = os.pareceres.filter(flow_number=1).first()
    v2_parecer = os.pareceres.filter(flow_number=2).first()
    check(v1_parecer and v1_parecer.parecer_type == "NEGADO", "v1 NEGADO")
    check(v2_parecer and v2_parecer.parecer_type == "AUTORIZADO", "v2 AUTORIZADO")

    print(f"\n[DONE] OS {os.os_number} criada com 2 versões Cilia")
    print("⚠ Rode manualmente pra não sujar banco: os.delete()")


main()
```

- [ ] **Step 6.8: Atualizar MVP_CHECKLIST**

```markdown
## Entregue no Ciclo 07 — Importador Cilia

- [x] App `imports` + `ImportAttempt` com auditoria completa
- [x] `CiliaClient` Python (httpx) + fixtures reais de prod
- [x] `CiliaParser` → ParsedBudget DTO (mapeia 32 campos totals + 5 status + 5 conclusion keys)
- [x] `ImportService.fetch_cilia_budget()` com dedup por content_hash + snapshot completo
- [x] `ServiceOrderVersion.raw_payload` + `report_pdf_base64` + `report_html_base64`
- [x] Celery task `poll_cilia_budget` (incremental v+1) + `sync_active_cilia_os` (beat 15min)
- [x] Endpoints `POST /imports/cilia/fetch/` + `GET /imports/attempts/`
- [x] Frontend `CiliaImporter.tsx` + hook `useFetchCilia`
- [x] ~60 testes novos — total ~234 PASS
- [x] Smoke live `scripts/smoke_ciclo4.py` com par real Cilia

## Próximo — Ciclo 04B: XML IFX (Porto/Azul/Itaú)
- [ ] XmlIfxParser (schema unificado IFX/finalizacaoOrcamentoVO)
- [ ] ImportService.import_from_xml_upload
- [ ] Endpoint `/imports/xml/upload/` + frontend dropzone
```

- [ ] **Step 6.9: Commit final**

```bash
git add backend/core/ apps/dscar-web/
git commit -m "feat(imports): API endpoints + frontend CiliaImporter + smoke live"
```

---

## Verificação final Ciclo 04

- [ ] `pytest apps/` passa tudo (~234 PASS)
- [ ] `manage.py check` passa
- [ ] `manage.py makemigrations --check` clean
- [ ] Smoke live roda (requer token + tokio seedado) — confirma OS criada com 2 versões
- [ ] Frontend `npm run build` passa
- [ ] `git log --oneline | head -7` mostra commits Ciclo 04

---

## Notas pro Ciclo 04B (XML IFX)

Com o pipeline `ParsedBudget → ServiceOrderService.create_new_version_from_import` já estável, o 04B é:
- Criar `XmlIfxParser` usando `lxml`
- Mesmo `ImportService` + endpoint `POST /imports/xml/upload/`
- Frontend dropzone no mesmo `CiliaImporter.tsx` (renomear pra `ImportCenter.tsx`)

Fixtures XML já estão em `/Users/thiagocampos/Downloads/` (2 XMLs reais).

**Fim do plano Ciclo 04.**
