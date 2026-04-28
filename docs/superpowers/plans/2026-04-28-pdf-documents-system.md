# PDF Documents System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PDF document generation system for OS documents (OS Report, Warranty, Settlement, Receipt) with editable preview, version history, and audit trail.

**Architecture:** Two-app approach — `pdf_engine` handles pure HTML→PDF rendering with templates/partials, `documents` app handles business logic (data loading, orchestration, versioning, S3 storage). Frontend adds a Documents dropdown in the OS header + editable preview drawer + history section in ClosingTab.

**Tech Stack:** Django 5 + DRF + WeasyPrint, Next.js 15 + TypeScript + TanStack Query v5 + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-28-pdf-documents-system-design.md`

---

## Task 1: Backend — `documents` app scaffold + model

**Files:**
- Create: `backend/core/apps/documents/__init__.py`
- Create: `backend/core/apps/documents/apps.py`
- Create: `backend/core/apps/documents/models.py`
- Create: `backend/core/apps/documents/constants.py`
- Create: `backend/core/apps/documents/migrations/__init__.py`
- Modify: `backend/core/config/settings/base.py:49-80` (add to TENANT_APPS)
- Modify: `backend/core/config/urls.py` (add URL include)

- [ ] **Step 1: Create app scaffold**

Create `backend/core/apps/documents/__init__.py` (empty).

Create `backend/core/apps/documents/apps.py`:

```python
from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.documents"
    verbose_name = "Documentos PDF"
```

- [ ] **Step 2: Create constants**

Create `backend/core/apps/documents/constants.py`:

```python
"""Constantes do módulo de documentos PDF."""

# Prazos de garantia por categoria de serviço (meses)
WARRANTY_MONTHS_BY_CATEGORY: dict[str, int] = {
    "mechanic": 3,
    "bodywork": 6,
    "painting": 6,
    "polishing": 3,
    "washing": 0,
    "aesthetic": 3,
    "default": 3,
}

# Cobertura padrão — editável pelo usuário no drawer antes da geração
DEFAULT_WARRANTY_COVERAGE: list[str] = [
    "Defeitos de execução em funilaria, pintura e montagem originados de falha técnica da DS Car.",
    "Peças instaladas que apresentem defeito de fabricação ou de aplicação durante o período de garantia.",
    "Serviços de pintura: garantia contra descascamento, bolhas ou perda de brilho decorrentes da aplicação.",
]

DEFAULT_WARRANTY_EXCLUSIONS: list[str] = [
    "Danos causados por novo acidente, colisão, vandalismo ou uso indevido do veículo.",
    "Desgaste natural decorrente do uso normal do veículo.",
    "Serviços realizados por terceiros após a entrega sem comunicação prévia à DS Car.",
    "Danos causados por produtos químicos, combustíveis, intempéries ou catástrofes naturais.",
]

# Prefixo S3 para documentos
DOCUMENT_S3_PREFIX = "documents"
```

- [ ] **Step 3: Create model**

Create `backend/core/apps/documents/models.py`:

```python
from __future__ import annotations

import uuid

from django.db import models

from apps.authentication.models import PaddockBaseModel


class DocumentType(models.TextChoices):
    OS_REPORT = "os_report", "Ordem de Serviço"
    WARRANTY = "warranty", "Termo de Garantia"
    SETTLEMENT = "settlement", "Termo de Quitação"
    RECEIPT = "receipt", "Recibo de Pagamento"


class DocumentGeneration(PaddockBaseModel):
    """Registro imutável de cada PDF gerado — auditoria com snapshot JSON."""

    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    version = models.PositiveIntegerField(default=1)

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    receivable = models.ForeignKey(
        "accounts_receivable.ReceivableDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Apenas para recibos",
    )

    data_snapshot = models.JSONField(
        help_text="Dados completos no momento da geração. Permite regerar PDF idêntico."
    )

    s3_key = models.CharField(max_length=500)
    file_size_bytes = models.PositiveIntegerField(null=True, blank=True)

    generated_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="documents_generated",
    )

    class Meta:
        db_table = "documents_generation"
        ordering = ["-created_at"]
        verbose_name = "Documento Gerado"
        verbose_name_plural = "Documentos Gerados"
        indexes = [
            models.Index(
                fields=["service_order", "document_type", "-version"],
                name="idx_doc_so_type_ver",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["service_order", "document_type", "version"],
                name="unique_doc_version",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_document_type_display()} v{self.version}"
            f" — OS #{self.service_order.number}"
        )
```

- [ ] **Step 4: Create migrations init**

Create `backend/core/apps/documents/migrations/__init__.py` (empty).

- [ ] **Step 5: Register in TENANT_APPS**

In `backend/core/config/settings/base.py`, add `"apps.documents",` after `"apps.pdf_engine",` in the `TENANT_APPS` list (around line 73):

```python
    "apps.pdf_engine",
    "apps.documents",
    "apps.items",
```

- [ ] **Step 6: Add URL route**

In `backend/core/config/urls.py`, add before the OIDC line:

```python
    path("api/v1/documents/", include("apps.documents.urls")),
```

Create `backend/core/apps/documents/urls.py` (placeholder — filled in Task 4):

```python
from django.urls import path

urlpatterns = []
```

- [ ] **Step 7: Generate and verify migration**

Run:
```bash
cd backend/core && python manage.py makemigrations documents
```
Expected: `0001_initial.py` created with `DocumentGeneration` model.

Run:
```bash
cd backend/core && python manage.py check
```
Expected: `System check identified no issues.`

- [ ] **Step 8: Commit**

```bash
git add backend/core/apps/documents/ backend/core/config/settings/base.py backend/core/config/urls.py
git commit -m "feat(documents): scaffold app + DocumentGeneration model with versioned snapshots"
```

---

## Task 2: Backend — Logo service + base template upgrade

**Files:**
- Create: `backend/core/apps/pdf_engine/logo.py`
- Modify: `backend/core/apps/pdf_engine/templates/pdf_engine/base.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/watermark.html`

- [ ] **Step 1: Create logo service**

Create `backend/core/apps/pdf_engine/logo.py`:

```python
"""Carrega e cacheia logo DS Car como base64 para uso em templates PDF."""
from __future__ import annotations

import base64
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Logo padrão: apps/dscar-web/public/dscar-logo.png
# Em produção, pode estar em S3 ou MEDIA_ROOT.
# Fallback: caminho relativo ao repositório.
_LOGO_CANDIDATES = [
    Path(__file__).resolve().parents[4] / "apps" / "dscar-web" / "public" / "dscar-logo.png",
]


@lru_cache(maxsize=1)
def get_logo_base64() -> str:
    """Retorna logo DS Car como data URI base64 (PNG).

    Returns:
        String no formato 'data:image/png;base64,...' pronta para uso em <img src>.
        Se logo não encontrada, retorna string vazia.
    """
    for path in _LOGO_CANDIDATES:
        if path.exists():
            data = path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            logger.info("Logo PDF carregada de %s (%d bytes)", path, len(data))
            return f"data:image/png;base64,{b64}"

    logger.warning("Logo DS Car não encontrada em nenhum caminho candidato.")
    return ""
