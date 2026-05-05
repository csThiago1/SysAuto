# Importação Cilia/Soma/Audatex + Complemento Particular — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar importação multi-fonte de orçamentos de seguradoras (Cilia API, Soma XML, Audatex HTML) com versionamento diff/override, e complemento particular com faturamento independente.

**Architecture:** O backend já possui ImportService, ParsedBudget DTOs, ServiceOrderVersion e versionamento. Este plano adiciona: (1) campos `payer` e `source_type` nos itens da OS para separar seguradora/particular, (2) campo `import_tool` no InsurerTenantProfile, (3) endpoints de importação/diff/override/complemento, (4) frontend com modal de importação, aba de orçamento seguradora, aba de complemento particular, e resumo financeiro.

**Tech Stack:** Django 5 + DRF, Next.js 15, TypeScript, Zod, TanStack Query v5, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-05-05-cilia-import-complemento-particular-design.md`

---

## File Structure

### Backend — Modificações

| Arquivo | Responsabilidade |
|---------|------------------|
| `backend/core/apps/insurers/models.py` | Adicionar `import_tool` ao InsurerTenantProfile |
| `backend/core/apps/service_orders/models.py` | Adicionar `payer`, `source_type`, `billing_status`, `billed_at` em Part/Labor |
| `backend/core/apps/service_orders/serializers.py` | Serializers para versões, diff, complemento, resumo financeiro |
| `backend/core/apps/service_orders/views.py` | Actions: import, versions, diff, apply, complement CRUD, complement bill |
| `backend/core/apps/service_orders/services.py` | `apply_version_override()`, `bill_complement()`, `financial_summary()` |
| `backend/core/apps/service_orders/billing.py` | `BillingService.bill_complement()` para faturamento independente |
| `backend/core/apps/service_orders/urls.py` | Novos endpoints |
| `backend/core/apps/insurers/serializers.py` | Expor `import_tool` |

### Backend — Migrações

| Arquivo | Conteúdo |
|---------|----------|
| `backend/core/apps/insurers/migrations/00XX_add_import_tool.py` | Campo `import_tool` |
| `backend/core/apps/service_orders/migrations/00XX_add_payer_source_billing.py` | Campos `payer`, `source_type`, `billing_status`, `billed_at` em Part e Labor |

### Frontend — Novos Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/InsurerBudgetTab.tsx` | Aba read-only do orçamento seguradora |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ComplementTab.tsx` | Aba editável do complemento particular |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx` | Modal de importação multi-fonte |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportDiffView.tsx` | Visualização de diff entre versões |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FinancialSummaryCard.tsx` | Card resumo financeiro |

### Frontend — Modificações

| Arquivo | Mudança |
|---------|---------|
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx` | Adicionar abas "Orçamento Seguradora" e "Complemento Particular", botão "Importar Orçamento" |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx` | Filtros por origem, coluna "Pagador" |
| `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx` | Filtros por origem, coluna "Pagador" |
| `packages/types/src/service-order.types.ts` | Tipos para versões, complemento, resumo financeiro |

### Testes

| Arquivo | Cobertura |
|---------|-----------|
| `backend/core/apps/service_orders/tests/test_complement.py` | CRUD complemento + faturamento |
| `backend/core/apps/service_orders/tests/test_import_flow.py` | Import → version → diff → override |
| `backend/core/apps/service_orders/tests/test_financial_summary.py` | Resumo financeiro seguradora + particular |

---

## Task 1: Migração — Campos `payer`, `source_type`, `billing_status` em Part e Labor

**Files:**
- Modify: `backend/core/apps/service_orders/models.py:601-715` (ServiceOrderPart)
- Modify: `backend/core/apps/service_orders/models.py:795-851` (ServiceOrderLabor)
- Create: migration (auto-gerada)

- [ ] **Step 1: Adicionar campos ao ServiceOrderPart**

Em `backend/core/apps/service_orders/models.py`, após o campo `custo_real` (linha 691), adicionar:

```python
    # --- Pagador / Origem / Faturamento ---
    class Payer(models.TextChoices):
        INSURER = "insurer", "Seguradora"
        CUSTOMER = "customer", "Cliente/Particular"

    class SourceType(models.TextChoices):
        IMPORT = "import", "Importado"
        COMPLEMENT = "complement", "Complemento Particular"
        MANUAL = "manual", "Manual"

    class BillingStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        BILLED = "billed", "Faturado"

    payer = models.CharField(
        max_length=20,
        choices=Payer.choices,
        default=Payer.INSURER,
        verbose_name="Pagador",
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.MANUAL,
        verbose_name="Origem do item",
    )
    billing_status = models.CharField(
        max_length=20,
        choices=BillingStatus.choices,
        default=BillingStatus.PENDING,
        verbose_name="Status de faturamento",
    )
    billed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do faturamento",
    )
```

- [ ] **Step 2: Adicionar campos ao ServiceOrderLabor**

Em `backend/core/apps/service_orders/models.py`, após o campo `discount` (linha 827), adicionar:

```python
    # --- Pagador / Origem / Faturamento ---
    class Payer(models.TextChoices):
        INSURER = "insurer", "Seguradora"
        CUSTOMER = "customer", "Cliente/Particular"

    class SourceType(models.TextChoices):
        IMPORT = "import", "Importado"
        COMPLEMENT = "complement", "Complemento Particular"
        MANUAL = "manual", "Manual"

    class BillingStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        BILLED = "billed", "Faturado"

    payer = models.CharField(
        max_length=20,
        choices=Payer.choices,
        default=Payer.INSURER,
        verbose_name="Pagador",
    )
    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
        default=SourceType.MANUAL,
        verbose_name="Origem do item",
    )
    billing_status = models.CharField(
        max_length=20,
        choices=BillingStatus.choices,
        default=BillingStatus.PENDING,
        verbose_name="Status de faturamento",
    )
    billed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Data do faturamento",
    )
```

- [ ] **Step 3: Gerar e aplicar migração**

```bash
cd backend/core && python manage.py makemigrations service_orders --name add_payer_source_billing
python manage.py migrate_schemas
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/models.py backend/core/apps/service_orders/migrations/
git commit -m "feat(service_orders): add payer, source_type, billing_status to Part and Labor"
```

---

## Task 2: Migração — Campo `import_tool` no InsurerTenantProfile

**Files:**
- Modify: `backend/core/apps/insurers/models.py:70-149`
- Create: migration (auto-gerada)

- [ ] **Step 1: Adicionar campo ao InsurerTenantProfile**

Em `backend/core/apps/insurers/models.py`, após `observacoes_operacionais` (linha 137), adicionar:

```python
    class ImportTool(models.TextChoices):
        CILIA = "cilia", "Cilia (Webservice)"
        SOMA = "soma", "Soma (XML)"
        AUDATEX = "audatex", "Audatex (HTML)"
        MANUAL = "manual", "Manual"

    import_tool = models.CharField(
        max_length=20,
        choices=ImportTool.choices,
        default=ImportTool.MANUAL,
        verbose_name="Ferramenta de importação",
        help_text="Ferramenta usada para importar orçamentos desta seguradora.",
    )
```

- [ ] **Step 2: Gerar e aplicar migração**

```bash
cd backend/core && python manage.py makemigrations insurers --name add_import_tool
python manage.py migrate_schemas
```

- [ ] **Step 3: Expor no serializer**

Em `backend/core/apps/insurers/serializers.py`, adicionar `import_tool` ao serializer do InsurerTenantProfile (nos `fields`).

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/insurers/
git commit -m "feat(insurers): add import_tool field to InsurerTenantProfile"
```

---

## Task 3: Backend — Serializers para Versões, Diff e Complemento

**Files:**
- Modify: `backend/core/apps/service_orders/serializers.py`

- [ ] **Step 1: Adicionar `payer`, `source_type`, `billing_status` aos serializers existentes**

No `ServiceOrderPartSerializer`, adicionar aos `fields`:
```python
fields = [..., "payer", "source_type", "billing_status", "billed_at",
          "payer_display", "source_type_display", "billing_status_display"]
