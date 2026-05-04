# PartsTab Inteligente + Módulo de Compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec:** `docs/superpowers/specs/2026-05-04-partstab-inteligente-compras-design.md`
>
> **Regras obrigatórias:**
> - Ler a spec ANTES de iniciar qualquer task
> - Cada checkbox DEVE ser marcada pelo agente ao concluir
> - Commits em Conventional Commits (pt-BR para scope)
> - Design system fintech-red dark: NUNCA usar `neutral-*`, `bg-white` sólido, `emerald-*`, `indigo-*`
> - Forms: usar constantes de `@paddock/utils/form-styles.ts`
> - Tables: `label-mono text-white/40` headers, `bg-white/[0.03]` header row
> - Hooks de lista: SEMPRE usar `fetchList<T>` (extrai `.results` do envelope DRF paginado)
> - Backend: type hints obrigatórios, `select_related`/`prefetch_related` em queries com relações
> - Backend: `is_active=True` em toda query de APIView
> - Faturamento SEMPRE no preço do orçamento — NUNCA no custo real (PC-9)
> - Sem frete na OC — valor é só peça (PC-10)
> - Peças seguradora entram via importação — modal manual só para complementos (PC-11)

**Goal:** Redesign da aba Peças da OS com 3 origens (estoque/compra/seguradora), pedido de compra automático, ordem de compra com aprovação financeira, tipagem de peça (genuína/reposição/similar/usada), e análise de margem inline.

**Architecture:** Novo app `apps.purchasing` (TENANT_APP) com PedidoCompra + OrdemCompra + ItemOrdemCompra. ServiceOrderPart expandido com campos origem, tipo_qualidade, status_peca, unidade_fisica FK. PartsTab reescrita com 3 modais de origem. Painel /compras para setor de compras. OC uma por OS com itens agrupados por fornecedor.

**Tech Stack:** Django 5 + DRF, PostgreSQL 16, Next.js 15 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, TanStack Query v5, Zod.

---

## File Structure

### Backend — Novo app `apps.purchasing`

```
backend/core/apps/purchasing/
├── __init__.py
├── apps.py
├── models.py                       ← PedidoCompra, OrdemCompra, ItemOrdemCompra
├── serializers.py                  ← Serializers CRUD + input
├── views.py                        ← ViewSets + APIViews
├── services.py                     ← PedidoCompraService, OrdemCompraService
├── urls.py                         ← Router + paths
├── admin.py
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_services.py
│   └── test_views.py
└── migrations/
    └── 0001_initial.py
```

### Backend — Arquivos modificados

```
backend/core/apps/service_orders/
├── models.py                       ← ADD campos em ServiceOrderPart (origem, tipo_qualidade, status_peca, unidade_fisica, pedido_compra, custo_real)
├── serializers.py                  ← UPDATE ServiceOrderPartSerializer com novos campos
├── views.py                        ← ADD endpoints parts/estoque/, parts/compra/, parts/seguradora/

backend/core/apps/inventory/
├── views_movement.py               ← ADD endpoint buscar-pecas/

backend/core/config/
├── settings/base.py                ← ADD apps.purchasing em TENANT_APPS
├── urls.py                         ← ADD path purchasing
```

### Frontend — Novos arquivos

```
packages/types/src/
├── purchasing.types.ts             ← PedidoCompra, OrdemCompra, ItemOrdemCompra, tipos

apps/dscar-web/src/hooks/
├── usePurchasing.ts                ← Hooks TanStack Query

apps/dscar-web/src/app/(app)/
├── compras/
│   ├── page.tsx                    ← Painel do setor de compras
│   └── ordens/
│       └── [id]/page.tsx           ← Detalhe da OC

apps/dscar-web/src/components/purchasing/
├── EstoqueBuscaModal.tsx           ← Modal busca no estoque
├── CompraFormModal.tsx             ← Modal solicitar compra
├── SeguradoraFormModal.tsx         ← Modal peça seguradora (complemento)
├── TipoQualidadeBadge.tsx          ← Badge genuína/reposição/similar/usada
├── OrigemBadge.tsx                 ← Badge estoque/compra/seguradora
├── StatusPecaBadge.tsx             ← Dot + texto status
└── OrdemCompraDetail.tsx           ← OC com itens por fornecedor
```

### Frontend — Arquivos modificados

```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx  ← REESCRITA COMPLETA
apps/dscar-web/src/components/Sidebar.tsx                                        ← ADD seção COMPRAS
packages/types/src/service-order.types.ts                                        ← ADD campos em ServiceOrderPart
apps/dscar-web/src/hooks/useServiceOrders.ts                                     ← ADD hooks novos endpoints
```

---

## Sprint 1 — Backend: ServiceOrderPart expandido + app purchasing

### Task 1.1: Expandir ServiceOrderPart com novos campos

**Files:**
- Modify: `backend/core/apps/service_orders/models.py:601-654`

- [ ] **Step 1: Adicionar campos ao ServiceOrderPart**

Após os campos existentes (discount, linha 629), adicionar:

```python
    # --- Campos WMS / Compras ---
    class Origem(models.TextChoices):
        ESTOQUE = "estoque", "Estoque"
        COMPRA = "compra", "Compra"
        SEGURADORA = "seguradora", "Seguradora"
        MANUAL = "manual", "Manual"  # legado — peças adicionadas antes do WMS

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    class StatusPeca(models.TextChoices):
        BLOQUEADA = "bloqueada", "Bloqueada no estoque"
        AGUARDANDO_COTACAO = "aguardando_cotacao", "Aguardando Cotação"
        EM_COTACAO = "em_cotacao", "Em Cotação"
        AGUARDANDO_APROVACAO = "aguardando_aprovacao", "Aguardando Aprovação"
        COMPRADA = "comprada", "Comprada — Aguardando Entrega"
        RECEBIDA = "recebida", "Recebida e Bloqueada"
        AGUARDANDO_SEGURADORA = "aguardando_seguradora", "Aguardando Seguradora"
        MANUAL = "manual", "Adicionada manualmente"  # legado

    origem = models.CharField(
        max_length=15,
        choices=Origem.choices,
        default=Origem.MANUAL,
        help_text="Origem da peça: estoque, compra, seguradora ou manual (legado).",
    )
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
        blank=True,
        default="",
        help_text="Genuína, reposição, similar ou usada.",
    )
    status_peca = models.CharField(
        max_length=25,
        choices=StatusPeca.choices,
        default=StatusPeca.MANUAL,
        help_text="Status no fluxo estoque/compra.",
    )
    unidade_fisica = models.ForeignKey(
        "inventory.UnidadeFisica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="os_parts",
        help_text="Peça física vinculada quando origem=estoque ou recebida.",
    )
    pedido_compra = models.ForeignKey(
        "purchasing.PedidoCompra",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="os_parts",
        help_text="Pedido de compra quando origem=compra.",
    )
    custo_real = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Custo real (valor_nf). Preenchido quando peça chega. PC-6.",
    )
```

- [ ] **Step 2: Gerar e aplicar migration**

Run: `docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py makemigrations service_orders --name parts_wms_fields`
Run: `docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py migrate_schemas`

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/service_orders/models.py \
        backend/core/apps/service_orders/migrations/
git commit -m "feat(service_orders): campos WMS em ServiceOrderPart — origem, tipo_qualidade, status_peca, custo_real"
```

---

### Task 1.2: Criar app `apps.purchasing` com models

**Files:**
- Create: `backend/core/apps/purchasing/` (todo o app)

- [ ] **Step 1: Criar estrutura do app**

```bash
mkdir -p backend/core/apps/purchasing/tests
touch backend/core/apps/purchasing/__init__.py
touch backend/core/apps/purchasing/admin.py
touch backend/core/apps/purchasing/tests/__init__.py
```

- [ ] **Step 2: Criar apps.py**

```python
# backend/core/apps/purchasing/apps.py
from django.apps import AppConfig

class PurchasingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.purchasing"
    verbose_name = "Compras"
```

- [ ] **Step 3: Criar models.py com PedidoCompra, OrdemCompra, ItemOrdemCompra**

```python
"""
Paddock Solutions — Purchasing — Módulo de Compras
PedidoCompra: solicitação individual (1 peça, 1 OS)
OrdemCompra: documento agrupador por OS (múltiplos fornecedores) — PC-4: uma OC por OS
ItemOrdemCompra: item na OC (peça + fornecedor + valor)
"""
import logging

from django.db import models
from django.db.models import Sum

from apps.authentication.models import PaddockBaseModel

logger = logging.getLogger(__name__)


class PedidoCompra(PaddockBaseModel):
    """Solicitação individual de compra — gerada automaticamente pelo consultor."""

    class Status(models.TextChoices):
        SOLICITADO = "solicitado", "Solicitado"
        EM_COTACAO = "em_cotacao", "Em Cotação"
        OC_PENDENTE = "oc_pendente", "OC Pendente"
        APROVADO = "aprovado", "Aprovado"
        COMPRADO = "comprado", "Comprado"
        RECEBIDO = "recebido", "Recebido"
        CANCELADO = "cancelado", "Cancelado"

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="pedidos_compra",
    )
    service_order_part = models.ForeignKey(
        "service_orders.ServiceOrderPart",
        on_delete=models.CASCADE,
        related_name="pedidos_compra",
    )
    descricao = models.CharField(max_length=300)
    codigo_referencia = models.CharField(max_length=100, blank=True, default="")
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    valor_cobrado_cliente = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Valor que será cobrado na OS (preço do orçamento — PC-9).",
    )
    observacoes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.SOLICITADO,
    )
    solicitado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="pedidos_compra_solicitados",
    )

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_pedido_compra"
        verbose_name = "Pedido de Compra"
        verbose_name_plural = "Pedidos de Compra"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PC-{self.pk} — {self.descricao[:50]} ({self.status})"


