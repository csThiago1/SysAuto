# E2E Test Suite — DS Car ERP Pipeline

End-to-end tests for the complete service order pipeline, from reception to delivery, using Playwright.

---

## Overview

The suite covers two independent scenarios that each exercise the full 16-status transition chain:

| Scenario | Client | Origin |
|----------|--------|--------|
| Scenario A | New client created inline via Django shell + searched in UI | Particular |
| Scenario B | Existing client (fallback: inline creation) | Seguradora |

Both scenarios verify the same core pipeline — OS creation, budget, authorization, purchasing, stock entry, workshop phases, billing, and delivery — with origin-specific variations in insurer fields, part payers, and authorization flow.

---

## Files

| File | Purpose |
|------|---------|
| `helpers.ts` | Shared utilities: login, browser-native API helpers (`apiPost`, `apiGet`, `apiPatch`), Docker exec helpers for Django operations, photo upload, transition helpers (`uiTransition`, `apiTransition`, `smartTransition`), and prerequisite factories (`createSignature`, `ensureClosedTimesheet`, `createStockEntry`, `createReceivable`, `executeBilling`, etc.) |
| `pipeline-e2e.spec.ts` | Main test file. Two `test.describe` blocks — Scenario A (Particular) and Scenario B (Seguradora) — each with a single long-running test that executes all steps sequentially. Timeout: 5 minutes per scenario. |

---

## Prerequisites

```bash
# 1. Start Docker services (Django, PostgreSQL, Redis)
make dev

# 2. Start Next.js dev server on port 3001
cd apps/dscar-web && npm run dev

# 3. Install Playwright browsers (first run only)
npx playwright install
```

Confirm that `http://localhost:3001` is reachable and `paddock_django` Docker container is healthy before running.

---

## Running

```bash
cd apps/dscar-web
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --reporter=list
```

Run a single scenario by title:

```bash
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --grep "Cenário A"
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --grep "Cenário B"
```

Run with UI mode for step-by-step inspection:

```bash
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --ui
```

---

## Architecture Decisions

### API calls via `page.evaluate`

All proxy API calls (`apiPost`, `apiGet`, `apiPatch`) use browser-native `fetch` via `page.evaluate` rather than Playwright's `page.request`. This is intentional: browser-native fetch runs in the same origin as the Next.js app, so session cookies and the `X-Tenant-Domain` header are included automatically. Playwright's `page.request` had persistent 308 redirect issues when calling the Next.js proxy routes — browser-native fetch bypasses this entirely.

### Docker exec for Django operations

Several operations are performed directly via `docker exec paddock_django python manage.py shell` rather than through the API:

- **Signatures** (`createSignature`): the signature proxy endpoint had authentication issues that were unreliable to reproduce consistently in tests. Creating the record directly in the Django DB via `schema_context('tenant_dscar')` is deterministic.
- **Timesheets** (`ensureClosedTimesheet`): the `ApontamentoHoras` model needs to be created with specific timestamps and status to satisfy the `TIMESHEET_CLOSED` transition validator. The API does not expose a shortcut for this in dev mode.
- **Stock entries** (`createStockEntry`): creating a `UnidadeFisica`, linking it to the OS part (`compra` origin), and marking the part as `recebida` requires touching multiple models atomically. The helper replicates what the WMS entry flow does internally.
- **Billing** (`executeBilling`): `BillingService.preview` and `BillingService.bill` contain complex business logic (consolidating parts, services, insurer vs. customer payers) that is not safely reachable through a single proxy endpoint in test environments.
- **Customer creation** (`createCustomerViaDjango`): UI-based inline customer creation times out with larger OS lists (>50 records) due to autocomplete rendering. The Django shell creation is instant and reliable.

### Photos via multipart upload

Photo uploads use `page.request.post` with a `multipart` body containing a real (1x1 transparent) PNG buffer. This is the one case where `page.request` is preferred over `page.evaluate` because the browser's `fetch` API does not easily compose `FormData` with binary buffer payloads from within `evaluate`. The cookie header is manually extracted and forwarded to satisfy auth.

### Soft transition handling

Several workshop transitions have soft blocks that require prerequisites to be satisfied:

- `TIMESHEET_CLOSED`: at least one closed `ApontamentoHoras` record per OS. The test creates one via `ensureClosedTimesheet` before the entire workshop sequence — one record satisfies all subsequent workshop transitions.
- `PHOTOS_MIN_12`: minimum 12 photos in the entry survey folder. Satisfied with `uploadDummyPhotos(12, "vistoria_inicial")` split across two calls (8 + 4) before the `initial_survey` transition.
- `ALL_PARTS_RECEIVED`: all active `compra`-origin parts must be `recebida`. Satisfied by `markAllPartsReceived` immediately before the `washing → final_survey` transition.
- `PROGRESS_PHOTO`: at least one progress photo per workshop transition. Satisfied by uploading one dummy photo to `acompanhamento` before each workshop API transition.

---

## What the Test Verifies (Complete Pipeline)

The steps below reflect Scenario A. Scenario B follows the same core sequence with origin-specific variations noted inline.