```

- [ ] **Step 2: Create watermark partial**

Create directory and file `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/watermark.html`:

```html
{# Marca d'água com logo DS Car — incluir no base.html #}
{% if logo_base64 %}
<div style="
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    opacity: 0.06;
    z-index: -1;
    pointer-events: none;
">
    <img src="{{ logo_base64 }}" style="width: 400px; height: auto;" />
</div>
{% endif %}
```

- [ ] **Step 3: Update base template**

Replace entire content of `backend/core/apps/pdf_engine/templates/pdf_engine/base.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}Documento DS Car{% endblock %}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
            @bottom-center {
                content: "Documento gerado pelo ERP Paddock Solutions · DS Car © {% now 'Y' %}";
                font-size: 8px;
                color: #9ca3af;
                font-family: Arial, sans-serif;
            }
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #1f2937;
            line-height: 1.5;
        }

        /* ── Header ────────────────────────────────────── */
        .doc-header {
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 3px solid #dc2626;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .doc-header img {
            height: 48px;
            width: auto;
        }
        .doc-header-info {
            flex: 1;
        }
        .doc-header-info h1 {
            color: #dc2626;
            margin: 0;
            font-size: 18px;
            font-weight: 700;
        }
        .doc-header-info p {
            margin: 2px 0;
            color: #6b7280;
            font-size: 9px;
        }

        /* ── Sections ──────────────────────────────────── */
        .section {
            margin-bottom: 18px;
        }
        .section-title {
            color: #1f2937;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
        }
        .section-number {
            color: #dc2626;
            margin-right: 6px;
        }

        /* ── Tables ────────────────────────────────────── */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
        }
        th, td {
            text-align: left;
            padding: 5px 8px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 10px;
        }
        th {
            background-color: #f9fafb;
            color: #4b5563;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background-color: #fafafa;
        }

        /* ── Totals ────────────────────────────────────── */
        .totals {
            margin-top: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 12px;
            background: #f9fafb;
        }
        .totals table {
            margin: 0;
        }
        .totals td {
            border: none;
            padding: 3px 8px;
        }
        .total-row {
            font-weight: 700;
            font-size: 13px;
            color: #dc2626;
            border-top: 2px solid #1f2937;
            padding-top: 6px;
            margin-top: 6px;
        }
        .total-row td {
            padding-top: 8px;
        }

        /* ── Utilities ─────────────────────────────────── */
        .right { text-align: right; }
        .muted { color: #6b7280; }
        .small { font-size: 9px; }
        .bold { font-weight: 700; }

        /* ── Info grid (2 cols) ─────────────────────────── */
        .info-grid {
            display: table;
            width: 100%;
            margin: 4px 0;
        }
        .info-row {
            display: table-row;
        }
        .info-label {
            display: table-cell;
            width: 35%;
            padding: 3px 8px;
            font-size: 9px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            font-weight: 600;
            vertical-align: top;
        }
        .info-value {
            display: table-cell;
            padding: 3px 8px;
            font-size: 10px;
            color: #1f2937;
        }

        /* ── Signature block ───────────────────────────── */
        .signatures {
            margin-top: 40px;
            display: flex;
            gap: 40px;
        }
        .sig-col {
            flex: 1;
            text-align: center;
        }
        .sig-line {
            border-top: 1px solid #1f2937;
            margin-top: 60px;
            padding-top: 6px;
        }
        .sig-name {
            font-size: 10px;
            font-weight: 600;
            color: #1f2937;
        }
        .sig-detail {
            font-size: 9px;
            color: #6b7280;
        }

        /* ── Check lists (warranty) ────────────────────── */
        .check-list {
            list-style: none;
            padding: 0;
            margin: 6px 0;
        }
        .check-list li {
            padding: 3px 0 3px 20px;
            position: relative;
            font-size: 10px;
        }
        .check-list li::before {
            position: absolute;
            left: 0;
            font-weight: 700;
        }
        .check-list.coverage li::before {
            content: "✔";
            color: #16a34a;
        }
        .check-list.exclusions li::before {
            content: "✘";
            color: #dc2626;
        }

        {% block extra_styles %}{% endblock %}
    </style>
</head>
<body>
    {# Marca d'água #}
    {% include "pdf_engine/_partials/watermark.html" %}

    {# Header #}
    <div class="doc-header">
        {% if logo_base64 %}
        <img src="{{ logo_base64 }}" alt="DS Car" />
        {% endif %}
        <div class="doc-header-info">
            <h1>{{ company.razao_social|default:"DS Car Centro Automotivo" }}</h1>
            <p>
                CNPJ: {{ company.cnpj_formatted|default:"" }}
                {% if company.ie %} · IE: {{ company.ie }}{% endif %}
                {% if company.endereco_linha %} · {{ company.endereco_linha }}{% endif %}
            </p>
            <p>
                {% if company.telefone %}{{ company.telefone }} · {% endif %}
                {% if company.email %}{{ company.email }}{% endif %}
            </p>
        </div>
    </div>

    {% block content %}{% endblock %}
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/pdf_engine/logo.py backend/core/apps/pdf_engine/templates/
git commit -m "feat(pdf_engine): logo base64 service + base template with header/watermark/styles"
```

---

## Task 3: Backend — Template partials + document templates

**Files:**
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/customer_info.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/vehicle_info.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/services_table.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/parts_table.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/totals_block.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/signature_block.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/os_report.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/warranty.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/settlement.html`
- Create: `backend/core/apps/pdf_engine/templates/pdf_engine/receipt.html`

- [ ] **Step 1: Create customer_info partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/customer_info.html`:

```html
{# Bloco de dados do cliente — recebe variável 'customer' no contexto #}
<div class="info-grid">
    <div class="info-row">
        <span class="info-label">Nome completo</span>
        <span class="info-value bold">{{ customer.name|default:"—" }}</span>
    </div>
    {% if customer.cpf %}
    <div class="info-row">
        <span class="info-label">CPF</span>
        <span class="info-value">{{ customer.cpf }}</span>
    </div>
    {% endif %}
    {% if customer.cnpj %}
    <div class="info-row">
        <span class="info-label">CNPJ</span>
        <span class="info-value">{{ customer.cnpj }}</span>
    </div>
    {% endif %}
    {% if customer.rg %}
    <div class="info-row">
        <span class="info-label">RG</span>
        <span class="info-value">{{ customer.rg }}</span>
    </div>
    {% endif %}
    {% if customer.phone %}
    <div class="info-row">
        <span class="info-label">Telefone</span>
        <span class="info-value">{{ customer.phone }}</span>
    </div>
    {% endif %}
    {% if customer.email %}
    <div class="info-row">
        <span class="info-label">E-mail</span>
        <span class="info-value">{{ customer.email }}</span>
    </div>
    {% endif %}
    {% if customer.address %}
    <div class="info-row">
        <span class="info-label">Endereço</span>
        <span class="info-value">{{ customer.address }}</span>
    </div>
    {% endif %}
</div>
```

- [ ] **Step 2: Create vehicle_info partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/vehicle_info.html`:

```html
{# Bloco de dados do veículo — recebe variável 'vehicle' no contexto #}
<table>
    <thead>
        <tr>
            <th>Marca / Modelo</th>
            <th>Ano</th>
            <th>Cor</th>
            <th>Placa</th>
            <th>Chassi</th>
            <th>KM Entrada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="bold">{{ vehicle.make|default:"" }} {{ vehicle.model|default:"—" }}</td>
            <td>{{ vehicle.year|default:"—" }}</td>
            <td>{{ vehicle.color|default:"—" }}</td>
            <td class="bold">{{ vehicle.plate|default:"—" }}</td>
            <td style="font-size: 9px;">{{ vehicle.chassis|default:"—" }}</td>
            <td>{% if vehicle.mileage_in %}{{ vehicle.mileage_in|floatformat:0 }} km{% else %}—{% endif %}</td>
        </tr>
    </tbody>
</table>
```

- [ ] **Step 3: Create services_table partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/services_table.html`:

```html
{# Tabela de serviços — recebe variável 'services' (list of dicts) #}
{% if services %}
<table>
    <thead>
        <tr>
            <th style="width: 30px;">Nº</th>
            <th>Descrição do Serviço</th>
            <th class="right" style="width: 50px;">Qtd.</th>
            <th class="right" style="width: 90px;">Valor (R$)</th>
        </tr>
    </thead>
    <tbody>
        {% for s in services %}
        <tr>
            <td>{{ forloop.counter|stringformat:"02d" }}</td>
            <td>{{ s.description }}</td>
            <td class="right">{{ s.quantity }}</td>
            <td class="right bold">R$ {{ s.total|floatformat:2 }}</td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% else %}
<p class="muted small">Nenhum serviço registrado.</p>
{% endif %}
```

- [ ] **Step 4: Create parts_table partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/parts_table.html`:

```html
{# Tabela de peças — recebe variável 'parts' (list of dicts) #}
{% if parts %}
<table>
    <thead>
        <tr>
            <th style="width: 30px;">Nº</th>
            <th>Descrição</th>
            <th style="width: 80px;">Código</th>
            <th class="right" style="width: 50px;">Qtd.</th>
            <th class="right" style="width: 90px;">Valor (R$)</th>
        </tr>
    </thead>
    <tbody>
        {% for p in parts %}
        <tr>
            <td>{{ forloop.counter|stringformat:"02d" }}</td>
            <td>{{ p.description }}</td>
            <td class="small muted">{{ p.part_number|default:"—" }}</td>
            <td class="right">{{ p.quantity }}</td>
            <td class="right bold">R$ {{ p.total|floatformat:2 }}</td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% else %}
<p class="muted small">Nenhuma peça registrada.</p>
{% endif %}
```

- [ ] **Step 5: Create totals_block partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/totals_block.html`:

```html
{# Bloco de totais — recebe variável 'totals' com keys: parts, services, discount, grand_total #}
<div class="totals">
    <table>
        <tr>
            <td>Peças</td>
            <td class="right">R$ {{ totals.parts|floatformat:2 }}</td>
        </tr>
        <tr>
            <td>Serviços / Mão de obra</td>
            <td class="right">R$ {{ totals.services|floatformat:2 }}</td>
        </tr>
        {% if totals.discount and totals.discount != "0.00" %}
        <tr>
            <td>Desconto</td>
            <td class="right" style="color: #dc2626;">− R$ {{ totals.discount|floatformat:2 }}</td>
        </tr>
        {% endif %}
        <tr class="total-row">
            <td>TOTAL GERAL</td>
            <td class="right">R$ {{ totals.grand_total|floatformat:2 }}</td>
        </tr>
    </table>
</div>
```

- [ ] **Step 6: Create signature_block partial**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/_partials/signature_block.html`:

```html
{# Bloco de assinaturas — recebe 'customer' e 'company' no contexto #}
{# Também recebe 'location_date' (ex: "Manaus (AM), 28 de abril de 2026.") #}
<div class="signatures">
    <div class="sig-col">
        <div class="sig-line">
            <p class="sig-name">{{ customer.name|default:"Cliente" }}</p>
            <p class="sig-detail">
                {% if customer.cpf %}CPF: {{ customer.cpf }} — {% endif %}Cliente
            </p>
        </div>
    </div>
    <div class="sig-col">
        <div class="sig-line">
            <p class="sig-name">{{ company.razao_social|default:"DS Car Centro Automotivo" }}</p>
            <p class="sig-detail">
                {% if company.cnpj_formatted %}CNPJ: {{ company.cnpj_formatted }} — {% endif %}Prestadora
            </p>
        </div>
    </div>
</div>
{% if location_date %}
<p class="muted small" style="text-align: center; margin-top: 20px;">{{ location_date }}</p>
{% endif %}
```

- [ ] **Step 7: Create os_report template**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/os_report.html`:

```html
{% extends "pdf_engine/base.html" %}

{% block title %}OS #{{ order.number }} — Relatório{% endblock %}

{% block content %}
    {# 1. Cliente #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">1.</span>Dados do Cliente</h2>
        {% include "pdf_engine/_partials/customer_info.html" %}
    </div>

    {# 2. Veículo #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">2.</span>Dados do Veículo</h2>
        {% include "pdf_engine/_partials/vehicle_info.html" %}
    </div>

    {# 3. Seguradora (se houver) #}
    {% if insurer %}
    <div class="section">
        <h2 class="section-title"><span class="section-number">3.</span>Seguradora</h2>
        <div class="info-grid">
            <div class="info-row">
                <span class="info-label">Seguradora</span>
                <span class="info-value bold">{{ insurer.name }}</span>
            </div>
            {% if insurer.casualty_number %}
            <div class="info-row">
                <span class="info-label">Nº Sinistro</span>
                <span class="info-value">{{ insurer.casualty_number }}</span>
            </div>
            {% endif %}
            {% if insurer.insured_type %}
            <div class="info-row">
                <span class="info-label">Tipo</span>
                <span class="info-value">{{ insurer.insured_type }}</span>
            </div>
            {% endif %}
            {% if insurer.deductible_amount %}
            <div class="info-row">
                <span class="info-label">Franquia</span>
                <span class="info-value">R$ {{ insurer.deductible_amount|floatformat:2 }}</span>
            </div>
            {% endif %}
        </div>
    </div>
    {% endif %}

    {# 4. Serviços #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">{% if insurer %}4{% else %}3{% endif %}.</span>Serviços Realizados</h2>
        {% include "pdf_engine/_partials/services_table.html" %}
    </div>

    {# 5. Peças #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">{% if insurer %}5{% else %}4{% endif %}.</span>Peças Utilizadas</h2>
        {% include "pdf_engine/_partials/parts_table.html" %}
    </div>

    {# 6. Totais #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">{% if insurer %}6{% else %}5{% endif %}.</span>Totais</h2>
        {% include "pdf_engine/_partials/totals_block.html" %}
    </div>

    {# 7. Observações #}
    {% if observations %}
    <div class="section">
        <h2 class="section-title"><span class="section-number">{% if insurer %}7{% else %}6{% endif %}.</span>Observações</h2>
        <p style="font-size: 10px;">{{ observations }}</p>
    </div>
    {% endif %}
{% endblock %}
```

- [ ] **Step 8: Create warranty template**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/warranty.html`:

```html
{% extends "pdf_engine/base.html" %}

{% block title %}Termo de Garantia — OS #{{ order.number }}{% endblock %}

{% block content %}
    {# 1. Cliente #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">1.</span>Dados do Cliente</h2>
        {% include "pdf_engine/_partials/customer_info.html" %}
    </div>

    {# 2. Veículo #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">2.</span>Dados do Veículo</h2>
        {% include "pdf_engine/_partials/vehicle_info.html" %}
    </div>

    {# 3. Serviços + Garantia por item #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">3.</span>Serviços Realizados e Prazos de Garantia</h2>
        {% if services %}
        <table>
            <thead>
                <tr>
                    <th style="width: 30px;">Nº</th>
                    <th>Descrição do Serviço</th>
                    <th class="right" style="width: 50px;">Qtd.</th>
                    <th class="right" style="width: 90px;">Valor (R$)</th>
                    <th style="width: 60px;">Garantia</th>
                    <th style="width: 85px;">Válida até</th>
                </tr>
            </thead>
            <tbody>
                {% for s in services %}
                <tr>
                    <td>{{ forloop.counter|stringformat:"02d" }}</td>
                    <td>{{ s.description }}</td>
                    <td class="right">{{ s.quantity }}</td>
                    <td class="right bold">R$ {{ s.total|floatformat:2 }}</td>
                    <td>{{ s.warranty_months }} meses</td>
                    <td class="bold">{{ s.warranty_until|default:"—" }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        {% endif %}
    </div>

    {# 4. Cobertura #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">4.</span>Cobertura da Garantia</h2>
        <ul class="check-list coverage">
            {% for item in warranty_coverage %}
            <li>{{ item }}</li>
            {% endfor %}
        </ul>
    </div>

    {# 5. Exclusões #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">5.</span>Exclusões da Garantia</h2>
        <ul class="check-list exclusions">
            {% for item in warranty_exclusions %}
            <li>{{ item }}</li>
            {% endfor %}
        </ul>
    </div>

    {# 6. Como acionar #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">6.</span>Como Acionar a Garantia</h2>
        <p style="font-size: 10px;">
            Para acionar a garantia, entre em contato via WhatsApp
            {% if company.telefone %}({{ company.telefone }}){% endif %}
            ou compareça presencialmente à nossa unidade, apresentando este documento.
        </p>
    </div>

    {# 7. Assinaturas #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">7.</span>Assinaturas</h2>
        <p style="font-size: 9px; color: #4b5563; margin-bottom: 10px;">
            Eu, {{ customer.name|default:"" }}, declaro que li e compreendi todos os termos
            deste documento, que recebi o veículo em perfeito estado de conservação e que
            efetuo minha assinatura em plena concordância com as condições aqui estabelecidas.
        </p>
        {% include "pdf_engine/_partials/signature_block.html" %}
    </div>
{% endblock %}
```

- [ ] **Step 9: Create settlement template**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/settlement.html`:

```html
{% extends "pdf_engine/base.html" %}

{% block title %}Termo de Quitação — OS #{{ order.number }}{% endblock %}

{% block content %}
    {# 1. Cliente #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">1.</span>Dados do Cliente</h2>
        {% include "pdf_engine/_partials/customer_info.html" %}
    </div>

    {# 2. Veículo #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">2.</span>Dados do Veículo</h2>
        {% include "pdf_engine/_partials/vehicle_info.html" %}
    </div>

    {# 3. Serviços #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">3.</span>Serviços Realizados</h2>
        {% include "pdf_engine/_partials/services_table.html" %}
    </div>

    {# 4. Pagamento #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">4.</span>Forma de Pagamento e Quitação</h2>
        <div class="info-grid">
            <div class="info-row">
                <span class="info-label">Forma de pagamento</span>
                <span class="info-value bold">{{ payment.method_display|default:payment.method }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Valor pago</span>
                <span class="info-value bold">R$ {{ payment.amount|floatformat:2 }}{% if payment.amount_words %} ({{ payment.amount_words }}){% endif %}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Data do pagamento</span>
                <span class="info-value">{{ payment.date|default:"—" }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status</span>
                <span class="info-value bold" style="color: #16a34a;">QUITADO — sem pendências financeiras</span>
            </div>
        </div>
    </div>

    {# 5. Declaração #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">5.</span>Declaração de Quitação</h2>
        <p style="font-size: 10px; text-align: justify; line-height: 1.6;">
            Por meio do presente instrumento, o cliente <strong>{{ customer.name|default:"" }}</strong>,
            {% if customer.cpf %}portador do CPF {{ customer.cpf }},{% endif %}
            declara ter recebido o veículo
            <strong>{{ vehicle.make|default:"" }} {{ vehicle.model|default:"" }}</strong>,
            placa <strong>{{ vehicle.plate|default:"" }}</strong>,
            em perfeitas condições, após a execução de todos os serviços contratados,
            e que o valor total de <strong>R$ {{ payment.amount|floatformat:2 }}</strong>
            {% if payment.amount_words %}({{ payment.amount_words }}){% endif %}
            foi integralmente pago, dando plena e irrevogável quitação à
            <strong>{{ company.razao_social|default:"DS Car Centro Automotivo" }}</strong>.
        </p>
    </div>

    {# 6. Assinaturas #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">6.</span>Assinaturas</h2>
        {% include "pdf_engine/_partials/signature_block.html" %}
    </div>
{% endblock %}
```

- [ ] **Step 10: Create receipt template**

Create `backend/core/apps/pdf_engine/templates/pdf_engine/receipt.html`:

```html
{% extends "pdf_engine/base.html" %}

{% block title %}Recibo — OS #{{ order.number }}{% endblock %}

{% block content %}
    {# 1. Pagador #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">1.</span>Dados do Pagador</h2>
        {% include "pdf_engine/_partials/customer_info.html" %}
    </div>

    {# 2. Referência #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">2.</span>Referência</h2>
        <div class="info-grid">
            <div class="info-row">
                <span class="info-label">Ordem de Serviço</span>
                <span class="info-value bold">#{{ order.number }}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Descrição</span>
                <span class="info-value">{{ receipt.description|default:"Serviços automotivos" }}</span>
            </div>
            {% if receipt.receivable_description %}
            <div class="info-row">
                <span class="info-label">Título</span>
                <span class="info-value">{{ receipt.receivable_description }}</span>
            </div>
            {% endif %}
        </div>
    </div>

    {# 3. Valor #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">3.</span>Valor Recebido</h2>
        <div class="totals">
            <table>
                <tr>
                    <td>Forma de pagamento</td>
                    <td class="right bold">{{ payment.method_display|default:payment.method }}</td>
                </tr>
                <tr>
                    <td>Data do pagamento</td>
                    <td class="right">{{ payment.date|default:"—" }}</td>
                </tr>
                <tr class="total-row">
                    <td>VALOR RECEBIDO</td>
                    <td class="right">R$ {{ payment.amount|floatformat:2 }}</td>
                </tr>
            </table>
        </div>
    </div>

    {# 4. Declaração #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">4.</span>Declaração de Recebimento</h2>
        <p style="font-size: 10px; text-align: justify; line-height: 1.6;">
            Declaro que recebi de <strong>{{ customer.name|default:"" }}</strong>
            a quantia de <strong>R$ {{ payment.amount|floatformat:2 }}</strong>
            {% if payment.amount_words %}({{ payment.amount_words }}){% endif %}
            referente aos serviços prestados na OS #{{ order.number }}.
        </p>
    </div>

    {# 5. Assinatura (apenas DS Car) #}
    <div class="section">
        <h2 class="section-title"><span class="section-number">5.</span>Assinatura</h2>
        <div style="width: 50%; margin: 0 auto; text-align: center;">
            <div class="sig-line" style="margin-top: 60px;">
                <p class="sig-name">{{ company.razao_social|default:"DS Car Centro Automotivo" }}</p>
                <p class="sig-detail">
                    {% if company.cnpj_formatted %}CNPJ: {{ company.cnpj_formatted }}{% endif %}
                </p>
            </div>
        </div>
        {% if location_date %}
        <p class="muted small" style="text-align: center; margin-top: 20px;">{{ location_date }}</p>
        {% endif %}
    </div>
{% endblock %}
```

- [ ] **Step 11: Commit**

```bash
git add backend/core/apps/pdf_engine/templates/pdf_engine/_partials/ backend/core/apps/pdf_engine/templates/pdf_engine/os_report.html backend/core/apps/pdf_engine/templates/pdf_engine/warranty.html backend/core/apps/pdf_engine/templates/pdf_engine/settlement.html backend/core/apps/pdf_engine/templates/pdf_engine/receipt.html
git commit -m "feat(pdf_engine): template partials + 4 document templates (OS/warranty/settlement/receipt)"
```

---

## Task 4: Backend — Data loaders + DocumentService + serializers + views

**Files:**
- Create: `backend/core/apps/documents/data_loaders.py`
- Create: `backend/core/apps/documents/services.py`
- Create: `backend/core/apps/documents/serializers.py`
- Create: `backend/core/apps/documents/views.py`
- Modify: `backend/core/apps/documents/urls.py`
- Modify: `backend/core/apps/pdf_engine/services.py`

- [ ] **Step 1: Create data loaders**

Create `backend/core/apps/documents/data_loaders.py`:

```python
"""Funções que buscam e formatam dados de OS para templates PDF."""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from dateutil.relativedelta import relativedelta
from django.utils import timezone

from apps.documents.constants import (
    DEFAULT_WARRANTY_COVERAGE,
    DEFAULT_WARRANTY_EXCLUSIONS,
    WARRANTY_MONTHS_BY_CATEGORY,
)
from apps.pdf_engine.logo import get_logo_base64

logger = logging.getLogger(__name__)


def _fmt_cnpj(cnpj: str) -> str:
    """Formata CNPJ: 12345678000199 → 12.345.678/0001-99."""
    c = cnpj.replace(".", "").replace("/", "").replace("-", "")
    if len(c) == 14:
        return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"
    return cnpj


def _format_date_br(d: date | str | None) -> str:
    """Formata data para DD/MM/YYYY."""
    if d is None:
        return "—"
    if isinstance(d, str):
        try:
            d = date.fromisoformat(d)
        except ValueError:
            return d
    return d.strftime("%d/%m/%Y")


def _location_date_str() -> str:
    """Retorna 'Manaus (AM), DD de mês de AAAA.'"""
    now = timezone.localtime()
    meses = [
        "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ]
    return f"Manaus (AM), {now.day} de {meses[now.month]} de {now.year}."


class OSDataLoader:
    """Busca dados de OS e formata para templates PDF."""

    @staticmethod
    def _load_order(order_id: UUID) -> Any:
        """Busca OS com relações otimizadas."""
        from apps.service_orders.models import ServiceOrder

        return (
            ServiceOrder.objects
            .select_related("insurer", "consultant")
            .prefetch_related("parts", "labor_items")
            .get(pk=order_id, is_active=True)
        )

    @staticmethod
    def load_company_info() -> dict[str, Any]:
        """Dados empresa via FiscalConfig + logo base64."""
        from apps.fiscal.models import FiscalConfigModel

        config = FiscalConfigModel.objects.filter(is_active=True).first()
        if not config:
            return {
                "razao_social": "DS Car Centro Automotivo",
                "cnpj_formatted": "",
                "ie": "",
                "endereco_linha": "",
                "telefone": "",
                "email": "",
            }

        endereco = config.endereco or {}
        endereco_parts = [
            endereco.get("logradouro", ""),
            endereco.get("numero", ""),
            endereco.get("bairro", ""),
            endereco.get("municipio", ""),
            endereco.get("uf", ""),
        ]
        endereco_linha = ", ".join(p for p in endereco_parts if p)
        cep = endereco.get("cep", "")
        if cep:
            endereco_linha += f" — CEP {cep}"

        return {
            "razao_social": config.razao_social or config.nome_fantasia or "DS Car Centro Automotivo",
            "cnpj_formatted": _fmt_cnpj(config.cnpj) if config.cnpj else "",
            "ie": config.inscricao_estadual or "",
            "endereco_linha": endereco_linha,
            "telefone": endereco.get("telefone", ""),
            "email": endereco.get("email", ""),
        }

    @staticmethod
    def _customer_dict(order: Any) -> dict[str, Any]:
        """Extrai dados do cliente da OS."""
        return {
            "name": order.customer_name or "",
            "cpf": "",
            "cnpj": "",
            "rg": "",
            "phone": "",
            "email": "",
            "address": "",
        }

    @staticmethod
    def _vehicle_dict(order: Any) -> dict[str, Any]:
        """Extrai dados do veículo da OS."""
        return {
            "make": order.make or "",
            "model": order.model or "",
            "year": order.year or "",
            "color": order.color or "",
            "plate": order.plate or "",
            "chassis": order.chassis or "",
            "mileage_in": order.mileage_in,
        }

    @staticmethod
    def _services_list(order: Any) -> list[dict[str, Any]]:
        """Extrai lista de serviços da OS."""
        items = []
        for labor in order.labor_items.filter(is_active=True):
            items.append({
                "description": labor.description,
                "quantity": str(labor.quantity),
                "unit_price": str(labor.unit_price),
                "total": str(labor.total),
                "category": getattr(labor, "category", "default"),
            })
        return items

    @staticmethod
    def _parts_list(order: Any) -> list[dict[str, Any]]:
        """Extrai lista de peças da OS."""
        items = []
        for part in order.parts.filter(is_active=True):
            items.append({
                "description": part.description,
                "part_number": part.part_number or "",
                "quantity": str(part.quantity),
                "unit_price": str(part.unit_price),
                "total": str(part.total),
            })
        return items

    @staticmethod
    def _totals_dict(order: Any) -> dict[str, str]:
        """Extrai totais da OS."""
        parts = Decimal(str(order.parts_total or 0))
        services = Decimal(str(order.services_total or 0))
        discount = Decimal(str(order.discount_total or 0))
        grand_total = parts + services - discount
        return {
            "parts": str(parts),
            "services": str(services),
            "discount": str(discount),
            "grand_total": str(grand_total),
        }

    @classmethod
    def load_os_report(cls, order_id: UUID) -> dict[str, Any]:
        """OS completa: cliente, veículo, peças, serviços, totais, seguradora."""
        order = cls._load_order(order_id)
        company = cls.load_company_info()

        data: dict[str, Any] = {
            "company": company,
            "logo_base64": get_logo_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": cls._services_list(order),
            "parts": cls._parts_list(order),
            "totals": cls._totals_dict(order),
            "observations": "",
            "location_date": _location_date_str(),
        }

        # Seguradora
        if order.customer_type == "insurer" and order.insurer:
            data["insurer"] = {
                "name": getattr(order.insurer, "display_name", None) or order.insurer.name or "",
                "casualty_number": order.casualty_number or "",
                "insured_type": order.get_insured_type_display() if order.insured_type else "",
                "deductible_amount": str(order.deductible_amount) if order.deductible_amount else "",
            }

        return data

    @classmethod
    def load_warranty(cls, order_id: UUID) -> dict[str, Any]:
        """Garantia: serviços + prazo individual por categoria."""
        order = cls._load_order(order_id)
        company = cls.load_company_info()

        delivery_date = order.delivered_at or order.client_delivery_date or timezone.now()
        if isinstance(delivery_date, str):
            delivery_date = date.fromisoformat(delivery_date)
        if hasattr(delivery_date, "date"):
            delivery_date = delivery_date.date()

        services = cls._services_list(order)
        for svc in services:
            category = svc.get("category", "default")
            months = WARRANTY_MONTHS_BY_CATEGORY.get(
                category, WARRANTY_MONTHS_BY_CATEGORY["default"]
            )
            svc["warranty_months"] = months
            if months > 0:
                svc["warranty_until"] = _format_date_br(
                    delivery_date + relativedelta(months=months)
                )
            else:
                svc["warranty_until"] = "Sem garantia"

        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": services,
            "totals": cls._totals_dict(order),
            "warranty_coverage": list(DEFAULT_WARRANTY_COVERAGE),
            "warranty_exclusions": list(DEFAULT_WARRANTY_EXCLUSIONS),
            "observations": "",
            "location_date": _location_date_str(),
        }

    @classmethod
    def load_settlement(cls, order_id: UUID) -> dict[str, Any]:
        """Quitação: OS + receivables pagos + forma pagamento."""
        order = cls._load_order(order_id)
        company = cls.load_company_info()

        # Busca receivables vinculados à OS
        from apps.accounts_receivable.models import ReceivableDocument

        receivables = list(
            ReceivableDocument.objects.filter(
                service_order_id=str(order.pk),
                is_active=True,
            ).order_by("-created_at")
        )

        total_paid = sum(Decimal(str(r.amount)) for r in receivables)
        payment_method = ""
        payment_date = ""
        if receivables:
            first = receivables[0]
            payment_method = getattr(first, "payment_method", "") or ""
            payment_date = _format_date_br(
                getattr(first, "paid_at", None) or first.created_at
            )

        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "vehicle": cls._vehicle_dict(order),
            "services": cls._services_list(order),
            "totals": cls._totals_dict(order),
            "payment": {
                "method": payment_method,
                "method_display": payment_method,
                "amount": str(total_paid),
                "amount_words": "",
                "date": payment_date,
                "status": "paid",
            },
            "observations": "",
            "location_date": _location_date_str(),
        }

    @classmethod
    def load_receipt(cls, order_id: UUID, receivable_id: UUID) -> dict[str, Any]:
        """Recibo individual de um pagamento."""
        order = cls._load_order(order_id)
        company = cls.load_company_info()

        from apps.accounts_receivable.models import ReceivableDocument

        receivable = ReceivableDocument.objects.get(
            pk=receivable_id, is_active=True,
        )

        return {
            "company": company,
            "logo_base64": get_logo_base64(),
            "order": {"number": order.number},
            "customer": cls._customer_dict(order),
            "receipt": {
                "description": receivable.description or "Serviços automotivos",
                "receivable_description": receivable.description or "",
            },
            "payment": {
                "method": getattr(receivable, "payment_method", "") or "",
                "method_display": getattr(receivable, "payment_method", "") or "",
                "amount": str(receivable.amount),
                "amount_words": "",
                "date": _format_date_br(
                    getattr(receivable, "paid_at", None) or receivable.created_at
                ),
            },
            "location_date": _location_date_str(),
        }
```

- [ ] **Step 2: Update PDFService with generic render method**

In `backend/core/apps/pdf_engine/services.py`, add a new method after `render_html`:

```python
    @classmethod
    def render_document(cls, document_type: str, context: dict[str, Any]) -> bytes:
        """Renderiza documento PDF por tipo.

        Args:
            document_type: um de 'os_report', 'warranty', 'settlement', 'receipt'.
            context: dict completo de contexto (já inclui company, logo_base64, etc).

        Returns:
            bytes do PDF (WeasyPrint) ou bytes do HTML (fallback).
        """
        template_map = {
            "os_report": "pdf_engine/os_report.html",
            "warranty": "pdf_engine/warranty.html",
            "settlement": "pdf_engine/settlement.html",
            "receipt": "pdf_engine/receipt.html",
        }
        template_name = template_map.get(document_type)
        if not template_name:
            raise ValueError(f"Tipo de documento desconhecido: {document_type}")

        return cls.render_html(template_name, context)
```

- [ ] **Step 3: Create DocumentService**

Create `backend/core/apps/documents/services.py`:

```python
"""Orquestra preview → validação → render → S3 → audit."""
from __future__ import annotations

import logging
import uuid
from typing import Any
from uuid import UUID

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max

from apps.documents.constants import DOCUMENT_S3_PREFIX
from apps.documents.data_loaders import OSDataLoader
from apps.documents.models import DocumentGeneration, DocumentType
from apps.pdf_engine.services import PDFService

logger = logging.getLogger(__name__)

# Mapa de loaders por tipo de documento
_PREVIEW_LOADERS = {
    DocumentType.OS_REPORT: lambda oid, **kw: OSDataLoader.load_os_report(oid),
    DocumentType.WARRANTY: lambda oid, **kw: OSDataLoader.load_warranty(oid),
    DocumentType.SETTLEMENT: lambda oid, **kw: OSDataLoader.load_settlement(oid),
    DocumentType.RECEIPT: lambda oid, **kw: OSDataLoader.load_receipt(oid, kw["receivable_id"]),
}


class DocumentService:
    """Orquestra geração de documentos PDF com auditoria."""

    @classmethod
    def preview(
        cls,
        order_id: UUID,
        document_type: str,
        receivable_id: UUID | None = None,
    ) -> dict[str, Any]:
        """Monta dados pré-preenchidos para o drawer de edição."""
        loader = _PREVIEW_LOADERS.get(document_type)
        if not loader:
            raise ValueError(f"Tipo de documento desconhecido: {document_type}")

        kwargs: dict[str, Any] = {}
        if receivable_id:
            kwargs["receivable_id"] = receivable_id

        return loader(order_id, **kwargs)

    @classmethod
    @transaction.atomic
    def generate(
        cls,
        order_id: UUID,
        document_type: str,
        data: dict[str, Any],
        user: Any,
        receivable_id: UUID | None = None,
    ) -> DocumentGeneration:
        """Gera PDF, salva no S3, cria registro de auditoria.

        Args:
            order_id: UUID da OS.
            document_type: valor de DocumentType.
            data: JSON completo confirmado pelo usuário (snapshot).
            user: GlobalUser que está gerando.
            receivable_id: UUID do ReceivableDocument (apenas para receipt).

        Returns:
            DocumentGeneration criado.
        """
        from apps.service_orders.models import ServiceOrder, ServiceOrderActivityLog

        order = ServiceOrder.objects.get(pk=order_id, is_active=True)

        # Calcula próxima versão
        current_max = DocumentGeneration.objects.filter(
            service_order=order,
            document_type=document_type,
        ).aggregate(max_v=Max("version"))["max_v"] or 0
        next_version = current_max + 1

        # Renderiza PDF
        pdf_bytes = PDFService.render_document(document_type, data)

        # Upload S3
        short_id = uuid.uuid4().hex[:8]
        s3_key = (
            f"{DOCUMENT_S3_PREFIX}/os-{order.number}/"
            f"{document_type}/v{next_version}-{short_id}.pdf"
        )
        default_storage.save(s3_key, ContentFile(pdf_bytes))

        # Cria registro
        doc = DocumentGeneration.objects.create(
            document_type=document_type,
            version=next_version,
            service_order=order,
            receivable_id=receivable_id,
            data_snapshot=data,
            s3_key=s3_key,
            file_size_bytes=len(pdf_bytes),
            generated_by=user,
            created_by=user,
        )

        # Log no histórico da OS
        type_label = dict(DocumentType.choices).get(document_type, document_type)
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            user=user,
            activity_type="document_generated",
            description=f"{type_label} v{next_version} gerado",
            metadata={
                "document_id": str(doc.pk),
                "document_type": document_type,
                "version": next_version,
            },
        )

        logger.info(
            "Documento %s v%d gerado para OS #%s por %s",
            document_type, next_version, order.number, user,
        )

        return doc

    @classmethod
    def regenerate_from_snapshot(cls, doc_id: UUID) -> bytes:
        """Re-renderiza PDF a partir do snapshot salvo."""
        doc = DocumentGeneration.objects.get(pk=doc_id)
        return PDFService.render_document(doc.document_type, doc.data_snapshot)

    @classmethod
    def download(cls, doc_id: UUID) -> tuple[bytes, str]:
        """Retorna bytes do PDF do S3 + filename.

        Returns:
            Tupla (pdf_bytes, filename).
        """
        doc = DocumentGeneration.objects.select_related("service_order").get(pk=doc_id)
        f = default_storage.open(doc.s3_key, "rb")
        pdf_bytes = f.read()
        f.close()
        filename = (
            f"os-{doc.service_order.number}-{doc.document_type}-v{doc.version}.pdf"
        )
        return pdf_bytes, filename
```

- [ ] **Step 4: Create serializers**

Create `backend/core/apps/documents/serializers.py`:

```python
"""Serializers do módulo de documentos PDF."""
from __future__ import annotations

from rest_framework import serializers

from apps.documents.models import DocumentGeneration, DocumentType


class GenerateDocumentSerializer(serializers.Serializer):
    """Payload para gerar um documento PDF."""

    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    receivable_id = serializers.UUIDField(required=False, allow_null=True)
    data = serializers.JSONField()


class DocumentGenerationSerializer(serializers.ModelSerializer):
    """Serializer de leitura para DocumentGeneration."""

    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True,
    )
    generated_by_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentGeneration
        fields = [
            "id",
            "document_type",
            "document_type_display",
            "version",
            "service_order_id",
            "receivable_id",
            "s3_key",
            "file_size_bytes",
            "generated_by_name",
            "generated_at",
            "download_url",
            "created_at",
        ]
        read_only_fields = fields

    @property
    def _generated_at_field(self) -> str:
        return "created_at"

    def get_generated_by_name(self, obj: DocumentGeneration) -> str:
        user = obj.generated_by
        return getattr(user, "full_name", "") or getattr(user, "email", str(user))

    def get_download_url(self, obj: DocumentGeneration) -> str:
        return f"/api/v1/documents/{obj.pk}/download/"

    def to_representation(self, instance: DocumentGeneration) -> dict:
        data = super().to_representation(instance)
        data["generated_at"] = data["created_at"]
        return data


class DocumentSnapshotSerializer(serializers.ModelSerializer):
    """Serializer para retornar snapshot de auditoria (MANAGER+)."""

    class Meta:
        model = DocumentGeneration
        fields = ["id", "document_type", "version", "data_snapshot", "created_at"]
        read_only_fields = fields
```

- [ ] **Step 5: Create views**

Create `backend/core/apps/documents/views.py`:

```python
"""Views do módulo de documentos PDF."""
from __future__ import annotations

import logging

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.documents.models import DocumentGeneration
from apps.documents.serializers import (
    DocumentGenerationSerializer,
    DocumentSnapshotSerializer,
    GenerateDocumentSerializer,
)
from apps.documents.services import DocumentService

logger = logging.getLogger(__name__)


class DocumentPreviewView(APIView):
    """GET /api/v1/documents/os/{order_id}/preview/{document_type}/"""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request, order_id: str, document_type: str) -> Response:
        receivable_id = request.query_params.get("receivable_id")
        try:
            data = DocumentService.preview(
                order_id=order_id,
                document_type=document_type,
                receivable_id=receivable_id,
            )
            # Remove logo_base64 do preview (desnecessário para o frontend)
            data.pop("logo_base64", None)
            return Response(data)
        except Exception as exc:
            logger.error("Erro ao gerar preview: %s", exc)
            return Response(
                {"error": "Erro ao carregar dados do documento."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DocumentGenerateView(APIView):
    """POST /api/v1/documents/os/{order_id}/generate/"""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def post(self, request: Request, order_id: str) -> Response:
        serializer = GenerateDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_type = serializer.validated_data["document_type"]
        data = serializer.validated_data["data"]
        receivable_id = serializer.validated_data.get("receivable_id")

        # Re-injeta logo_base64 (não vem do frontend)
        from apps.pdf_engine.logo import get_logo_base64

        data["logo_base64"] = get_logo_base64()

        try:
            doc = DocumentService.generate(
                order_id=order_id,
                document_type=document_type,
                data=data,
                user=request.user,
                receivable_id=receivable_id,
            )
            return Response(
                DocumentGenerationSerializer(doc).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error("Erro ao gerar documento: %s", exc)
            return Response(
                {"error": "Erro interno ao gerar documento."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentHistoryView(APIView):
    """GET /api/v1/documents/os/{order_id}/history/"""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request, order_id: str) -> Response:
        qs = DocumentGeneration.objects.filter(
            service_order_id=order_id,
        ).select_related("generated_by").order_by("-created_at")

        return Response(DocumentGenerationSerializer(qs, many=True).data)


class DocumentDownloadView(APIView):
    """GET /api/v1/documents/{doc_id}/download/"""

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get(self, request: Request, doc_id: str) -> HttpResponse:
        try:
            pdf_bytes, filename = DocumentService.download(doc_id)
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response
        except DocumentGeneration.DoesNotExist:
            return HttpResponse(status=404)
        except Exception as exc:
            logger.error("Erro ao baixar documento %s: %s", doc_id, exc)
            return HttpResponse(status=500)


class DocumentSnapshotView(APIView):
    """GET /api/v1/documents/{doc_id}/snapshot/ — MANAGER+"""

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get(self, request: Request, doc_id: str) -> Response:
        try:
            doc = DocumentGeneration.objects.get(pk=doc_id)
            return Response(DocumentSnapshotSerializer(doc).data)
        except DocumentGeneration.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
```

- [ ] **Step 6: Update urls**

Replace `backend/core/apps/documents/urls.py`:

```python
from django.urls import path

from apps.documents.views import (
    DocumentDownloadView,
    DocumentGenerateView,
    DocumentHistoryView,
    DocumentPreviewView,
    DocumentSnapshotView,
)

urlpatterns = [
    # Preview + Generate + History (vinculados a uma OS)
    path(
        "os/<uuid:order_id>/preview/<str:document_type>/",
        DocumentPreviewView.as_view(),
        name="document-preview",
    ),
    path(
        "os/<uuid:order_id>/generate/",
        DocumentGenerateView.as_view(),
        name="document-generate",
    ),
    path(
        "os/<uuid:order_id>/history/",
        DocumentHistoryView.as_view(),
        name="document-history",
    ),
    # Download + Snapshot (por document ID)
    path(
        "<uuid:doc_id>/download/",
        DocumentDownloadView.as_view(),
        name="document-download",
    ),
    path(
        "<uuid:doc_id>/snapshot/",
        DocumentSnapshotView.as_view(),
        name="document-snapshot",
    ),
]
```

- [ ] **Step 7: Add `document_generated` to ActivityType**

In `backend/core/apps/service_orders/models.py`, add to the `ActivityType` TextChoices (after `LABOR_REMOVED`):

```python
    DOCUMENT_GENERATED = "document_generated", "Documento Gerado"
```

- [ ] **Step 8: Verify**

Run:
```bash
cd backend/core && python manage.py check
```
Expected: `System check identified no issues.`

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/documents/ backend/core/apps/pdf_engine/services.py backend/core/apps/service_orders/models.py
git commit -m "feat(documents): data loaders + DocumentService + serializers + views + endpoints"
```

---

## Task 5: Frontend — TypeScript types + hooks

**Files:**
- Create: `packages/types/src/documents.types.ts`
- Modify: `packages/types/src/index.ts` (re-export)
- Create: `apps/dscar-web/src/hooks/useDocuments.ts`

- [ ] **Step 1: Create types**

Create `packages/types/src/documents.types.ts`:

```typescript
export type DocumentType = "os_report" | "warranty" | "settlement" | "receipt"

export interface DocumentGeneration {
  id: string
  document_type: DocumentType
  document_type_display: string
  version: number
  service_order_id: string
  receivable_id: string | null
  s3_key: string
  file_size_bytes: number | null
  generated_by_name: string
  generated_at: string
  download_url: string
  created_at: string
}

export interface DocumentPreviewData {
  company: {
    razao_social: string
    cnpj_formatted: string
    ie: string
    endereco_linha: string
    telefone: string
    email: string
  }
  order: { number: number }
  customer: {
    name: string
    cpf: string
    cnpj: string
    rg: string
    phone: string
    email: string
    address: string
  }
  vehicle: {
    make: string
    model: string
    year: string
    color: string
    plate: string
    chassis: string
    mileage_in: number | null
  }
  services: DocumentServiceItem[]
  parts?: DocumentPartItem[]
  totals: {
    parts: string
    services: string
    discount: string
    grand_total: string
  }
  insurer?: {
    name: string
    casualty_number: string
    insured_type: string
    deductible_amount: string
  }
  payment?: {
    method: string
    method_display: string
    amount: string
    amount_words: string
    date: string
    status: string
  }
  receipt?: {
    description: string
    receivable_description: string
  }
  warranty_coverage?: string[]
  warranty_exclusions?: string[]
  observations: string
  location_date: string
}

export interface DocumentServiceItem {
  description: string
  quantity: string
  unit_price: string
  total: string
  category: string
  warranty_months?: number
  warranty_until?: string
}

export interface DocumentPartItem {
  description: string
  part_number: string
  quantity: string
  unit_price: string
  total: string
}

export interface GenerateDocumentPayload {
  document_type: DocumentType
  receivable_id?: string | null
  data: DocumentPreviewData
}

export const DOCUMENT_TYPE_CONFIG: Record<
  DocumentType,
  { label: string; icon: string }
> = {
  os_report: { label: "Ordem de Serviço", icon: "FileText" },
  warranty: { label: "Termo de Garantia", icon: "ShieldCheck" },
  settlement: { label: "Termo de Quitação", icon: "CheckCircle" },
  receipt: { label: "Recibo de Pagamento", icon: "Receipt" },
}
```

- [ ] **Step 2: Re-export from index**

In `packages/types/src/index.ts`, add at the end:

```typescript
export * from "./documents.types"
```

- [ ] **Step 3: Create hooks**

Create `apps/dscar-web/src/hooks/useDocuments.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type {
  DocumentGeneration,
  DocumentPreviewData,
  DocumentType,
  GenerateDocumentPayload,
} from "@paddock/types"

const BASE = "/api/proxy/documents"

const docKeys = {
  all: ["documents"] as const,
  history: (osId: string) => [...docKeys.all, "history", osId] as const,
  preview: (osId: string, type: DocumentType) =>
    [...docKeys.all, "preview", osId, type] as const,
}

export function useDocumentHistory(osId: string) {
  return useQuery({
    queryKey: docKeys.history(osId),
    queryFn: () =>
      apiFetch<DocumentGeneration[]>(`${BASE}/os/${osId}/history/`),
    enabled: !!osId,
  })
}

export function useDocumentPreview(
  osId: string,
  documentType: DocumentType | null,
  receivableId?: string,
) {
  const params = receivableId ? `?receivable_id=${receivableId}` : ""
  return useQuery({
    queryKey: docKeys.preview(osId, documentType!),
    queryFn: () =>
      apiFetch<DocumentPreviewData>(
        `${BASE}/os/${osId}/preview/${documentType}/${params}`,
      ),
    enabled: !!osId && !!documentType,
  })
}

export function useGenerateDocument(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GenerateDocumentPayload) =>
      apiFetch<DocumentGeneration>(`${BASE}/os/${osId}/generate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docKeys.history(osId) })
    },
  })
}

export function useDocumentDownloadUrl(docId: string): string {
  return `${BASE}/${docId}/download/`
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/documents.types.ts packages/types/src/index.ts apps/dscar-web/src/hooks/useDocuments.ts
git commit -m "feat(documents): TypeScript types + TanStack Query hooks for document generation"
```

---

## Task 6: Frontend — DocumentsDropdown in OS header

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentsDropdown.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`

- [ ] **Step 1: Create DocumentsDropdown**

Create `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentsDropdown.tsx`:

```tsx
"use client"

import { useState } from "react"
import { FileText, ShieldCheck, CheckCircle, Receipt, ChevronDown } from "lucide-react"
import type { ServiceOrder, DocumentType } from "@paddock/types"
import { useDocumentHistory } from "@/hooks/useDocuments"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DocumentPreviewDrawer } from "./DocumentPreviewDrawer"

const DOC_ITEMS: {
  type: DocumentType
  label: string
  icon: typeof FileText
  tooltip: (o: ServiceOrder) => string | null
  enabled: (o: ServiceOrder) => boolean
}[] = [
  {
    type: "os_report",
    label: "Ordem de Serviço",
    icon: FileText,
    tooltip: () => null,
    enabled: () => true,
  },
  {
    type: "warranty",
    label: "Termo de Garantia",
    icon: ShieldCheck,
    tooltip: (o) =>
      !["ready", "delivered"].includes(o.status)
        ? "Disponível quando OS estiver pronta ou entregue"
        : null,
    enabled: (o) => ["ready", "delivered"].includes(o.status),
  },
  {
    type: "settlement",
    label: "Termo de Quitação",
    icon: CheckCircle,
    tooltip: (o) =>
      !o.invoice_issued ? "Disponível após faturamento da OS" : null,
    enabled: (o) => !!o.invoice_issued,
  },
  {
    type: "receipt",
    label: "Recibo de Pagamento",
    icon: Receipt,
    tooltip: () => null, // TODO: check receivable receipts
    enabled: (o) => !!o.invoice_issued,
  },
]

interface DocumentsDropdownProps {
  order: ServiceOrder
}

export function DocumentsDropdown({ order }: DocumentsDropdownProps) {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null)
  const { data: history } = useDocumentHistory(order.id)
  const docCount = history?.length ?? 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.03] transition-colors"
          >
            <FileText className="h-4 w-4" />
            Documentos
            {docCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600/20 px-1.5 text-xs font-mono text-primary-400">
                {docCount}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Gerar Documento</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DOC_ITEMS.map((item) => {
            const disabled = !item.enabled(order)
            const tip = item.tooltip(order)
            const Icon = item.icon
            return (
              <DropdownMenuItem
                key={item.type}
                disabled={disabled}
                onClick={() => setSelectedType(item.type)}
                title={tip ?? undefined}
              >
                <Icon className="h-4 w-4 mr-2 shrink-0" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedType && (
        <DocumentPreviewDrawer
          order={order}
          documentType={selectedType}
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Add dropdown to ServiceOrderForm header**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`:

Add import at top (after existing imports):

```typescript
import { DocumentsDropdown } from "./DocumentsDropdown"
```

In the header `<div className="flex items-center gap-3">` (around line 187), add the dropdown before the status transition dropdown:

```tsx
          {/* Documents dropdown */}
          <DocumentsDropdown order={order} />
```

This goes right after line 187 (`<div className="flex items-center gap-3">`) and before the status transition dropdown block.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentsDropdown.tsx apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx
git commit -m "feat(documents): DocumentsDropdown in OS header with availability rules"
```

---

## Task 7: Frontend — DocumentPreviewDrawer (editable form)

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentPreviewDrawer.tsx`

- [ ] **Step 1: Create drawer component**

Create `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentPreviewDrawer.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrder, DocumentType, DocumentPreviewData } from "@paddock/types"
import { DOCUMENT_TYPE_CONFIG } from "@paddock/types"
import { useDocumentPreview, useGenerateDocument } from "@/hooks/useDocuments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface Props {
  order: ServiceOrder
  documentType: DocumentType
  onClose: () => void
}

export function DocumentPreviewDrawer({ order, documentType, onClose }: Props) {
  const config = DOCUMENT_TYPE_CONFIG[documentType]
  const { data: previewData, isLoading } = useDocumentPreview(order.id, documentType)
  const generateMutation = useGenerateDocument(order.id)

  // Editable state — initialized from preview
  const [formData, setFormData] = useState<DocumentPreviewData | null>(null)

  useEffect(() => {
    if (previewData) {
      setFormData(structuredClone(previewData))
    }
  }, [previewData])

  function updateField(path: string, value: string) {
    if (!formData) return
    const clone = structuredClone(formData)
    const keys = path.split(".")
    let obj: Record<string, unknown> = clone as Record<string, unknown>
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]] as Record<string, unknown>
    }
    obj[keys[keys.length - 1]] = value
    setFormData(clone as DocumentPreviewData)
  }

  function updateServiceField(index: number, field: string, value: string | number) {
    if (!formData) return
    const clone = structuredClone(formData)
    ;(clone.services[index] as Record<string, unknown>)[field] = value
    setFormData(clone)
  }

  function updateListItem(listKey: "warranty_coverage" | "warranty_exclusions", index: number, value: string) {
    if (!formData) return
    const clone = structuredClone(formData)
    const list = clone[listKey]
    if (list) list[index] = value
    setFormData(clone)
  }

  function addListItem(listKey: "warranty_coverage" | "warranty_exclusions") {
    if (!formData) return
    const clone = structuredClone(formData)
    const list = clone[listKey] ?? []
    list.push("")
    clone[listKey] = list
    setFormData(clone)
  }

  function removeListItem(listKey: "warranty_coverage" | "warranty_exclusions", index: number) {
    if (!formData) return
    const clone = structuredClone(formData)
    clone[listKey]?.splice(index, 1)
    setFormData(clone)
  }

  async function handleGenerate() {
    if (!formData) return
    try {
      const result = await generateMutation.mutateAsync({
        document_type: documentType,
        data: formData,
      })
      // Open PDF in new tab
      window.open(`/api/proxy/documents/${result.id}/download/`, "_blank")
      toast.success(`${config.label} v${result.version} gerado com sucesso!`)
      onClose()
    } catch {
      toast.error("Erro ao gerar documento. Tente novamente.")
    }
  }

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-500" />
            {config.label} — OS #{order.number}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !formData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Cliente */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Dados do Cliente</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-white/40">Nome</Label>
                  <Input
                    value={formData.customer.name}
                    onChange={(e) => updateField("customer.name", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-white/40">CPF</Label>
                    <Input
                      value={formData.customer.cpf}
                      onChange={(e) => updateField("customer.cpf", e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40">Telefone</Label>
                    <Input
                      value={formData.customer.phone}
                      onChange={(e) => updateField("customer.phone", e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/40">Endereço</Label>
                  <Input
                    value={formData.customer.address}
                    onChange={(e) => updateField("customer.address", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            </section>

            {/* Veículo */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Dados do Veículo</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-white/40">Placa</Label>
                  <Input
                    value={formData.vehicle.plate}
                    onChange={(e) => updateField("vehicle.plate", e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Modelo</Label>
                  <Input
                    value={`${formData.vehicle.make} ${formData.vehicle.model}`}
                    onChange={(e) => updateField("vehicle.model", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Ano</Label>
                  <Input
                    value={formData.vehicle.year}
                    onChange={(e) => updateField("vehicle.year", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40">Cor</Label>
                  <Input
                    value={formData.vehicle.color}
                    onChange={(e) => updateField("vehicle.color", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            </section>

            {/* Serviços */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Serviços</h3>
              <div className="space-y-2">
                {formData.services.map((svc, i) => (
                  <div key={i} className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/30 w-6">{String(i + 1).padStart(2, "0")}</span>
                      <Input
                        value={svc.description}
                        onChange={(e) => updateServiceField(i, "description", e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={svc.total}
                        onChange={(e) => updateServiceField(i, "total", e.target.value)}
                        className="h-7 text-xs w-24 text-right font-mono"
                        placeholder="R$"
                      />
                    </div>
                    {documentType === "warranty" && svc.warranty_months !== undefined && (
                      <div className="flex items-center gap-2 ml-8">
                        <Label className="text-xs text-white/40 shrink-0">Garantia:</Label>
                        <select
                          value={svc.warranty_months}
                          onChange={(e) => updateServiceField(i, "warranty_months", parseInt(e.target.value))}
                          className="h-7 text-xs bg-white/5 border border-white/10 rounded px-2 text-white"
                        >
                          <option value={0}>Sem garantia</option>
                          <option value={3}>3 meses</option>
                          <option value={6}>6 meses</option>
                          <option value={12}>12 meses</option>
                        </select>
                        {svc.warranty_until && (
                          <span className="text-xs text-white/40">até {svc.warranty_until}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Cobertura/Exclusões (só garantia) */}
            {documentType === "warranty" && formData.warranty_coverage && (
              <section>
                <h3 className="label-mono text-white/50 mb-3">Cobertura da Garantia</h3>
                <div className="space-y-2">
                  {formData.warranty_coverage.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-success-400 mt-1.5 text-xs shrink-0">✔</span>
                      <Input
                        value={item}
                        onChange={(e) => updateListItem("warranty_coverage", i, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem("warranty_coverage", i)}
                        className="text-white/30 hover:text-error-400 mt-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addListItem("warranty_coverage")}
                    className="text-xs text-white/40"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </section>
            )}

            {documentType === "warranty" && formData.warranty_exclusions && (
              <section>
                <h3 className="label-mono text-white/50 mb-3">Exclusões da Garantia</h3>
                <div className="space-y-2">
                  {formData.warranty_exclusions.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-error-400 mt-1.5 text-xs shrink-0">✘</span>
                      <Input
                        value={item}
                        onChange={(e) => updateListItem("warranty_exclusions", i, e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeListItem("warranty_exclusions", i)}
                        className="text-white/30 hover:text-error-400 mt-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addListItem("warranty_exclusions")}
                    className="text-xs text-white/40"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </section>
            )}

            {/* Observações */}
            <section>
              <h3 className="label-mono text-white/50 mb-3">Observações</h3>
              <textarea
                value={formData.observations}
                onChange={(e) => updateField("observations", e.target.value)}
                rows={3}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Observações adicionais (opcional)"
              />
            </section>

            {/* Footer */}
            <div className="flex gap-2 justify-end border-t border-white/10 pt-4">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 text-white"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-1.5" /> Gerar PDF</>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentPreviewDrawer.tsx
git commit -m "feat(documents): DocumentPreviewDrawer with editable fields and warranty controls"
```

---

## Task 8: Frontend — DocumentHistorySection in ClosingTab

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentHistorySection.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx`

- [ ] **Step 1: Create DocumentHistorySection**

Create `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentHistorySection.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  Receipt,
  Download,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { ServiceOrder, DocumentType, DocumentGeneration } from "@paddock/types"
import { useDocumentHistory } from "@/hooks/useDocuments"
import { Button } from "@/components/ui/button"

const TYPE_ICONS: Record<DocumentType, typeof FileText> = {
  os_report: FileText,
  warranty: ShieldCheck,
  settlement: CheckCircle,
  receipt: Receipt,
}

interface Props {
  order: ServiceOrder
}

export function DocumentHistorySection({ order }: Props) {
  const { data: history, isLoading } = useDocumentHistory(order.id)
  const [expandedType, setExpandedType] = useState<DocumentType | null>(null)

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse">
        <div className="h-32" />
      </div>
    )
  }

  const docs = history ?? []

  // Group by type, latest version first
  const grouped = docs.reduce<Record<string, DocumentGeneration[]>>(
    (acc, doc) => {
      const key = doc.document_type
      if (!acc[key]) acc[key] = []
      acc[key].push(doc)
      return acc
    },
    {},
  )

  // Sort each group by version descending
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.version - a.version)
  }

  function handleDownload(docId: string) {
    window.open(`/api/proxy/documents/${docId}/download/`, "_blank")
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
        <FileText className="h-4 w-4 text-white/50" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Documentos Gerados
        </h2>
        {docs.length > 0 && (
          <span className="ml-auto text-xs font-mono text-white/30">
            {docs.length} documento{docs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-5">
        {docs.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">
            Nenhum documento gerado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, versions]) => {
              const latest = versions[0]
              const Icon = TYPE_ICONS[type as DocumentType] ?? FileText
              const isExpanded = expandedType === type
              const hasOlderVersions = versions.length > 1

              return (
                <div
                  key={type}
                  className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden"
                >
                  {/* Latest version card */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 text-primary-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {latest.document_type_display}
                        </span>
                        <span className="text-xs font-mono bg-primary-600/20 text-primary-400 px-1.5 py-0.5 rounded">
                          v{latest.version}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        Gerado por {latest.generated_by_name} ·{" "}
                        {format(new Date(latest.generated_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(latest.id)}
                        className="h-7 px-2 text-xs text-white/50 hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                      {hasOlderVersions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedType(isExpanded ? null : (type as DocumentType))
                          }
                          className="h-7 px-2 text-xs text-white/30 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {versions.length - 1} anterior{versions.length - 1 !== 1 ? "es" : ""}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Older versions (accordion) */}
                  {isExpanded && hasOlderVersions && (
                    <div className="border-t border-white/5 bg-white/[0.02]">
                      {versions.slice(1).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 px-4 py-2 border-b border-white/5 last:border-0"
                        >
                          <span className="text-xs font-mono text-white/30 w-8">
                            v{doc.version}
                          </span>
                          <span className="text-xs text-white/40 flex-1">
                            {format(new Date(doc.generated_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}{" "}
                            — {doc.generated_by_name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id)}
                            className="h-6 px-1.5 text-xs text-white/30 hover:text-white"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/api/proxy/documents/${doc.id}/snapshot/`,
                                "_blank",
                              )
                            }
                            className="h-6 px-1.5 text-xs text-white/30 hover:text-white"
                            title="Ver snapshot (auditoria)"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add to ClosingTab**

In `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx`:

Add import at top:

```typescript
import { DocumentHistorySection } from "../DocumentHistorySection"
```

Add the section right before the closing `</div>` of the main return (before the `{showDelivery &&` block, around line 380):

```tsx
      {/* Generated documents */}
      <DocumentHistorySection order={order} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/(app)/service-orders/[id]/_components/DocumentHistorySection.tsx apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx
git commit -m "feat(documents): DocumentHistorySection in ClosingTab with version accordion"
```

---

## Task 9: Apply migration + smoke test

- [ ] **Step 1: Apply migration**

```bash
cd backend/core && python manage.py migrate_schemas
```
Expected: migration `documents.0001_initial` applied.

- [ ] **Step 2: Verify manage.py check**

```bash
cd backend/core && python manage.py check
```
Expected: 0 issues.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/dscar-web && npx tsc --noEmit
```
Expected: 0 errors (or only pre-existing ones).

- [ ] **Step 4: Commit any fixes**

If needed:
```bash
git add -u && git commit -m "fix(documents): address migration/type issues from smoke test"
```

---

## Task 10: Final commit + verify

- [ ] **Step 1: Verify git status is clean**

```bash
git status
```

- [ ] **Step 2: Final check**

```bash
cd backend/core && python manage.py check && cd ../../apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 3: Tag completion**

No tag needed — feature is on `main` and ready for QA testing via `make dev`.