class OrdemCompra(PaddockBaseModel):
    """
    Documento agrupador para aprovação financeira.
    PC-4: Uma OC por OS (múltiplos fornecedores dentro).
    PC-5: Aprovação é tudo ou nada.
    PC-10: Sem frete — valor é só peça.
    """

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PENDENTE_APROVACAO = "pendente_aprovacao", "Pendente de Aprovação"
        APROVADA = "aprovada", "Aprovada"
        REJEITADA = "rejeitada", "Rejeitada"
        PARCIAL_RECEBIDA = "parcial_recebida", "Parcialmente Recebida"
        CONCLUIDA = "concluida", "Concluída"

    numero = models.CharField(
        max_length=20,
        unique=True,
        help_text="Auto-gerado: OC-{year}-{seq:04d}",
    )
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="ordens_compra",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RASCUNHO,
    )
    valor_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text="Soma dos itens — recomputado no save().",
    )
    observacoes = models.TextField(blank=True, default="")
    criado_por = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="ordens_compra_criadas",
    )
    aprovado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ordens_compra_aprovadas",
    )
    aprovado_em = models.DateTimeField(null=True, blank=True)
    rejeitado_por = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ordens_compra_rejeitadas",
    )
    motivo_rejeicao = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_ordem_compra"
        verbose_name = "Ordem de Compra"
        verbose_name_plural = "Ordens de Compra"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order"]),
            models.Index(fields=["status"]),
            models.Index(fields=["numero"]),
        ]

    def recompute_total(self) -> None:
        """Recomputa valor_total a partir dos itens."""
        total = self.itens.filter(is_active=True).aggregate(
            total=Sum("valor_total"),
        )["total"] or 0
        OrdemCompra.objects.filter(pk=self.pk).update(valor_total=total)

    def __str__(self) -> str:
        return f"{self.numero} — {self.status} (R$ {self.valor_total})"


class ItemOrdemCompra(PaddockBaseModel):
    """
    Item na OC — vincula peça + fornecedor.
    PC-7: fornecedor pode ser ad-hoc (campos desnormalizados) ou cadastrado (FK).
    PC-10: sem frete — valor é só peça.
    """

    class TipoQualidade(models.TextChoices):
        GENUINA = "genuina", "Genuína"
        REPOSICAO = "reposicao", "Reposição Original"
        SIMILAR = "similar", "Similar/Paralela"
        USADA = "usada", "Usada/Recondicionada"

    ordem_compra = models.ForeignKey(
        OrdemCompra,
        on_delete=models.CASCADE,
        related_name="itens",
    )
    pedido_compra = models.ForeignKey(
        PedidoCompra,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_oc",
    )
    # Fornecedor — PC-7: FK ou ad-hoc
    fornecedor = models.ForeignKey(
        "pricing_catalog.Fornecedor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="itens_oc",
    )
    fornecedor_nome = models.CharField(max_length=150)
    fornecedor_cnpj = models.CharField(max_length=20, blank=True, default="")
    fornecedor_contato = models.CharField(max_length=100, blank=True, default="")
    # Peça
    descricao = models.CharField(max_length=300)
    codigo_referencia = models.CharField(max_length=100, blank=True, default="")
    tipo_qualidade = models.CharField(
        max_length=15,
        choices=TipoQualidade.choices,
    )
    quantidade = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    valor_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="qty × unit — computed no save().",
    )
    prazo_entrega = models.CharField(max_length=100, blank=True, default="")
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "purchasing_item_ordem_compra"
        verbose_name = "Item de Ordem de Compra"
        verbose_name_plural = "Itens de Ordem de Compra"
        indexes = [
            models.Index(fields=["ordem_compra"]),
            models.Index(fields=["fornecedor"]),
        ]

    def save(self, *args: object, **kwargs: object) -> None:
        self.valor_total = self.quantidade * self.valor_unitario
        super().save(*args, **kwargs)
        self.ordem_compra.recompute_total()

    def __str__(self) -> str:
        return f"{self.descricao[:50]} — {self.fornecedor_nome} (R$ {self.valor_total})"
```

- [ ] **Step 4: Registrar app em TENANT_APPS**

Em `backend/core/config/settings/base.py`, adicionar `"apps.purchasing"` na lista TENANT_APPS.

- [ ] **Step 5: Registrar URL em config/urls.py**

Adicionar: `path("api/v1/purchasing/", include("apps.purchasing.urls")),`

- [ ] **Step 6: Criar urls.py vazio**

```python
# backend/core/apps/purchasing/urls.py
from django.urls import include, path
from rest_framework.routers import SimpleRouter

router = SimpleRouter()

urlpatterns = [
    path("", include(router.urls)),
]
```

- [ ] **Step 7: Gerar e aplicar migration**

Run: `docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py makemigrations purchasing --name initial`
Run: `docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py migrate_schemas`

- [ ] **Step 8: python manage.py check — 0 issues**

- [ ] **Step 9: Commit**

```bash
git add backend/core/apps/purchasing/ \
        backend/core/config/settings/base.py \
        backend/core/config/urls.py \
        backend/core/apps/service_orders/