```

Adicionar method fields:
```python
payer_display = serializers.CharField(source="get_payer_display", read_only=True)
source_type_display = serializers.CharField(source="get_source_type_display", read_only=True)
billing_status_display = serializers.CharField(source="get_billing_status_display", read_only=True)
```

Mesma alteração no `ServiceOrderLaborSerializer`.

- [ ] **Step 2: Criar VersionDiffSerializer**

```python
class VersionItemCompactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderVersionItem
        fields = [
            "id", "bucket", "payer_block", "item_type", "description",
            "external_code", "part_type", "quantity", "unit_price",
            "discount_pct", "net_price", "flag_inclusao_manual",
        ]


class VersionDetailSerializer(serializers.ModelSerializer):
    items = VersionItemCompactSerializer(many=True, read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ServiceOrderVersion
        fields = [
            "id", "version_number", "external_version", "source", "source_display",
            "status", "status_display", "subtotal", "discount_total", "net_total",
            "labor_total", "parts_total", "total_seguradora",
            "total_complemento_particular", "total_franquia",
            "created_at", "approved_at", "items",
        ]


class VersionDiffItemSerializer(serializers.Serializer):
    description = serializers.CharField()
    item_type = serializers.CharField()
    old_value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    new_value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    change_type = serializers.ChoiceField(choices=["added", "removed", "changed", "unchanged"])
    is_executed = serializers.BooleanField(default=False)


class VersionDiffSerializer(serializers.Serializer):
    current_version = VersionDetailSerializer()
    new_version = VersionDetailSerializer()
    diff_items = VersionDiffItemSerializer(many=True)
    totals_diff = serializers.DictField()
```

- [ ] **Step 3: Criar ComplementItemSerializer**

```python
class ComplementPartCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderPart
        fields = [
            "description", "part_number", "ncm", "quantity", "unit_price",
            "discount", "tipo_qualidade",
        ]

    def create(self, validated_data: dict) -> ServiceOrderPart:
        validated_data["payer"] = "customer"
        validated_data["source_type"] = "complement"
        return super().create(validated_data)


class ComplementLaborCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrderLabor
        fields = ["description", "quantity", "unit_price", "discount", "service_catalog"]

    def create(self, validated_data: dict) -> ServiceOrderLabor:
        validated_data["payer"] = "customer"
        validated_data["source_type"] = "complement"
        return super().create(validated_data)
```

- [ ] **Step 4: Criar FinancialSummarySerializer**

```python
class FinancialSummarySerializer(serializers.Serializer):
    insurer_parts = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_labor = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)
    deductible = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_net = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_parts = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_labor = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_billed = serializers.DecimalField(max_digits=14, decimal_places=2)
    complement_pending = serializers.DecimalField(max_digits=14, decimal_places=2)
    customer_owes = serializers.DecimalField(max_digits=14, decimal_places=2)
    insurer_owes = serializers.DecimalField(max_digits=14, decimal_places=2)
    grand_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    active_version = VersionDetailSerializer(allow_null=True)
```

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/serializers.py
git commit -m "feat(service_orders): add serializers for versions, diff, complement, financial summary"
```

---

## Task 4: Backend — Service Layer para Diff, Override e Complemento

**Files:**
- Modify: `backend/core/apps/service_orders/services.py`

- [ ] **Step 1: Adicionar `compute_version_diff()` ao ServiceOrderService**

Após `recalculate_version_totals` (linha 602):

```python
    @classmethod
    def compute_version_diff(
        cls,
        *,
        current_version: "ServiceOrderVersion",
        new_version: "ServiceOrderVersion",
        service_order: "ServiceOrder",
    ) -> dict:
        """Computa diff entre duas versões, marcando itens executados."""
        current_items = {
            i.external_code or i.description: i
            for i in current_version.items.all()
        }
        new_items = {
            i.external_code or i.description: i
            for i in new_version.items.all()
        }

        # Itens já executados (peças instaladas/em andamento, serviços em andamento)
        executed_descriptions = set()
        executed_parts = service_order.parts.filter(
            source_type="import",
            status_peca__in=["bloqueada", "recebida", "comprada"],
        ).values_list("description", flat=True)
        executed_descriptions.update(executed_parts)

        all_keys = set(current_items) | set(new_items)
        diff_items = []

        for key in sorted(all_keys):
            old = current_items.get(key)
            new = new_items.get(key)
            is_executed = key in executed_descriptions

            if old and not new:
                diff_items.append({
                    "description": old.description,
                    "item_type": old.item_type,
                    "old_value": old.net_price,
                    "new_value": None,
                    "change_type": "removed",
                    "is_executed": is_executed,
                })
            elif new and not old:
                diff_items.append({
                    "description": new.description,
                    "item_type": new.item_type,
                    "old_value": None,
                    "new_value": new.net_price,
                    "change_type": "added",
                    "is_executed": False,
                })
            elif old and new:
                changed = old.net_price != new.net_price or old.quantity != new.quantity
                diff_items.append({
                    "description": new.description,
                    "item_type": new.item_type,
                    "old_value": old.net_price,
                    "new_value": new.net_price,
                    "change_type": "changed" if changed else "unchanged",
                    "is_executed": is_executed,
                })

        old_total = current_version.net_total or Decimal("0")
        new_total = new_version.net_total or Decimal("0")
        totals_diff = {
            "old_total": str(old_total),
            "new_total": str(new_total),
            "difference": str(new_total - old_total),
        }

        return {"diff_items": diff_items, "totals_diff": totals_diff}
```

- [ ] **Step 2: Adicionar `apply_version_override()` ao ServiceOrderService**

```python
    @classmethod
    @transaction.atomic
    def apply_version_override(
        cls,
        *,
        service_order: "ServiceOrder",
        new_version: "ServiceOrderVersion",
        applied_by: str = "Sistema",
    ) -> "ServiceOrderVersion":
        """Aplica override da nova versão, preservando itens executados e complemento."""
        from apps.service_orders.events import OSEventLogger

        # Supersede versões anteriores
        service_order.versions.exclude(pk=new_version.pk).exclude(
            status__in=["approved", "rejected", "autorizado", "negado", "superseded"],
        ).update(status="superseded")

        # Recalcula totais da nova versão
        cls.recalculate_version_totals(new_version)

        # Sincroniza itens importados na OS (Part/Labor), preservando executados e complemento
        # Remover itens importados pendentes (não executados)
        service_order.parts.filter(
            source_type="import",
            status_peca="manual",
        ).delete()
        service_order.labor_items.filter(
            source_type="import",
        ).exclude(
            billing_status="billed",
        ).delete()

        # Criar novos itens importados a partir da versão
        for item in new_version.items.all():
            if item.item_type == "PART":
                ServiceOrderPart.objects.create(
                    service_order=service_order,
                    description=item.description,
                    part_number=item.external_code,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.unit_price * item.quantity - item.net_price,
                    payer="insurer",
                    source_type="import",
                    origem="seguradora",
                    tipo_qualidade=cls._map_part_type(item.part_type),
                )
            elif item.item_type in ("SERVICE", "EXTERNAL_SERVICE"):
                ServiceOrderLabor.objects.create(
                    service_order=service_order,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.unit_price * item.quantity - item.net_price,
                    payer="insurer",
                    source_type="import",
                )

        OSEventLogger.log_event(
            service_order, "VERSION_APPROVED",
            actor=applied_by,
            payload={
                "version_number": new_version.version_number,
                "action": "override",
            },
            swallow_errors=True,
        )

        service_order.recalculate_totals()
        return new_version

    @staticmethod
    def _map_part_type(cilia_type: str) -> str:
        mapping = {
            "GENUINA": "genuina",
            "ORIGINAL": "genuina",
            "OUTRAS_FONTES": "reposicao",
            "VERDE": "usada",
        }
        return mapping.get(cilia_type, "")
```

- [ ] **Step 3: Adicionar `financial_summary()` ao ServiceOrderService**