| Step | Action | Method |
|------|--------|--------|
| 1 | Login with dev-credentials | UI (form fill + submit) |
| 2 | Open "Nova OS" drawer | UI (button click) |
| 3 | Select origin: Particular (A) / Seguradora (B) | UI |
| 4 | Customer creation + search in drawer | Django shell + UI autocomplete |
| 5 | Fill plate, make, model | UI (`fillPlate` helper + inputs) |
| 6 | Create OS | UI ("Criar OS" button) |
| 7 | Assert OS heading renders | UI assertion |
| 8 | Fill entry dates and save | UI ("Agora" buttons + "Salvar") |
| 9 | Transition: reception → initial_survey | `smartTransition` (UI with API fallback) |
| 9b | Fetch real OS UUID + upload 12 dummy photos | `getOsUuid` + `uploadDummyPhotos` |
| 10 | Transition: initial_survey → budget | `apiTransition` |
| 11 | Add part with origin `compra` (auto-creates PedidoCompra) + manual part | `apiPost` to `/parts/compra/` and `/parts/` |
| 12 | Add labor/service | `apiPost` to `/labor/` |
| 13 | Transition: budget → waiting_auth | `apiTransition` |
| 14 | Set authorization date + create BUDGET_APPROVAL signature + transition → authorized | `setOsFieldViaDjango` + `createSignature` + `apiTransition` |
| 15 | Verify PedidoCompra created | Django shell + UI navigation to `/compras` |
| 16 | Create OC via API + add item via UI + submit for approval + approve | `apiPost` to `/ordens-compra/` + UI button clicks |
| 18 | Transition: authorized → waiting_parts | `apiTransition` |
| 19 | Stock entry + link UnidadeFisica to OS compra part | `createStockEntry` (Docker exec) |
| 20 | Transition: waiting_parts → repair | `apiTransition` |
| 21 | Workshop transitions: repair → bodywork → painting → assembly → polishing → washing | `ensureClosedTimesheet` + `uploadDummyPhotos` per transition + `apiTransition` |
| 22 | Transition: washing → final_survey (with ALL_PARTS_RECEIVED) | `markAllPartsReceived` + `apiTransition` |
| 23 | Transition: final_survey → ready (with exit checklist + final photos) | `uploadDummyPhotos(12)` + `createExitChecklist` + `apiTransition` |
| 24 | Delivery prerequisites: patch mileage + OS_DELIVERY signature + billing + fiscal document | `patchOS` + `createSignature` + `executeBilling` + `apiPost` |
| 25 | Transition: ready → delivered | `apiTransition` |
| 26 | Verify final status = "delivered" via API | `apiGet` + assertion |
| 27 | Verify agenda page loads | UI navigation + heading assertion |

---

## Known Limitations

- **Client inline creation with large datasets**: the UI autocomplete can time out when the OS list has more than ~50 records. The test works around this by creating the customer via `createCustomerViaDjango` (Django shell) and then searching for the created record in the UI.
- **BillingService with empty customer_uuid**: `executeBilling` calls `BillingService.preview` then `BillingService.bill`. If the OS has no `customer_uuid` (e.g., the person record was created without a linked UUID), the billing service raises an exception. The helper catches this and falls back to `createReceivable`, which creates a `ReceivableDocument` directly with `status="pending"`.
- **`force=true` not available in dev mode**: the `transition` endpoint accepts a `force` parameter for managers, but in dev mode (dev-credentials) no Django `User` record is created, so the permission check cannot resolve the user role. All hard blocks must be satisfied by creating the prerequisites, not by forcing the transition.
- **Fiscal document in homologation**: the NFC-e creation in Step 24 calls the fiscal endpoint with `environment: "homologacao"`. If the Focus NF-e token or CNPJ configuration is not set in the dev environment, the fiscal step will warn but will not fail the test — the delivery transition does not require a fiscal document in dev mode.

---

## Bugs Found and Fixed During E2E Development

The following production bugs were discovered and fixed while building this test suite:

1. **DRF routing shadow** (production fix): the `parts` ViewSet used the URL pattern `url_path=r"parts/(?P<part_pk>[^/.]+)"`, which matched any string as `part_pk`. The custom action paths `parts/compra/`, `parts/estoque/`, and `parts/seguradora/` were being captured as part PKs (404 on lookup). Fixed by restricting `part_pk` to UUID format only: `url_path=r"parts/(?P<part_pk>[0-9a-f-]{36})"`.

2. **Signature serializer UUIDField mismatch**: the `Signature` serializer declared `service_order_id` as `IntegerField`, but the `ServiceOrder` primary key is a UUID. The serializer rejected any UUID value with a validation error. Fixed by changing the field type to `UUIDField`.

3. **Nova OC dialog required UUID**: the "Nova OC" dialog in the purchasing UI required the user to enter the OS UUID, which is not visible anywhere in the interface. Fixed so the dialog accepts the OS number (e.g., `42`), resolves the UUID internally via a `GET /service-orders/{number}/` call, and passes the UUID to the create endpoint.