git commit -m "feat(purchasing): app de compras — PedidoCompra, OrdemCompra, ItemOrdemCompra"
```

---

### Task 1.3: Services — PedidoCompraService + OrdemCompraService

**Files:**
- Create: `backend/core/apps/purchasing/services.py`

- [ ] **Step 1: Implementar PedidoCompraService**

```python
"""
Paddock Solutions — Purchasing — Services
PedidoCompraService: solicitar, iniciar cotação, cancelar
OrdemCompraService: criar OC, adicionar item, enviar, aprovar, rejeitar, receber
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.purchasing.models import ItemOrdemCompra, OrdemCompra, PedidoCompra

logger = logging.getLogger(__name__)


class PedidoCompraService:
    """Operações sobre pedidos de compra."""

    @staticmethod
    @transaction.atomic
    def solicitar(
        *,
        service_order_part_id: UUID,
        descricao: str,
        codigo_referencia: str = "",
        tipo_qualidade: str,
        quantidade: Decimal,
        valor_cobrado_cliente: Decimal,
        observacoes: str = "",
        user_id: UUID,
    ) -> PedidoCompra:
        """Cria pedido de compra + atualiza status da peça na OS."""
        from apps.service_orders.models import ServiceOrderPart

        part = ServiceOrderPart.objects.select_for_update().get(
            pk=service_order_part_id, is_active=True,
        )
        pedido = PedidoCompra.objects.create(
            service_order=part.service_order,
            service_order_part=part,
            descricao=descricao,
            codigo_referencia=codigo_referencia,
            tipo_qualidade=tipo_qualidade,
            quantidade=quantidade,
            valor_cobrado_cliente=valor_cobrado_cliente,
            observacoes=observacoes,
            solicitado_por_id=user_id,
        )
        # Atualizar part
        ServiceOrderPart.objects.filter(pk=part.pk).update(
            pedido_compra=pedido,
            status_peca="aguardando_cotacao",
        )
        logger.info("Pedido de compra %s criado para OS part %s", pedido.pk, part.pk)
        return pedido

    @staticmethod
    def iniciar_cotacao(pedido_id: UUID, user_id: UUID) -> PedidoCompra:
        pedido = PedidoCompra.objects.get(pk=pedido_id, is_active=True)
        PedidoCompra.objects.filter(pk=pedido.pk).update(status="em_cotacao")
        # Atualizar peça na OS
        from apps.service_orders.models import ServiceOrderPart
        ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
            status_peca="em_cotacao",
        )
        pedido.refresh_from_db()
        return pedido

    @staticmethod
    @transaction.atomic
    def cancelar(pedido_id: UUID, user_id: UUID, motivo: str = "") -> None:
        pedido = PedidoCompra.objects.select_for_update().get(pk=pedido_id, is_active=True)
        PedidoCompra.objects.filter(pk=pedido.pk).update(status="cancelado")
        # Reverter peça na OS
        from apps.service_orders.models import ServiceOrderPart
        ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
            status_peca="manual",
            pedido_compra=None,
        )
        logger.info("Pedido %s cancelado por user %s: %s", pedido.pk, user_id, motivo)


class OrdemCompraService:
    """Operações sobre ordens de compra."""

    @staticmethod
    def _gerar_numero() -> str:
        """Gera número sequencial OC-{year}-{seq:04d}."""
        year = timezone.now().year
        prefix = f"OC-{year}-"
        last = (
            OrdemCompra.objects.filter(numero__startswith=prefix)
            .order_by("-numero")
            .values_list("numero", flat=True)
            .first()
        )
        if last:
            seq = int(last.split("-")[-1]) + 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    @staticmethod
    @transaction.atomic
    def criar_oc(service_order_id: UUID, user_id: UUID) -> OrdemCompra:
        """PC-4: uma OC por OS. Se já existe rascunho, retorna ela."""
        # PC-4: uma OC por OS — verifica QUALQUER status ativo
        existing = OrdemCompra.objects.filter(
            service_order_id=service_order_id,
            is_active=True,
        ).exclude(status__in=["rejeitada"]).first()
        if existing:
            if existing.status in ["rascunho", "pendente_aprovacao"]:
                return existing  # Retorna a existente para edição
            raise ValueError(
                f"OS já possui OC {existing.numero} ({existing.status}). "
                "Não é possível criar outra."
            )

        oc = OrdemCompra.objects.create(
            numero=OrdemCompraService._gerar_numero(),
            service_order_id=service_order_id,
            criado_por_id=user_id,
        )
        logger.info("OC %s criada para OS %s", oc.numero, service_order_id)
        return oc

    @staticmethod
    @transaction.atomic
    def adicionar_item(
        *,
        oc_id: UUID,
        pedido_compra_id: UUID | None = None,
        fornecedor_id: UUID | None = None,
        fornecedor_nome: str,
        fornecedor_cnpj: str = "",
        fornecedor_contato: str = "",
        descricao: str,
        codigo_referencia: str = "",
        tipo_qualidade: str,
        quantidade: Decimal,
        valor_unitario: Decimal,
        prazo_entrega: str = "",
        observacoes: str = "",
    ) -> ItemOrdemCompra:
        """Adiciona item à OC e atualiza pedido."""
        item = ItemOrdemCompra.objects.create(
            ordem_compra_id=oc_id,
            pedido_compra_id=pedido_compra_id,
            fornecedor_id=fornecedor_id,
            fornecedor_nome=fornecedor_nome,
            fornecedor_cnpj=fornecedor_cnpj,
            fornecedor_contato=fornecedor_contato,
            descricao=descricao,
            codigo_referencia=codigo_referencia,
            tipo_qualidade=tipo_qualidade,
            quantidade=quantidade,
            valor_unitario=valor_unitario,
            valor_total=quantidade * valor_unitario,
            prazo_entrega=prazo_entrega,
            observacoes=observacoes,
        )
        if pedido_compra_id:
            PedidoCompra.objects.filter(pk=pedido_compra_id).update(status="oc_pendente")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="aguardando_aprovacao",
            )
        return item

    @staticmethod
    def enviar_para_aprovacao(oc_id: UUID, user_id: UUID) -> OrdemCompra:
        oc = OrdemCompra.objects.get(pk=oc_id, is_active=True)
        if oc.itens.filter(is_active=True).count() == 0:
            raise ValueError("OC sem itens não pode ser enviada para aprovação.")
        OrdemCompra.objects.filter(pk=oc.pk).update(status="pendente_aprovacao")
        oc.refresh_from_db()
        return oc

    @staticmethod
    @transaction.atomic
    def aprovar(oc_id: UUID, user_id: UUID) -> OrdemCompra:
        """PC-5: aprovação atômica — tudo ou nada."""
        oc = OrdemCompra.objects.select_for_update().get(pk=oc_id, is_active=True)
        if oc.status != "pendente_aprovacao":
            raise ValueError(f"OC {oc.numero} não está pendente de aprovação.")

        OrdemCompra.objects.filter(pk=oc.pk).update(
            status="aprovada",
            aprovado_por_id=user_id,
            aprovado_em=timezone.now(),
        )
        # Atualizar pedidos e peças
        for item in oc.itens.filter(is_active=True, pedido_compra__isnull=False):
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="aprovado")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=item.pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="comprada",
                # PC-6: custo_real NÃO preenchido aqui — só quando peça chega fisicamente
            )

        oc.refresh_from_db()
        logger.info("OC %s aprovada por user %s", oc.numero, user_id)
        return oc

    @staticmethod
    @transaction.atomic
    def rejeitar(oc_id: UUID, user_id: UUID, motivo: str) -> OrdemCompra:
        oc = OrdemCompra.objects.select_for_update().get(pk=oc_id, is_active=True)
        OrdemCompra.objects.filter(pk=oc.pk).update(
            status="rejeitada",
            rejeitado_por_id=user_id,
            motivo_rejeicao=motivo,
        )
        # Pedidos voltam a em_cotacao
        for item in oc.itens.filter(is_active=True, pedido_compra__isnull=False):
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="em_cotacao")
            from apps.service_orders.models import ServiceOrderPart
            pedido = PedidoCompra.objects.get(pk=item.pedido_compra_id)
            ServiceOrderPart.objects.filter(pk=pedido.service_order_part_id).update(
                status_peca="em_cotacao",
            )
        oc.refresh_from_db()
        logger.info("OC %s rejeitada por user %s: %s", oc.numero, user_id, motivo)
        return oc

    @staticmethod
    @transaction.atomic
    def registrar_recebimento_item(
        item_id: UUID,
        unidade_fisica_id: UUID,
        user_id: UUID,
    ) -> ItemOrdemCompra:
        """Quando peça chega: vincula UnidadeFisica à OS, bloqueia, atualiza custo real."""
        item = ItemOrdemCompra.objects.select_for_update().get(pk=item_id, is_active=True)
        from apps.inventory.models_physical import UnidadeFisica
        from apps.inventory.services.reserva import ReservaUnidadeService
        from apps.service_orders.models import ServiceOrderPart

        unidade = UnidadeFisica.objects.get(pk=unidade_fisica_id, is_active=True)

        # Bloquear no estoque para a OS
        oc = item.ordem_compra
        ReservaUnidadeService.reservar(
            peca_canonica_id=unidade.peca_canonica_id,
            quantidade=1,
            ordem_servico_id=str(oc.service_order_id),
            user_id=user_id,
        )

        # Atualizar peça na OS
        if item.pedido_compra:
            PedidoCompra.objects.filter(pk=item.pedido_compra_id).update(status="recebido")
            ServiceOrderPart.objects.filter(
                pk=item.pedido_compra.service_order_part_id,
            ).update(
                status_peca="recebida",
                unidade_fisica=unidade,
                custo_real=unidade.valor_nf,
            )

        # Verificar se OC está concluída (todos recebidos)
        total_itens = oc.itens.filter(is_active=True).count()
        total_recebidos = oc.itens.filter(
            is_active=True,
            pedido_compra__status="recebido",
        ).count()
        if total_recebidos >= total_itens:
            OrdemCompra.objects.filter(pk=oc.pk).update(status="concluida")
        elif total_recebidos > 0:
            OrdemCompra.objects.filter(pk=oc.pk).update(status="parcial_recebida")

        item.refresh_from_db()
        return item
```

- [ ] **Step 2: python manage.py check — 0 issues**

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/purchasing/services.py
git commit -m "feat(purchasing): PedidoCompraService + OrdemCompraService"
```

---

### Task 1.4: Serializers + Views + URLs de compras

**Files:**
- Create: `backend/core/apps/purchasing/serializers.py`
- Create: `backend/core/apps/purchasing/views.py`
- Modify: `backend/core/apps/purchasing/urls.py`

- [ ] **Step 1: Criar serializers**

Serializers para: PedidoCompra (list + detail), OrdemCompra (list + detail com itens), ItemOrdemCompra (create + list), inputs para solicitar/cotação/OC.

- [ ] **Step 2: Criar views**

- `PedidoCompraViewSet` (ReadOnly + actions iniciar_cotacao, cancelar) — STOREKEEPER+
- `OrdemCompraViewSet` (CRUD + actions enviar, aprovar, rejeitar) — STOREKEEPER+ read, MANAGER+ approve
- `ItemOrdemCompraCreateView` (POST) — STOREKEEPER+
- `DashboardComprasView` (GET) — CONSULTANT+: KPIs
- `RegistrarRecebimentoView` (POST) — STOREKEEPER+

- [ ] **Step 3: Registrar URLs**

```
GET    /api/v1/purchasing/pedidos/
PATCH  /api/v1/purchasing/pedidos/{id}/iniciar-cotacao/
PATCH  /api/v1/purchasing/pedidos/{id}/cancelar/
GET/POST /api/v1/purchasing/ordens-compra/
GET    /api/v1/purchasing/ordens-compra/{id}/
POST   /api/v1/purchasing/ordens-compra/{id}/itens/
DELETE /api/v1/purchasing/ordens-compra/{id}/itens/{item_id}/
POST   /api/v1/purchasing/ordens-compra/{id}/enviar/
POST   /api/v1/purchasing/ordens-compra/{id}/aprovar/
POST   /api/v1/purchasing/ordens-compra/{id}/rejeitar/
POST   /api/v1/purchasing/ordens-compra/{id}/itens/{item_id}/receber/
GET    /api/v1/purchasing/dashboard-stats/
```

- [ ] **Step 4: Verificar**

Run: `python manage.py check`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(purchasing): endpoints REST — pedidos, ordens de compra, dashboard"
```

---

### Task 1.5: Endpoints de adição de peças na OS (3 origens)

**Files:**
- Modify: `backend/core/apps/service_orders/views.py`
- Modify: `backend/core/apps/service_orders/serializers.py`

- [ ] **Step 1: Atualizar ServiceOrderPartSerializer com novos campos**

Adicionar aos fields: `origem`, `tipo_qualidade`, `status_peca`, `unidade_fisica`, `pedido_compra`, `custo_real`. Adicionar read_only: `status_peca`, `unidade_fisica`, `pedido_compra`, `custo_real`.

- [ ] **Step 2: Criar 3 novos endpoints na view do ServiceOrder**

```python
# Em ServiceOrderViewSet, adicionar 3 actions:

@action(detail=True, methods=["post"], url_path="parts/estoque")
def parts_estoque(self, request, pk=None):
    """Adicionar peça do estoque — bloqueia imediatamente (PC-2)."""
    # Input: unidade_fisica_id, tipo_qualidade, unit_price (valor cobrado — PC-9)
    # 1. ReservaUnidadeService.reservar()
    # 2. Criar ServiceOrderPart(origem=ESTOQUE, status_peca=bloqueada, custo_real=valor_nf)
    ...

@action(detail=True, methods=["post"], url_path="parts/compra")
def parts_compra(self, request, pk=None):
    """Solicitar compra — gera PedidoCompra automaticamente."""
    # Input: descricao, codigo_referencia, tipo_qualidade, unit_price, quantidade, observacoes
    # 1. Criar ServiceOrderPart(origem=COMPRA, status_peca=aguardando_cotacao)
    # 2. PedidoCompraService.solicitar()
    ...

@action(detail=True, methods=["post"], url_path="parts/seguradora")
def parts_seguradora(self, request, pk=None):
    """Registrar peça de seguradora (complemento manual — PC-11)."""
    # Input: descricao, tipo_qualidade, unit_price, quantidade
    # 1. Criar ServiceOrderPart(origem=SEGURADORA, status_peca=aguardando_seguradora)
    ...
```

- [ ] **Step 3: Endpoint buscar-pecas no inventory**

Adicionar em `backend/core/apps/inventory/views_movement.py`:

```python
class BuscarPecasView(APIView):
    """GET /api/v1/inventory/buscar-pecas/ — busca produtos com estoque."""
    # Params: ?busca=, ?tipo_peca=, ?categoria=
    # Retorna ProdutoComercialPeca + estoque_disponivel (count) + posicao
```

Registrar URL em `backend/core/apps/inventory/urls.py`.

- [ ] **Step 4: Adaptar DELETE de parts para liberar estoque (PC-3)**

No endpoint `part_detail` DELETE existente, adicionar lógica: se `part.unidade_fisica`, chamar `ReservaUnidadeService.liberar()`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(service_orders): endpoints 3 origens de peça + buscar-pecas + liberar estoque no delete"
```

---

### Task 1.6: Testes backend

**Files:**
- Create: `backend/core/apps/purchasing/tests/test_models.py`
- Create: `backend/core/apps/purchasing/tests/test_services.py`

- [ ] **Step 1: Testes de model (unitários sem DB)**

- `test_pedido_compra_str`, `test_ordem_compra_str`, `test_item_oc_str`

- [ ] **Step 2: Testes de service (TenantTestCase com DB)**

- `test_solicitar_cria_pedido_e_atualiza_status_part`
- `test_iniciar_cotacao_muda_status`
- `test_criar_oc_retorna_existente_se_rascunho`
- `test_adicionar_item_computa_valor_total`
- `test_aprovar_oc_atualiza_pedidos_e_parts`
- `test_rejeitar_oc_volta_pedidos_para_cotacao`
- `test_aprovar_oc_nao_pendente_levanta_erro`
- `test_bloqueio_estoque_imediato_pc2` — ao adicionar do estoque, UnidadeFisica.status vira reserved imediatamente
- `test_remover_part_libera_estoque_pc3` — ao deletar peça com unidade_fisica, estoque é liberado
- `test_custo_real_nao_preenchido_antes_recebimento_pc6` — aprovar OC NÃO preenche custo_real
- `test_origem_imutavel_pc1` — PATCH em ServiceOrderPart não pode alterar campo origem
- `test_criar_segunda_oc_mesma_os_levanta_erro_pc4` — não permite 2 OCs ativas para mesma OS
- `test_remover_item_oc` — remove item da OC e recomputa total

- [ ] **Step 3: Rodar testes**

Run: `docker compose -f infra/docker/docker-compose.dev.yml exec django python -m pytest apps/purchasing/tests/ -v`

- [ ] **Step 4: Commit**

```bash
git commit -m "test(purchasing): testes models + services"
```

---

## Sprint 2 — Frontend: Types + Hooks + Componentes

### Task 2.1: TypeScript types

**Files:**
- Create: `packages/types/src/purchasing.types.ts`
- Modify: `packages/types/src/service-order.types.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Criar purchasing.types.ts**

Interfaces: `PedidoCompra`, `OrdemCompra`, `OrdemCompraDetail`, `ItemOrdemCompra`, `DashboardComprasStats`, tipos para inputs, `TipoQualidade`, `OrigemPeca`, `StatusPeca`.

- [ ] **Step 2: Atualizar ServiceOrderPart em service-order.types.ts**

Adicionar: `origem`, `tipo_qualidade`, `status_peca`, `unidade_fisica`, `pedido_compra`, `custo_real`.

- [ ] **Step 3: Exportar em index.ts**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(types): tipos TypeScript para purchasing + ServiceOrderPart expandido"
```

---

### Task 2.2: Hooks TanStack Query

**Files:**
- Create: `apps/dscar-web/src/hooks/usePurchasing.ts`
- Modify: `apps/dscar-web/src/hooks/useServiceOrders.ts`

- [ ] **Step 1: Criar usePurchasing.ts**

Hooks: `usePedidosCompra`, `useIniciarCotacao`, `useCancelarPedido`, `useOrdensCompra`, `useOrdemCompra(id)`, `useCriarOC`, `useAdicionarItemOC`, `useRemoverItemOC`, `useEnviarOC`, `useAprovarOC`, `useRejeitarOC`, `useRegistrarRecebimento`, `useDashboardCompras`.

- [ ] **Step 2: Adicionar hooks de 3 origens em useServiceOrders.ts**

`useAddPartEstoque(osId)`, `useAddPartCompra(osId)`, `useAddPartSeguradora(osId)`, `useBuscarPecas(params)`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dscar-web): hooks TanStack Query para purchasing"
```

---

### Task 2.3: Componentes de badge e status

**Files:**
- Create: `apps/dscar-web/src/components/purchasing/TipoQualidadeBadge.tsx`
- Create: `apps/dscar-web/src/components/purchasing/OrigemBadge.tsx`
- Create: `apps/dscar-web/src/components/purchasing/StatusPecaBadge.tsx`

- [ ] **Step 1: TipoQualidadeBadge**

Genuína: `bg-info-500/10 text-info-400`. Reposição: `bg-success-500/10 text-success-400`. Similar: `bg-warning-500/10 text-warning-400`. Usada: `bg-white/5 text-white/40`.

- [ ] **Step 2: OrigemBadge**

Estoque: `bg-success-500/10 text-success-400`. Compra: `bg-info-500/10 text-info-400`. Seguradora: `bg-purple-500/10 text-purple-400`. Manual: `bg-white/5 text-white/40`.

- [ ] **Step 3: StatusPecaBadge**

Dot colorido + texto. Bloqueada/Recebida: success. Aguardando cotação: warning. Em cotação/Comprada: info. Aguardando aprovação/Seguradora: purple.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dscar-web): badges TipoQualidade, Origem, StatusPeca"
```

---

## Sprint 3 — Frontend: Modais + PartsTab Reescrita

### Task 3.1: Modais de origem

**Files:**
- Create: `apps/dscar-web/src/components/purchasing/EstoqueBuscaModal.tsx`
- Create: `apps/dscar-web/src/components/purchasing/CompraFormModal.tsx`
- Create: `apps/dscar-web/src/components/purchasing/SeguradoraFormModal.tsx`

- [ ] **Step 1: EstoqueBuscaModal**

Busca com filtros (nome/SKU, tipo_peca, categoria, "compatível com veículo"). Resultados com disponibilidade e posição. Seleção → input valor cobrado + tipo_qualidade → "Bloquear e Adicionar".

- [ ] **Step 2: CompraFormModal**

Formulário: descrição, código, tipo_qualidade, valor cobrado (PC-9), quantidade, observações. Botão "Solicitar Compra".

- [ ] **Step 3: SeguradoraFormModal**

Formulário mínimo (complemento — PC-11): descrição, tipo_qualidade, valor cobrado, quantidade. Botão "Registrar".

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dscar-web): modais EstoqueBusca, CompraForm, SeguradoraForm"
```

---

### Task 3.2: PartsTab reescrita completa

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx` — REESCRITA

- [ ] **Step 1: Reescrever PartsTab**

- 3 botões de origem (Do Estoque / Comprar / Seguradora Fornece)
- Tabela com colunas: Peça, Tipo (TipoQualidadeBadge), Origem (OrigemBadge), Status (StatusPecaBadge), Custo (MANAGER+), Cobrado, Margem (MargemBadge, MANAGER+)
- 4 cards resumo: Custo Total, Valor Cobrado, Margem, Pendentes
- Modais integrados (EstoqueBuscaModal, CompraFormModal, SeguradoraFormModal)
- Menu ⋮ por peça com ações (editar valor, remover — PC-3 libera estoque se bloqueada)
- `MargemBadge` já existe em `@/components/inventory/MargemBadge.tsx` (reutilizar — não criar novo)
- PC-1: campo `origem` não aparece como editável no form de edição
- PC-11: peças de seguradora que vêm da importação Cilia/XML entram automaticamente — modal SeguradoraFormModal é só para complementos manuais. A integração com Cilia já existente deve ser adaptada em sprint futura para popular os novos campos (origem, tipo_qualidade, status_peca).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): PartsTab reescrita com 3 origens, status, margem"
```

---

## Sprint 4 — Frontend: Painel de Compras + OC

### Task 4.1: Sidebar + Painel de Compras

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`
- Create: `apps/dscar-web/src/app/(app)/compras/page.tsx`

- [ ] **Step 1: Adicionar seção COMPRAS na sidebar**

2 itens: "Pedidos de Compra" (ShoppingCart), "Ordens de Compra" (FileCheck).

- [ ] **Step 2: Página /compras**

4 KPIs + tabela de pedidos pendentes com ações (Iniciar Cotação / Montar OC).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dscar-web): painel de compras — sidebar + KPIs + pedidos"
```

---

### Task 4.2: Detalhe da Ordem de Compra

**Files:**
- Create: `apps/dscar-web/src/app/(app)/compras/ordens/[id]/page.tsx`
- Create: `apps/dscar-web/src/components/purchasing/OrdemCompraDetail.tsx`

- [ ] **Step 1: OrdemCompraDetail component**

Header (número + OS + status), itens agrupados por fornecedor (nome, CNPJ, contato → tabela de peças), total da OC, botões Aprovar/Rejeitar (MANAGER+).

- [ ] **Step 2: Página /compras/ordens/[id]**

Usa OrdemCompraDetail + form para adicionar itens (quando rascunho).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dscar-web): detalhe da Ordem de Compra com aprovação"
```

---

### Task 4.3: Testes E2E

**Files:**
- Create: `apps/dscar-web/e2e/purchasing.spec.ts`

- [ ] **Step 1: Smoke tests**

- `/compras` carrega sem erros
- `/compras/ordens/{id}` carrega (mock ou real)
- PartsTab mostra 3 botões de origem

- [ ] **Step 2: Commit**

```bash
git commit -m "test(dscar-web): smoke tests E2E para purchasing"
```

---

## Resumo de Sprints

| Sprint | Foco | Tasks |
|--------|------|-------|
| **1** | Backend: ServiceOrderPart + app purchasing + services + endpoints | 1.1–1.6 |
| **2** | Frontend: Types + Hooks + Badges | 2.1–2.3 |
| **3** | Frontend: Modais + PartsTab reescrita | 3.1–3.2 |
| **4** | Frontend: Painel Compras + OC + E2E | 4.1–4.3 |

**Total:** 4 sprints · 15 tasks