```python
    @classmethod
    def financial_summary(cls, service_order: "ServiceOrder") -> dict:
        """Calcula resumo financeiro: seguradora + complemento."""
        from decimal import Decimal as D

        parts_insurer = D("0")
        labor_insurer = D("0")
        parts_complement = D("0")
        labor_complement = D("0")
        complement_billed = D("0")

        for part in service_order.parts.filter(is_active=True):
            amount = D(str(part.quantity)) * D(str(part.unit_price)) - D(str(part.discount))
            if part.source_type == "complement":
                parts_complement += amount
                if part.billing_status == "billed":
                    complement_billed += amount
            else:
                parts_insurer += amount

        for labor in service_order.labor_items.filter(is_active=True):
            amount = D(str(labor.quantity)) * D(str(labor.unit_price)) - D(str(labor.discount))
            if labor.source_type == "complement":
                labor_complement += amount
                if labor.billing_status == "billed":
                    complement_billed += amount
            else:
                labor_insurer += amount

        insurer_subtotal = parts_insurer + labor_insurer
        deductible = min(D(str(service_order.deductible_amount or 0)), insurer_subtotal)
        insurer_net = insurer_subtotal - deductible
        complement_subtotal = parts_complement + labor_complement
        complement_pending = complement_subtotal - complement_billed
        customer_owes = deductible + complement_pending
        grand_total = insurer_subtotal + complement_subtotal

        active_version = service_order.versions.order_by("-version_number").first()

        return {
            "insurer_parts": parts_insurer,
            "insurer_labor": labor_insurer,
            "insurer_subtotal": insurer_subtotal,
            "deductible": deductible,
            "insurer_net": insurer_net,
            "complement_parts": parts_complement,
            "complement_labor": labor_complement,
            "complement_subtotal": complement_subtotal,
            "complement_billed": complement_billed,
            "complement_pending": complement_pending,
            "customer_owes": customer_owes,
            "insurer_owes": insurer_net,
            "grand_total": grand_total,
            "active_version": active_version,
        }
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/services.py
git commit -m "feat(service_orders): add compute_version_diff, apply_version_override, financial_summary"
```

---

## Task 5: Backend — BillingService.bill_complement()

**Files:**
- Modify: `backend/core/apps/service_orders/billing.py`

- [ ] **Step 1: Adicionar `bill_complement()` ao BillingService**

Após `bill()` (fim do arquivo):

```python
    @classmethod
    @transaction.atomic
    def bill_complement(cls, order: Any, billed_by: str = "Sistema") -> dict[str, Any]:
        """Fatura itens pendentes do complemento particular.

        Cria receivables + emite NF-e (peças) e NFS-e (serviços) separados,
        tudo em nome do cliente. Pode ser chamado a qualquer momento,
        independente do status da OS.
        """
        from django.utils import timezone
        from apps.accounts_receivable.services import ReceivableDocumentService

        now = timezone.now()
        customer_name = order.customer_name or ""

        pending_parts = order.parts.filter(
            source_type="complement", billing_status="pending",
        )
        pending_labor = order.labor_items.filter(
            source_type="complement", billing_status="pending",
        )

        parts_total = sum(
            p.quantity * p.unit_price - p.discount for p in pending_parts
        )
        labor_total = sum(
            l.quantity * l.unit_price - l.discount for l in pending_labor
        )

        if parts_total + labor_total <= ZERO:
            return {"billed": False, "message": "Nenhum item pendente para faturar."}

        items = []
        if labor_total > ZERO:
            items.append({
                "recipient_type": "customer",
                "category": "services",
                "label": f"Complemento Serviços → {customer_name}",
                "amount": str(labor_total),
                "default_payment_method": "pix",
                "default_payment_term_days": 0,
            })
        if parts_total > ZERO:
            items.append({
                "recipient_type": "customer",
                "category": "parts",
                "label": f"Complemento Peças → {customer_name}",
                "amount": str(parts_total),
                "default_payment_method": "pix",
                "default_payment_term_days": 0,
            })

        # Criar receivables
        person = cls._resolve_customer_person(order)
        for item in items:
            ReceivableDocumentService.create_from_billing(
                order=order, person=person, billing_item=item,
            )

        # Marcar itens como faturados
        pending_parts.update(billing_status="billed", billed_at=now)
        pending_labor.update(billing_status="billed", billed_at=now)

        # Log
        ServiceOrderActivityLog.objects.create(
            service_order=order,
            activity_type="billing",
            description=f"Complemento particular faturado: R$ {parts_total + labor_total:.2f}",
            created_by=billed_by,
        )

        return {
            "billed": True,
            "parts_total": str(parts_total),
            "labor_total": str(labor_total),
            "items_count": pending_parts.count() + pending_labor.count(),
        }
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/service_orders/billing.py
git commit -m "feat(billing): add bill_complement for independent particular billing"
```

---

## Task 6: Backend — ViewSet Actions para Import, Versions, Complement

**Files:**
- Modify: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/urls.py`

- [ ] **Step 1: Adicionar action `import_budget` ao ServiceOrderViewSet**

```python
    @action(detail=True, methods=["post"], url_path="import-budget")
    def import_budget(self, request, pk=None):
        """Importa orçamento via Cilia (webservice), Soma (XML) ou Audatex (HTML)."""
        order = self.get_object()
        source = request.data.get("source", "cilia")

        if source == "cilia":
            casualty_number = request.data.get("casualty_number", order.casualty_number)
            budget_number = request.data.get("budget_number")
            version_number = request.data.get("version_number")

            if not casualty_number or not budget_number:
                return Response(
                    {"error": "casualty_number e budget_number são obrigatórios."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from apps.cilia.dtos import ImportService
            attempt = ImportService.fetch_cilia_budget(
                casualty_number=casualty_number,
                budget_number=budget_number,
                version_number=version_number,
                trigger="user_requested",
                created_by=request.user.email or "user",
            )

            if not attempt.parsed_ok:
                return Response(
                    {"error": attempt.error_message, "error_type": attempt.error_type},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            version = attempt.version_created
            # Se já existia versão anterior, retornar diff
            versions = order.versions.order_by("-version_number")
            if versions.count() > 1:
                current = versions.exclude(pk=version.pk).first()
                diff = ServiceOrderService.compute_version_diff(
                    current_version=current,
                    new_version=version,
                    service_order=order,
                )
                return Response({
                    "action": "diff",
                    "current_version": VersionDetailSerializer(current).data,
                    "new_version": VersionDetailSerializer(version).data,
                    **diff,
                })

            # Primeira importação — aplicar direto
            ServiceOrderService.apply_version_override(
                service_order=order, new_version=version,
                applied_by=request.user.email or "user",
            )
            return Response({
                "action": "applied",
                "version": VersionDetailSerializer(version).data,
            }, status=status.HTTP_201_CREATED)

        elif source in ("soma", "audatex"):
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return Response(
                    {"error": "Arquivo é obrigatório para importação XML/HTML."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from apps.cilia.dtos import ImportService
            attempt = ImportService.import_xml_ifx(
                file_content=uploaded_file.read().decode("utf-8"),
                source=f"xml_{source}" if source == "soma" else source,
                service_order=order,
                created_by=request.user.email or "user",
            )

            if not attempt.parsed_ok:
                return Response(
                    {"error": attempt.error_message},
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )

            return Response({
                "action": "applied",
                "version": VersionDetailSerializer(attempt.version_created).data,
            }, status=status.HTTP_201_CREATED)

        return Response(
            {"error": f"Fonte '{source}' não suportada."},
            status=status.HTTP_400_BAD_REQUEST,
        )
```

- [ ] **Step 2: Adicionar action `apply_version` ao ServiceOrderViewSet**

```python
    @action(detail=True, methods=["post"], url_path="versions/(?P<version_pk>[^/.]+)/apply")
    def apply_version(self, request, pk=None, version_pk=None):
        """Aplica override de uma versão sobre a OS."""
        order = self.get_object()
        version = get_object_or_404(order.versions, pk=version_pk)

        ServiceOrderService.apply_version_override(
            service_order=order,
            new_version=version,
            applied_by=request.user.email or "user",
        )
        return Response({"status": "applied"})
```

- [ ] **Step 3: Adicionar action `version_diff` ao ServiceOrderViewSet**

```python
    @action(detail=True, methods=["get"], url_path="versions/(?P<version_pk>[^/.]+)/diff")
    def version_diff(self, request, pk=None, version_pk=None):
        """Retorna diff entre versão ativa e versão especificada."""
        order = self.get_object()
        new_version = get_object_or_404(order.versions, pk=version_pk)
        current = order.versions.exclude(pk=new_version.pk).order_by("-version_number").first()

        if not current:
            return Response({"error": "Sem versão anterior para comparar."}, status=400)

        diff = ServiceOrderService.compute_version_diff(
            current_version=current, new_version=new_version, service_order=order,
        )
        return Response({
            "current_version": VersionDetailSerializer(current).data,
            "new_version": VersionDetailSerializer(new_version).data,
            **diff,
        })
```

- [ ] **Step 4: Adicionar actions de complemento ao ServiceOrderViewSet**

```python
    @action(detail=True, methods=["get", "post"], url_path="complement/parts")
    def complement_parts(self, request, pk=None):
        """Lista ou adiciona peças do complemento particular."""
        order = self.get_object()

        if request.method == "GET":
            parts = order.parts.filter(source_type="complement")
            return Response(ServiceOrderPartSerializer(parts, many=True).data)

        serializer = ComplementPartCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        part = serializer.save(service_order=order)

        OSEventLogger.log_event(
            order, "COMPLEMENT_ADDED",
            actor=request.user.email or "user",
            payload={"item_type": "part", "description": part.description},
            swallow_errors=True,
        )
        return Response(ServiceOrderPartSerializer(part).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="complement/services")
    def complement_services(self, request, pk=None):
        """Lista ou adiciona serviços do complemento particular."""
        order = self.get_object()

        if request.method == "GET":
            labor = order.labor_items.filter(source_type="complement")
            return Response(ServiceOrderLaborSerializer(labor, many=True).data)

        serializer = ComplementLaborCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        labor = serializer.save(service_order=order)

        OSEventLogger.log_event(
            order, "COMPLEMENT_ADDED",
            actor=request.user.email or "user",
            payload={"item_type": "service", "description": labor.description},
            swallow_errors=True,
        )
        return Response(ServiceOrderLaborSerializer(labor).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="complement/(?P<item_pk>[^/.]+)")
    def complement_item(self, request, pk=None, item_pk=None):
        """Edita ou remove item do complemento."""
        order = self.get_object()

        # Tentar em parts primeiro, depois em labor
        part = order.parts.filter(pk=item_pk, source_type="complement").first()
        if part:
            if part.billing_status == "billed":
                return Response({"error": "Item já faturado."}, status=400)
            if request.method == "DELETE":
                part.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            for field, value in request.data.items():
                if hasattr(part, field) and field not in ("id", "pk", "payer", "source_type"):
                    setattr(part, field, value)
            part.save()
            return Response(ServiceOrderPartSerializer(part).data)

        labor = order.labor_items.filter(pk=item_pk, source_type="complement").first()
        if labor:
            if labor.billing_status == "billed":
                return Response({"error": "Item já faturado."}, status=400)
            if request.method == "DELETE":
                labor.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            for field, value in request.data.items():
                if hasattr(labor, field) and field not in ("id", "pk", "payer", "source_type"):
                    setattr(labor, field, value)
            labor.save()
            return Response(ServiceOrderLaborSerializer(labor).data)

        return Response({"error": "Item não encontrado."}, status=404)

    @action(detail=True, methods=["post"], url_path="complement/bill")
    def complement_bill(self, request, pk=None):
        """Fatura itens pendentes do complemento particular."""
        order = self.get_object()
        result = BillingService.bill_complement(
            order, billed_by=request.user.email or "user",
        )
        return Response(result)

    @action(detail=True, methods=["get"], url_path="financial-summary")
    def financial_summary(self, request, pk=None):
        """Resumo financeiro consolidado (seguradora + complemento)."""
        order = self.get_object()
        summary = ServiceOrderService.financial_summary(order)
        return Response(FinancialSummarySerializer(summary).data)
```

- [ ] **Step 5: Adicionar imports necessários no topo do views.py**

```python
from .serializers import (
    ...,
    VersionDetailSerializer, VersionDiffSerializer,
    ComplementPartCreateSerializer, ComplementLaborCreateSerializer,
    FinancialSummarySerializer,
)
from .billing import BillingService
from .services import ServiceOrderService
from apps.service_orders.events import OSEventLogger
```

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/views.py backend/core/apps/service_orders/urls.py
git commit -m "feat(service_orders): add import, versions diff/override, complement CRUD, billing endpoints"
```

---

## Task 7: Backend — Testes do Fluxo de Importação e Complemento

**Files:**
- Create: `backend/core/apps/service_orders/tests/test_complement.py`
- Create: `backend/core/apps/service_orders/tests/test_import_flow.py`
- Create: `backend/core/apps/service_orders/tests/test_financial_summary.py`

- [ ] **Step 1: Criar test_complement.py**

```python
"""Testes do fluxo de complemento particular."""
import pytest
from decimal import Decimal
from django.test import override_settings
from rest_framework import status as http_status
from rest_framework.test import APIClient

from apps.service_orders.models import ServiceOrder, ServiceOrderPart, ServiceOrderLabor


@pytest.mark.django_db
class TestComplementCRUD:
    """CRUD de itens do complemento particular."""

    def test_add_complement_part(self, authenticated_client, service_order):
        """Adicionar peça ao complemento marca payer=customer, source_type=complement."""
        url = f"/api/v1/service-orders/{service_order.pk}/complement/parts/"
        payload = {
            "description": "Polimento cristalizado",
            "quantity": 1,
            "unit_price": "350.00",
            "discount": "0.00",
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        part = ServiceOrderPart.objects.get(pk=response.data["id"])
        assert part.payer == "customer"
        assert part.source_type == "complement"
        assert part.billing_status == "pending"

    def test_add_complement_service(self, authenticated_client, service_order):
        """Adicionar serviço ao complemento marca payer=customer, source_type=complement."""
        url = f"/api/v1/service-orders/{service_order.pk}/complement/services/"
        payload = {
            "description": "Película fumê G5",
            "quantity": 1,
            "unit_price": "280.00",
            "discount": "0.00",
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        labor = ServiceOrderLabor.objects.get(pk=response.data["id"])
        assert labor.payer == "customer"
        assert labor.source_type == "complement"

    def test_cannot_edit_billed_item(self, authenticated_client, service_order):
        """Itens faturados não podem ser editados."""
        part = ServiceOrderPart.objects.create(
            service_order=service_order,
            description="Teste",
            quantity=1, unit_price=Decimal("100"),
            payer="customer", source_type="complement",
            billing_status="billed",
        )
        url = f"/api/v1/service-orders/{service_order.pk}/complement/{part.pk}/"
        response = authenticated_client.patch(
            url, {"description": "Novo"}, format="json",
        )
        assert response.status_code == 400

    def test_cannot_delete_billed_item(self, authenticated_client, service_order):
        """Itens faturados não podem ser deletados."""
        part = ServiceOrderPart.objects.create(
            service_order=service_order,
            description="Teste",
            quantity=1, unit_price=Decimal("100"),
            payer="customer", source_type="complement",
            billing_status="billed",
        )
        url = f"/api/v1/service-orders/{service_order.pk}/complement/{part.pk}/"
        response = authenticated_client.delete(url)
        assert response.status_code == 400


@pytest.mark.django_db
class TestComplementBilling:
    """Faturamento independente do complemento."""

    def test_bill_pending_complement(self, authenticated_client, service_order):
        """Faturar complemento marca itens como billed."""
        ServiceOrderPart.objects.create(
            service_order=service_order,
            description="Polimento",
            quantity=1, unit_price=Decimal("350"),
            payer="customer", source_type="complement",
        )
        url = f"/api/v1/service-orders/{service_order.pk}/complement/bill/"
        response = authenticated_client.post(url)
        assert response.status_code == 200
        assert response.data["billed"] is True

        part = service_order.parts.filter(source_type="complement").first()
        part.refresh_from_db()
        assert part.billing_status == "billed"
        assert part.billed_at is not None

    def test_bill_empty_complement(self, authenticated_client, service_order):
        """Faturar sem itens pendentes retorna billed=False."""
        url = f"/api/v1/service-orders/{service_order.pk}/complement/bill/"
        response = authenticated_client.post(url)
        assert response.status_code == 200
        assert response.data["billed"] is False
```

- [ ] **Step 2: Criar test_financial_summary.py**

```python
"""Testes do resumo financeiro."""
import pytest
from decimal import Decimal

from apps.service_orders.models import ServiceOrderPart, ServiceOrderLabor
from apps.service_orders.services import ServiceOrderService


@pytest.mark.django_db
class TestFinancialSummary:

    def test_summary_insurer_with_complement(self, service_order_insurer):
        """Resumo separa seguradora vs complemento corretamente."""
        os = service_order_insurer
        os.deductible_amount = Decimal("1000")
        os.save()

        # Peça seguradora
        ServiceOrderPart.objects.create(
            service_order=os, description="Para-choque",
            quantity=1, unit_price=Decimal("1200"),
            payer="insurer", source_type="import",
        )
        # Peça complemento
        ServiceOrderPart.objects.create(
            service_order=os, description="Kit LED",
            quantity=1, unit_price=Decimal("190"),
            payer="customer", source_type="complement",
        )
        # Serviço complemento já faturado
        ServiceOrderLabor.objects.create(
            service_order=os, description="Polimento",
            quantity=1, unit_price=Decimal("350"),
            payer="customer", source_type="complement",
            billing_status="billed",
        )

        summary = ServiceOrderService.financial_summary(os)
        assert summary["insurer_parts"] == Decimal("1200")
        assert summary["deductible"] == Decimal("1000")
        assert summary["insurer_net"] == Decimal("200")
        assert summary["complement_subtotal"] == Decimal("540")
        assert summary["complement_billed"] == Decimal("350")
        assert summary["complement_pending"] == Decimal("190")
        assert summary["customer_owes"] == Decimal("1190")  # franquia + complemento pendente
```

- [ ] **Step 3: Rodar testes**

```bash
cd backend/core && python -m pytest apps/service_orders/tests/test_complement.py apps/service_orders/tests/test_financial_summary.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/tests/
git commit -m "test(service_orders): add tests for complement CRUD, billing, financial summary"
```

---

## Task 8: Frontend — Types para Versões, Complemento e Resumo Financeiro

**Files:**
- Modify: `packages/types/src/service-order.types.ts`

- [ ] **Step 1: Adicionar tipos**

No final do arquivo, adicionar:

```typescript
// ── Versões / Import ─────────────────────────────────────────────
export interface ServiceOrderVersionItem {
  id: string
  bucket: string
  payer_block: string
  item_type: "PART" | "SERVICE" | "EXTERNAL_SERVICE" | "FEE"
  description: string
  external_code: string
  part_type: string
  quantity: number
  unit_price: number
  discount_pct: number
  net_price: number
  flag_inclusao_manual: boolean
}

export interface ServiceOrderVersion {
  id: string
  version_number: number
  external_version: string
  source: string
  source_display: string
  status: string
  status_display: string
  subtotal: string
  discount_total: string
  net_total: string
  labor_total: string
  parts_total: string
  total_seguradora: string
  total_complemento_particular: string
  total_franquia: string
  created_at: string
  approved_at: string | null
  items: ServiceOrderVersionItem[]
}

export interface VersionDiffItem {
  description: string
  item_type: string
  old_value: string | null
  new_value: string | null
  change_type: "added" | "removed" | "changed" | "unchanged"
  is_executed: boolean
}

export interface VersionDiffResponse {
  action: "diff"
  current_version: ServiceOrderVersion
  new_version: ServiceOrderVersion
  diff_items: VersionDiffItem[]
  totals_diff: {
    old_total: string
    new_total: string
    difference: string
  }
}

export interface ImportBudgetResponse {
  action: "applied" | "diff"
  version?: ServiceOrderVersion
  current_version?: ServiceOrderVersion
  new_version?: ServiceOrderVersion
  diff_items?: VersionDiffItem[]
  totals_diff?: { old_total: string; new_total: string; difference: string }
}

// ── Complemento Particular ───────────────────────────────────────
export type PayerType = "insurer" | "customer"
export type SourceType = "import" | "complement" | "manual"
export type BillingStatusType = "pending" | "billed"

// ── Resumo Financeiro ────────────────────────────────────────────
export interface FinancialSummary {
  insurer_parts: string
  insurer_labor: string
  insurer_subtotal: string
  deductible: string
  insurer_net: string
  complement_parts: string
  complement_labor: string
  complement_subtotal: string
  complement_billed: string
  complement_pending: string
  customer_owes: string
  insurer_owes: string
  grand_total: string
  active_version: ServiceOrderVersion | null
}
```

- [ ] **Step 2: Adicionar campos aos tipos existentes de Part e Labor**

No tipo `ServiceOrderPart`, adicionar:
```typescript
  payer: PayerType
  payer_display: string
  source_type: SourceType
  source_type_display: string
  billing_status: BillingStatusType
  billing_status_display: string
  billed_at: string | null
```

Mesma alteração no tipo `ServiceOrderLabor`.

- [ ] **Step 3: Commit**

```bash
git add packages/types/
git commit -m "feat(types): add types for versions, diff, complement, financial summary"
```

---

## Task 9: Frontend — Modal de Importação de Orçamento

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportBudgetModal.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Upload, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ImportBudgetResponse, ServiceOrder } from "@paddock/types"
import { ImportDiffView } from "./ImportDiffView"

const SOURCES = [
  { id: "cilia", label: "Cilia", sub: "Webservice" },
  { id: "soma", label: "Soma", sub: "Upload XML" },
  { id: "audatex", label: "Audatex", sub: "Upload HTML" },
] as const

type SourceId = (typeof SOURCES)[number]["id"]

interface Props {
  order: ServiceOrder
  defaultSource?: SourceId
  open: boolean
  onClose: () => void
}

export function ImportBudgetModal({ order, defaultSource = "cilia", open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState<SourceId>(defaultSource)
  const [casualtyNumber, setCasualtyNumber] = useState(order.casualty_number ?? "")
  const [budgetNumber, setBudgetNumber] = useState("")
  const [versionNumber, setVersionNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [diffResult, setDiffResult] = useState<ImportBudgetResponse | null>(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      if (source === "cilia") {
        return apiFetch<ImportBudgetResponse>(
          `/api/proxy/service-orders/${order.id}/import-budget/`,
          {
            method: "POST",
            body: JSON.stringify({
              source: "cilia",
              casualty_number: casualtyNumber,
              budget_number: budgetNumber,
              version_number: versionNumber || undefined,
            }),
          },
        )
      }
      // Soma / Audatex — upload
      const formData = new FormData()
      formData.append("source", source)
      if (file) formData.append("file", file)
      return apiFetch<ImportBudgetResponse>(
        `/api/proxy/service-orders/${order.id}/import-budget/`,
        { method: "POST", body: formData, isFormData: true },
      )
    },
    onSuccess: (data) => {
      if (data.action === "diff") {
        setDiffResult(data)
      } else {
        toast.success("Orçamento importado com sucesso!")
        queryClient.invalidateQueries({ queryKey: ["service-order", order.id] })
        onClose()
      }
    },
    onError: () => {
      toast.error("Erro ao importar orçamento. Tente novamente.")
    },
  })

  const applyMutation = useMutation({
    mutationFn: async (versionId: string) => {
      return apiFetch(
        `/api/proxy/service-orders/${order.id}/versions/${versionId}/apply/`,
        { method: "POST" },
      )
    },
    onSuccess: () => {
      toast.success("Nova versão aplicada com sucesso!")
      queryClient.invalidateQueries({ queryKey: ["service-order", order.id] })
      onClose()
    },
    onError: () => {
      toast.error("Erro ao aplicar versão. Tente novamente.")
    },
  })

  if (!open) return null

  // Mostrar diff se houver
  if (diffResult && diffResult.action === "diff") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-surface-900 shadow-2xl">
          <ImportDiffView
            diffResult={diffResult}
            onApply={() => {
              if (diffResult.new_version) {
                applyMutation.mutate(diffResult.new_version.id)
              }
            }}
            onCancel={() => { setDiffResult(null); onClose() }}
            isApplying={applyMutation.isPending}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-surface-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Importar Orçamento</h2>

        {/* Fonte selector */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/50">
            Fonte de Importação
          </label>
          <div className="flex gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={cn(
                  "flex-1 rounded-lg border p-3 text-center transition",
                  source === s.id
                    ? "border-info-500 bg-info-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
              >
                <div className={cn("text-sm font-semibold", source === s.id ? "text-info-500" : "text-white/60")}>
                  {s.label}
                </div>
                <div className="text-[11px] text-white/40">{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cilia fields */}
        {source === "cilia" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/50">Nº Sinistro</label>
              <input
                type="text"
                value={casualtyNumber}
                onChange={(e) => setCasualtyNumber(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Nº Orçamento</label>
              <input
                type="text"
                value={budgetNumber}
                onChange={(e) => setBudgetNumber(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Versão <span className="text-white/30">(vazio = mais recente)</span>
              </label>
              <input
                type="text"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="Ex: 3"
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        )}

        {/* Upload fields */}
        {source !== "cilia" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/50">
                Arquivo {source === "soma" ? "XML" : "HTML"}
              </label>
              <input
                type="file"
                accept={source === "soma" ? ".xml" : ".html,.htm"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-white hover:bg-info-700 disabled:opacity-50"
          >
            {importMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
            ) : source === "cilia" ? (
              <><Search className="h-4 w-4" /> Consultar</>
            ) : (
              <><Upload className="h-4 w-4" /> Importar</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ImportBudgetModal.tsx
git commit -m "feat(web): add ImportBudgetModal component"
```

---

## Task 10: Frontend — Componente ImportDiffView

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ImportDiffView.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImportBudgetResponse, VersionDiffItem } from "@paddock/types"

const CHANGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  added: { bg: "bg-success-500/10", text: "text-success-500", label: "+ Novo" },
  removed: { bg: "bg-error-500/10", text: "text-error-500", label: "Removido" },
  changed: { bg: "bg-warning-500/10", text: "text-warning-500", label: "Alterado" },
  unchanged: { bg: "", text: "text-white/40", label: "—" },
}

interface Props {
  diffResult: ImportBudgetResponse
  onApply: () => void
  onCancel: () => void
  isApplying: boolean
}

export function ImportDiffView({ diffResult, onApply, onCancel, isApplying }: Props) {
  const { current_version, new_version, diff_items, totals_diff } = diffResult
  if (!current_version || !new_version || !diff_items || !totals_diff) return null

  const difference = parseFloat(totals_diff.difference)

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Nova Versão Encontrada — v{new_version.version_number}
      </h2>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Versão Atual</div>
          <div className="text-xl font-bold text-white/60">v{current_version.version_number}</div>
        </div>
        <div className="rounded-lg border border-info-500/30 bg-info-500/10 p-3">
          <div className="text-[11px] uppercase text-info-500">Nova Versão</div>
          <div className="text-xl font-bold text-info-500">v{new_version.version_number}</div>
        </div>
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Total Anterior</div>
          <div className="text-xl font-bold text-white">
            R$ {parseFloat(totals_diff.old_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Novo Total</div>
          <div className={cn("text-xl font-bold", difference >= 0 ? "text-success-500" : "text-error-500")}>
            R$ {parseFloat(totals_diff.new_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div className={cn("text-[11px]", difference >= 0 ? "text-success-500" : "text-error-500")}>
            {difference >= 0 ? "+" : ""}R$ {difference.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Diff table */}
      <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-800">
              <th className="px-3 py-2 text-left font-semibold text-white/60">Item</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Tipo</th>
              <th className="px-3 py-2 text-right font-semibold text-white/60">Anterior</th>
              <th className="px-3 py-2 text-right font-semibold text-white/60">Novo</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Alteração</th>
            </tr>
          </thead>
          <tbody>
            {diff_items.map((item: VersionDiffItem, i: number) => {
              const style = CHANGE_STYLES[item.change_type]
              return (
                <tr key={i} className={cn("border-t border-white/5", style.bg)}>
                  <td className={cn("px-3 py-2", item.change_type === "removed" ? "line-through text-error-500" : "text-white")}>
                    {item.description}
                    {item.is_executed && (
                      <span className="ml-2 rounded bg-warning-500/15 px-1.5 py-0.5 text-[10px] text-warning-500">
                        Executado
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn(
                      "rounded px-2 py-0.5 text-[11px]",
                      item.item_type === "PART" ? "bg-info-900/50 text-info-400" : "bg-warning-900/50 text-warning-400",
                    )}>
                      {item.item_type === "PART" ? "Peça" : "MO"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-white/60">
                    {item.old_value ? `R$ ${parseFloat(item.old_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right", style.text)}>
                    {item.new_value ? `R$ ${parseFloat(item.new_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn("rounded px-2 py-0.5 text-[11px]", `${style.bg} ${style.text}`)}>
                      {style.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Executed items warning */}
      {diff_items.some((i: VersionDiffItem) => i.is_executed) && (
        <div className="mb-5 flex gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 p-3 text-xs text-warning-400">
          <span>⚠</span>
          <span>
            <strong>{diff_items.filter((i: VersionDiffItem) => i.is_executed).length} itens já executados</strong>{" "}
            serão preservados independente do override.
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isApplying}
          onClick={onApply}
          className="inline-flex items-center gap-2 rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-white hover:bg-info-700 disabled:opacity-50"
        >
          {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Aplicar Versão v{new_version.version_number}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ImportDiffView.tsx
git commit -m "feat(web): add ImportDiffView component for version comparison"
```

---

## Task 11: Frontend — Aba InsurerBudgetTab

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/InsurerBudgetTab.tsx`

- [ ] **Step 1: Criar componente**

A aba mostra itens importados read-only com badge de versão, link para versões anteriores, e botão "Verificar Nova Versão". Usar `useQuery` para buscar versões da OS via `/api/proxy/service-orders/{id}/versions/`. Tabela de itens da versão ativa com colunas: Item, Tipo (Peça/MO badge), Qtd, Valor, Status. Totais: Peças, Mão de Obra, Franquia, Total Seguradora. Seguir o padrão visual do mockup aprovado (seção 1 do complemento-particular.html).

Referência de estilo: usar os mesmos padrões de `PartsTab.tsx` e `ServicesTab.tsx` para tabelas, badges, e layout.

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ServiceOrder, ServiceOrderVersion } from "@paddock/types"

interface Props {
  order: ServiceOrder
  onOpenImport: () => void
}

export function InsurerBudgetTab({ order, onOpenImport }: Props) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["service-order-versions", order.id],
    queryFn: () => apiFetch<ServiceOrderVersion[]>(
      `/api/proxy/service-orders/versions/?service_order=${order.id}`,
    ),
  })

  const activeVersion = versions?.[0] // ordered by -version_number

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }

  if (!activeVersion) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/40">
        <p>Nenhum orçamento importado ainda.</p>
        <button
          type="button"
          onClick={onOpenImport}
          className="rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-white hover:bg-info-700"
        >
          Importar Orçamento
        </button>
      </div>
    )
  }

  const fmtMoney = (v: string | number) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="space-y-4 py-4">
      {/* Header: versão + ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-info-500/15 px-3 py-1 text-xs font-semibold text-info-500">
            {activeVersion.source_display} v{activeVersion.version_number}
          </span>
          <span className="text-xs text-white/40">
            Importada em {new Date(activeVersion.created_at).toLocaleDateString("pt-BR")}
          </span>
          {versions && versions.length > 1 && (
            <span className="text-xs text-info-500">
              {versions.length - 1} versões anteriores
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenImport}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"
        >
          ⬇ Verificar Nova Versão
        </button>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="flex items-center justify-between bg-surface-800 px-3 py-2">
          <span className="text-xs text-white/40">Itens do orçamento da seguradora (somente leitura)</span>
          <span className="text-xs text-white/40">🔒 Gerenciado pela seguradora</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-800/50">
              <th className="px-3 py-2 text-left font-semibold text-white/60">Item</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Tipo</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Qtd</th>
              <th className="px-3 py-2 text-right font-semibold text-white/60">Valor</th>
            </tr>
          </thead>
          <tbody>
            {activeVersion.items.map((item) => (
              <tr key={item.id} className="border-t border-white/5">
                <td className="px-3 py-2.5 text-white">{item.description}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn(
                    "rounded px-2 py-0.5 text-[11px]",
                    item.item_type === "PART"
                      ? "bg-info-900/50 text-info-400"
                      : "bg-warning-900/50 text-warning-400",
                  )}>
                    {item.item_type === "PART" ? "Peça" : "MO"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-white">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right text-white">{fmtMoney(item.net_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end gap-3">
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-white/40">Peças</div>
          <div className="text-base font-bold text-white">{fmtMoney(activeVersion.parts_total)}</div>
        </div>
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-white/40">Mão de Obra</div>
          <div className="text-base font-bold text-white">{fmtMoney(activeVersion.labor_total)}</div>
        </div>
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-white/40">Franquia</div>
          <div className="text-base font-bold text-warning-500">{fmtMoney(activeVersion.total_franquia)}</div>
        </div>
        <div className="rounded-lg border border-info-500/30 bg-info-500/10 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-info-500">Total Seguradora</div>
          <div className="text-lg font-bold text-info-500">{fmtMoney(activeVersion.total_seguradora)}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/InsurerBudgetTab.tsx
git commit -m "feat(web): add InsurerBudgetTab — read-only insurer budget versions"
```

---

## Task 12: Frontend — Aba ComplementTab

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ComplementTab.tsx`

- [ ] **Step 1: Criar componente**

Aba com: banner informativo âmbar, botões "Adicionar Peça" / "Adicionar Serviço", tabela de itens com colunas (Item, Tipo, Qtd, Unit, Total, Faturado, Ações), totais (Já Faturado, Pendente, Total), botão "Faturar Itens Pendentes". Itens faturados são read-only. Usar mutations para POST/PATCH/DELETE nos endpoints de complemento.

Seguir os mesmos padrões de `PartsTab.tsx` para formulários inline (adicionar item inline, não em modal separado). Cores âmbar (`warning-*` tokens) para o complemento.

```tsx
"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ServiceOrderPart, ServiceOrderLabor } from "@paddock/types"

interface Props {
  orderId: string
}

export function ComplementTab({ orderId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ["complement", orderId]

  const { data: parts = [] } = useQuery({
    queryKey: [...queryKey, "parts"],
    queryFn: () => apiFetch<ServiceOrderPart[]>(
      `/api/proxy/service-orders/${orderId}/complement/parts/`,
    ),
  })

  const { data: services = [] } = useQuery({
    queryKey: [...queryKey, "services"],
    queryFn: () => apiFetch<ServiceOrderLabor[]>(
      `/api/proxy/service-orders/${orderId}/complement/services/`,
    ),
  })

  const billMutation = useMutation({
    mutationFn: () => apiFetch(
      `/api/proxy/service-orders/${orderId}/complement/bill/`,
      { method: "POST" },
    ),
    onSuccess: (data: any) => {
      if (data.billed) {
        toast.success("Complemento faturado com sucesso!")
        queryClient.invalidateQueries({ queryKey })
      } else {
        toast.info(data.message)
      }
    },
    onError: () => toast.error("Erro ao faturar. Tente novamente."),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => apiFetch(
      `/api/proxy/service-orders/${orderId}/complement/${itemId}/`,
      { method: "DELETE" },
    ),
    onSuccess: () => {
      toast.success("Item removido.")
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error("Erro ao remover item."),
  })

  const fmtMoney = (v: number | string) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  const allItems = [
    ...parts.map((p) => ({ ...p, kind: "part" as const })),
    ...services.map((s) => ({ ...s, kind: "service" as const })),
  ]

  const totalBilled = allItems
    .filter((i) => i.billing_status === "billed")
    .reduce((sum, i) => sum + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)) - parseFloat(String(i.discount))), 0)

  const totalPending = allItems
    .filter((i) => i.billing_status === "pending")
    .reduce((sum, i) => sum + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)) - parseFloat(String(i.discount))), 0)

  const grandTotal = totalBilled + totalPending

  const [showAddPart, setShowAddPart] = useState(false)
  const [showAddService, setShowAddService] = useState(false)

  return (
    <div className="space-y-4 py-4">
      {/* Info banner */}
      <div className="flex gap-3 rounded-lg border border-warning-500/25 bg-warning-500/5 p-3">
        <span className="text-warning-500">💰</span>
        <div>
          <div className="text-sm font-semibold text-warning-400">Itens cobrados diretamente do cliente</div>
          <div className="text-xs text-white/50">
            Serviços extras fora da cobertura da seguradora. Faturamento independente.
          </div>
        </div>
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowAddPart(!showAddPart)}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400 hover:bg-warning-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar Peça
        </button>
        <button
          type="button"
          onClick={() => setShowAddService(!showAddService)}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400 hover:bg-warning-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar Serviço
        </button>
      </div>

      {/* Inline add forms - to be wired with mutations */}
      {showAddPart && (
        <ComplementAddForm
          orderId={orderId}
          kind="part"
          onClose={() => setShowAddPart(false)}
        />
      )}
      {showAddService && (
        <ComplementAddForm
          orderId={orderId}
          kind="service"
          onClose={() => setShowAddService(false)}
        />
      )}

      {/* Items table */}
      {allItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-warning-500/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warning-500/5">
                <th className="px-3 py-2 text-left font-semibold text-warning-400">Item</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Tipo</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold text-warning-400">Unit.</th>
                <th className="px-3 py-2 text-right font-semibold text-warning-400">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Faturado</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => {
                const total = parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price)) - parseFloat(String(item.discount))
                const isBilled = item.billing_status === "billed"
                return (
                  <tr key={item.id} className="border-t border-white/5">
                    <td className="px-3 py-2.5 text-white">{item.description}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        item.kind === "part"
                          ? "bg-info-900/50 text-info-400"
                          : "bg-warning-900/50 text-warning-400",
                      )}>
                        {item.kind === "part" ? "Peça" : "Serviço"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-white">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmtMoney(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-white">{fmtMoney(total)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        isBilled
                          ? "bg-success-500/15 text-success-500"
                          : "bg-warning-500/15 text-warning-500",
                      )}>
                        {isBilled ? "✓ Faturado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isBilled ? (
                        <span className="text-white/20">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" className="text-info-500 hover:text-info-400">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-error-500 hover:text-error-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals + bill button */}
      <div className="flex items-end justify-between">
        <div className="flex gap-3">
          <div className="rounded-lg bg-surface-800 px-4 py-3">
            <div className="text-[11px] uppercase text-white/40">Já Faturado</div>
            <div className="text-base font-bold text-success-500">{fmtMoney(totalBilled)}</div>
          </div>
          <div className="rounded-lg bg-surface-800 px-4 py-3">
            <div className="text-[11px] uppercase text-white/40">Pendente</div>
            <div className="text-base font-bold text-warning-500">{fmtMoney(totalPending)}</div>
          </div>
          <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3">
            <div className="text-[11px] uppercase text-warning-500">Total Complemento</div>
            <div className="text-lg font-bold text-warning-400">{fmtMoney(grandTotal)}</div>
          </div>
        </div>
        {totalPending > 0 && (
          <button
            type="button"
            disabled={billMutation.isPending}
            onClick={() => billMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-warning-600 px-4 py-2.5 text-sm font-bold text-surface-900 hover:bg-warning-500 disabled:opacity-50"
          >
            {billMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Faturar Itens Pendentes
          </button>
        )}
      </div>
    </div>
  )
}

// ── Formulário inline de adição ──────────────────────────────────
function ComplementAddForm({
  orderId,
  kind,
  onClose,
}: {
  orderId: string
  kind: "part" | "service"
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch(
        `/api/proxy/service-orders/${orderId}/complement/${kind === "part" ? "parts" : "services"}/`,
        {
          method: "POST",
          body: JSON.stringify({
            description,
            quantity,
            unit_price: unitPrice,
            discount: "0.00",
          }),
        },
      ),
    onSuccess: () => {
      toast.success(`${kind === "part" ? "Peça" : "Serviço"} adicionado(a)!`)
      queryClient.invalidateQueries({ queryKey: ["complement", orderId] })
      onClose()
    },
    onError: () => toast.error("Erro ao adicionar item."),
  })

  return (
    <div className="flex items-end gap-3 rounded-lg border border-warning-500/20 bg-warning-500/5 p-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-white/50">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="w-20">
        <label className="mb-1 block text-xs text-white/50">Qtd</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="w-28">
        <label className="mb-1 block text-xs text-white/50">Valor Unit.</label>
        <input
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <button
        type="button"
        disabled={addMutation.isPending || !description || !unitPrice}
        onClick={() => addMutation.mutate()}
        className="rounded bg-warning-600 px-3 py-1.5 text-xs font-semibold text-surface-900 disabled:opacity-50"
      >
        {addMutation.isPending ? "..." : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/60"
      >
        Cancelar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/ComplementTab.tsx
git commit -m "feat(web): add ComplementTab — editable particular complement with billing"
```

---

## Task 13: Frontend — FinancialSummaryCard

**Files:**
- Create: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/FinancialSummaryCard.tsx`

- [ ] **Step 1: Criar componente**

Usar `useQuery` para buscar `/api/proxy/service-orders/{id}/financial-summary/`. Mostrar o breakdown: seguradora (peças + MO - franquia), complemento (subtotal, faturado, pendente), totais (cliente deve, seguradora deve, total geral). Seguir o mockup da seção 4 do complemento-particular.html.

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { FinancialSummary } from "@paddock/types"

interface Props {
  orderId: string
  customerType: string
}

export function FinancialSummaryCard({ orderId, customerType }: Props) {
  const { data: summary } = useQuery({
    queryKey: ["financial-summary", orderId],
    queryFn: () => apiFetch<FinancialSummary>(
      `/api/proxy/service-orders/${orderId}/financial-summary/`,
    ),
    enabled: customerType === "insurer",
  })

  if (!summary || customerType !== "insurer") return null

  const fmt = (v: string) =>
    parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="space-y-3">
      {/* Seguradora */}
      <div className="rounded-lg border border-info-500/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-info-500">Seguradora</span>
          {summary.active_version && (
            <span className="rounded-full bg-info-500/15 px-2 py-0.5 text-[11px] text-info-500">
              v{summary.active_version.version_number}
            </span>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-white/50">Peças</span><span className="text-white">{fmt(summary.insurer_parts)}</span></div>
          <div className="flex justify-between"><span className="text-white/50">Mão de obra</span><span className="text-white">{fmt(summary.insurer_labor)}</span></div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
            <span className="font-semibold text-white">Subtotal</span>
            <span className="font-bold text-info-500">{fmt(summary.insurer_subtotal)}</span>
          </div>
          <div className="flex justify-between"><span className="text-warning-500">Franquia</span><span className="text-warning-500">- {fmt(summary.deductible)}</span></div>
        </div>
      </div>

      {/* Complemento */}
      {parseFloat(summary.complement_subtotal) > 0 && (
        <div className="rounded-lg border border-warning-500/20 p-4">
          <div className="mb-3 text-sm font-semibold text-warning-500">Complemento Particular</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-white/50">Serviços</span><span className="text-white">{fmt(summary.complement_labor)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Peças</span><span className="text-white">{fmt(summary.complement_parts)}</span></div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
              <span className="font-semibold text-white">Subtotal</span>
              <span className="font-bold text-warning-500">{fmt(summary.complement_subtotal)}</span>
            </div>
            <div className="flex justify-between"><span className="text-success-500">Já faturado</span><span className="text-success-500">{fmt(summary.complement_billed)}</span></div>
          </div>
        </div>
      )}

      {/* Totais */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs">
        <div className="flex justify-between"><span className="text-white/50">Cliente deve</span><span className="font-bold text-error-500">{fmt(summary.customer_owes)}</span></div>
        <div className="flex justify-between"><span className="text-white/50">Seguradora deve</span><span className="font-bold text-info-500">{fmt(summary.insurer_owes)}</span></div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
          <span className="font-bold text-white">Total geral</span>
          <span className="text-base font-bold text-white">{fmt(summary.grand_total)}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/FinancialSummaryCard.tsx
git commit -m "feat(web): add FinancialSummaryCard component"
```

---

## Task 14: Frontend — Integrar Novas Abas e Botão no ServiceOrderForm

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx`

- [ ] **Step 1: Adicionar imports**

No topo do arquivo, adicionar:
```typescript
import { InsurerBudgetTab } from "./tabs/InsurerBudgetTab"
import { ComplementTab } from "./tabs/ComplementTab"
import { ImportBudgetModal } from "./ImportBudgetModal"
import { FinancialSummaryCard } from "./FinancialSummaryCard"
```

- [ ] **Step 2: Adicionar abas condicionais ao array TABS**

Substituir o array `TABS` (linha 63-73) por abas dinâmicas dentro do componente. Mover a definição para dentro de `ServiceOrderForm` e tornar condicional com base no `customer_type`:

```typescript
const isInsurer = order.customer_type === "insurer"

const TABS = [
  { id: "opening" as const, label: "Abertura" },
  { id: "parts" as const, label: "Peças" },
  { id: "services" as const, label: "Serviços" },
  ...(isInsurer ? [{ id: "insurer_budget" as const, label: "Orçamento Seguradora" }] : []),
  ...(isInsurer ? [{ id: "complement" as const, label: "Complemento Particular" }] : []),
  { id: "notes" as const, label: "Observações" },
  { id: "reminders" as const, label: "Lembretes" },
  { id: "history" as const, label: "Histórico" },
  { id: "closing" as const, label: "Fechamento" },
  { id: "estoque" as const, label: "Estoque" },
  { id: "files" as const, label: "Arquivos" },
]

type TabId = (typeof TABS)[number]["id"]
```

- [ ] **Step 3: Adicionar estado do modal de importação**

Após `const [activeTab, setActiveTab]`, adicionar:
```typescript
const [importModalOpen, setImportModalOpen] = useState(false)
```

- [ ] **Step 4: Adicionar botão "Importar Orçamento" no header**

No header da OS, antes do botão "Voltar", adicionar condicionalmente:
```tsx
{isInsurer && (
  <button
    type="button"
    onClick={() => setImportModalOpen(true)}
    className="inline-flex items-center gap-1.5 rounded-md bg-info-600 px-4 py-2 text-sm font-medium text-white hover:bg-info-700"
  >
    ⬇ Importar Orçamento
  </button>
)}
```

- [ ] **Step 5: Adicionar renderização das novas abas**

No bloco de conteúdo das abas (após linha 305), adicionar:
```tsx
{activeTab === "insurer_budget" && (
  <InsurerBudgetTab order={order} onOpenImport={() => setImportModalOpen(true)} />
)}
{activeTab === "complement" && <ComplementTab orderId={order.id} />}
```

- [ ] **Step 6: Adicionar modal e FinancialSummaryCard**

No final do componente (antes do `</>`), adicionar:
```tsx
{isInsurer && (
  <ImportBudgetModal
    order={order}
    open={importModalOpen}
    onClose={() => setImportModalOpen(false)}
  />
)}
```

- [ ] **Step 7: Estilizar aba "Complemento Particular" com cor âmbar**

No loop de renderização das tabs (linha 274-288), adicionar estilo condicional:
```tsx
className={cn(
  "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
  activeTab === tab.id
    ? tab.id === "complement"
      ? "border-warning-500 text-warning-500"
      : "border-primary-600 text-primary-600"
    : "border-transparent text-white/60 hover:border-white/15 hover:text-white/90"
)}
```

- [ ] **Step 8: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/ServiceOrderForm.tsx
git commit -m "feat(web): integrate InsurerBudgetTab, ComplementTab, ImportBudgetModal into OS form"
```

---

## Task 15: Frontend — Filtros por Origem nas Abas Peças e Serviços

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx`
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx`

- [ ] **Step 1: Adicionar filtros e coluna "Pagador" ao PartsTab**

Adicionar estado de filtro por `source_type` e chips de filtro no topo. Adicionar coluna "Pagador" à tabela com badge de cor (azul = seguradora, âmbar = particular, cinza = manual). Filtrar itens com base no chip selecionado.

- [ ] **Step 2: Adicionar filtros e coluna "Pagador" ao ServicesTab**

Mesma alteração para a aba de serviços.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/PartsTab.tsx
git add apps/dscar-web/src/app/\(app\)/service-orders/\[id\]/_components/tabs/ServicesTab.tsx
git commit -m "feat(web): add payer filter chips and Pagador column to Parts and Services tabs"
```

---

## Task 16: Verificação Final e Integração

**Files:** Todos os anteriores

- [ ] **Step 1: Rodar testes backend**

```bash
cd backend/core && python -m pytest apps/service_orders/tests/ -v --tb=short
```

- [ ] **Step 2: Rodar typecheck frontend**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 3: Testar fluxo manualmente**

1. Abrir uma OS de seguradora
2. Clicar "Importar Orçamento" → verificar modal com fonte pré-selecionada
3. Importar via Cilia → verificar aba "Orçamento Seguradora" populada
4. Adicionar itens no "Complemento Particular" → verificar faturamento independente
5. Verificar aba "Peças" consolidada com filtros
6. Verificar resumo financeiro

- [ ] **Step 4: Commit final se houver ajustes**

```bash
git add -A && git commit -m "fix: integration adjustments for import and complement flow"
```
