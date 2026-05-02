# WMS — Estoque Físico Completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec:** `docs/superpowers/specs/2026-05-02-wms-estoque-fisico-design.md`
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
> - Dev server roda na pasta principal — NÃO editar em worktrees para fixes quentes

**Goal:** Implementar WMS completo para DS Car — hierarquia de localização física (Armazém→Rua→Prateleira→Nível), cadastro comercial separado de peças e insumos, movimentação auditável, aprovações, contagem de inventário, e análise de margem na OS.

**Architecture:** App `apps.inventory` expandido com novos models de localização, produto comercial e movimentação. Services de domínio separados por responsabilidade. Frontend Next.js 15 com páginas sob `/estoque/`, hooks TanStack Query v5 e componentes reutilizáveis no design system fintech-red.

**Tech Stack:** Django 5 + DRF, PostgreSQL 16, Next.js 15 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, TanStack Query v5, Zod, React Hook Form.

---

## File Structure

### Backend — Novos arquivos

```
backend/core/apps/inventory/
├── models_location.py              ← Armazem, Rua, Prateleira, Nivel
├── models_product.py               ← TipoPeca, CategoriaProduto, CategoriaInsumo,
│                                      ProdutoComercialPeca, ProdutoComercialInsumo
├── models_movement.py              ← MovimentacaoEstoque
├── models_counting.py              ← ContagemInventario, ItemContagem
├── serializers_location.py         ← Serializers de localização
├── serializers_product.py          ← Serializers de produto comercial
├── serializers_movement.py         ← Serializers de movimentação
├── serializers_counting.py         ← Serializers de contagem
├── views_location.py               ← ViewSets de localização
├── views_product.py                ← ViewSets de produto comercial
├── views_movement.py               ← Views de movimentação + aprovação
├── views_counting.py               ← ViewSets de contagem
├── services/
│   ├── localizacao.py              ← LocalizacaoService
│   ├── entrada.py                  ← EntradaEstoqueService
│   ├── saida.py                    ← SaidaEstoqueService
│   ├── movimentacao.py             ← MovimentacaoService (consulta)
│   ├── aprovacao.py                ← AprovacaoEstoqueService
│   └── contagem.py                 ← ContagemService
├── tests/
│   ├── test_location_models.py
│   ├── test_product_models.py
│   ├── test_movement_models.py
│   ├── test_localizacao_service.py
│   ├── test_entrada_service.py
│   ├── test_saida_service.py
│   ├── test_contagem_service.py
│   ├── test_aprovacao_service.py
│   └── test_location_views.py
├── management/commands/
│   └── setup_estoque_base.py       ← Seeds: TipoPeca, categorias
└── migrations/
    └── 0003_wms_*.py               ← Auto-geradas
```

### Backend — Arquivos modificados

```
backend/core/apps/inventory/
├── models_physical.py              ← ADD nivel FK, produto_peca/produto_insumo FK
├── urls.py                         ← ADD novos routers
├── services/reserva.py             ← ADD MovimentacaoEstoque em reservar/baixar
backend/core/apps/authentication/
└── permissions.py                  ← ADD IsStorekeeperOrAbove
```

### Frontend — Novos arquivos

```
packages/types/src/
├── inventory-location.types.ts     ← Armazem, Rua, Prateleira, Nivel
├── inventory-product.types.ts      ← ProdutoComercialPeca, ProdutoComercialInsumo, TipoPeca, etc.
├── inventory-movement.types.ts     ← MovimentacaoEstoque, ContagemInventario, etc.

apps/dscar-web/src/hooks/
├── useInventoryLocation.ts         ← Hooks de localização
├── useInventoryProduct.ts          ← Hooks de produto comercial
├── useInventoryMovement.ts         ← Hooks de movimentação + aprovação
├── useInventoryCounting.ts         ← Hooks de contagem

apps/dscar-web/src/app/(app)/estoque/
├── page.tsx                        ← REESCRITA: dashboard com KPIs
├── armazens/
│   ├── page.tsx                    ← Lista de armazéns
│   └── [id]/page.tsx               ← Detalhe com árvore interativa
├── produtos/
│   ├── pecas/page.tsx              ← Lista ProdutoComercialPeca
│   └── insumos/page.tsx            ← Lista ProdutoComercialInsumo
├── unidades/page.tsx               ← REESCRITA: com ações
├── lotes/page.tsx                  ← REESCRITA: com ações
├── entrada/page.tsx                ← Entrada manual
├── movimentacoes/page.tsx          ← Log de movimentações
├── aprovacoes/page.tsx             ← Pendências MANAGER+
├── contagens/
│   ├── page.tsx                    ← Lista contagens
│   └── [id]/page.tsx               ← Detalhe contagem
└── categorias/page.tsx             ← CRUD categorias + TipoPeca

apps/dscar-web/src/components/inventory/
├── PosicaoSelector.tsx             ← 4 selects cascata
├── ArmazemTree.tsx                 ← Árvore colapsável
├── BarcodeScanInput.tsx            ← Input para leitor/digitação
├── MovimentacaoTimeline.tsx        ← Timeline vertical
├── MargemBadge.tsx                 ← Badge verde/vermelho margem
├── ProdutoPecaDialog.tsx           ← Sheet lateral peça
├── ProdutoInsumoDialog.tsx         ← Sheet lateral insumo
└── EvidenciaUpload.tsx             ← Upload foto com preview
```

### Frontend — Arquivos modificados

```
apps/dscar-web/src/components/Sidebar.tsx      ← Expandir seção ESTOQUE
packages/types/src/inventory.types.ts          ← ADD campos nivel, produto_peca/insumo
apps/dscar-web/src/hooks/useInventory.ts       ← ADD hooks KPI dashboard
```

---

## Sprint 1 — Backend: Localização + Permission

### Task 1.1: Criar `IsStorekeeperOrAbove` permission

**Files:**
- Modify: `backend/core/apps/authentication/permissions.py`
- Test: `backend/core/apps/inventory/tests/test_location_views.py`

- [ ] **Step 1: Adicionar classe de permissão**

```python
# Em backend/core/apps/authentication/permissions.py
# Após IsConsultantOrAbove (linha ~50), adicionar:

class IsStorekeeperOrAbove(BasePermission):
    """Permite acesso para STOREKEEPER, CONSULTANT, MANAGER, ADMIN, OWNER."""

    def has_permission(self, request: Request, view: object) -> bool:
        role = _get_role(request)
        return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY["STOREKEEPER"]
```

- [ ] **Step 2: Verificar que não quebrou nada existente**

Run: `cd backend/core && python manage.py check`
Expected: `System check identified no issues.`

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/authentication/permissions.py
git commit -m "feat(auth): adiciona IsStorekeeperOrAbove permission class"
```

---

### Task 1.2: Models de localização

**Files:**
- Create: `backend/core/apps/inventory/models_location.py`
- Modify: `backend/core/apps/inventory/models.py` (import/re-export)
- Test: `backend/core/apps/inventory/tests/test_location_models.py`

- [ ] **Step 1: Criar models_location.py com 4 models**

```python
"""
Paddock Solutions — Inventory — Hierarquia de Localização Física
WMS: Armazem → Rua → Prateleira → Nivel

Nivel é o ponto terminal onde UnidadeFisica e LoteInsumo apontam via FK.
endereco_completo é computed (WMS-4: nunca stored, evita desync).
"""
from django.db import models

from apps.authentication.models import PaddockBaseModel


class Armazem(PaddockBaseModel):
    """Galpão ou pátio — container de nível mais alto."""

    class Tipo(models.TextChoices):
        GALPAO = "galpao", "Galpão"
        PATIO = "patio", "Pátio"

    nome = models.CharField(max_length=80)
    codigo = models.CharField(
        max_length=10,
        help_text="Código curto: G1, G2, PT1.",
    )
    tipo = models.CharField(
        max_length=10,
        choices=Tipo.choices,
        default=Tipo.GALPAO,
    )
    endereco = models.CharField(max_length=200, blank=True, default="")
    responsavel = models.ForeignKey(
        "authentication.GlobalUser",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="armazens_responsavel",
    )
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_armazem"
        verbose_name = "Armazém"
        verbose_name_plural = "Armazéns"
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(is_active=True),
                name="unique_armazem_codigo_active",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome}"


class Rua(PaddockBaseModel):
    """Corredor dentro de um armazém."""

    armazem = models.ForeignKey(
        Armazem,
        on_delete=models.CASCADE,
        related_name="ruas",
    )
    codigo = models.CharField(max_length=10, help_text="R01, R02.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_rua"
        verbose_name = "Rua"
        verbose_name_plural = "Ruas"
        constraints = [
            models.UniqueConstraint(
                fields=["armazem", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_rua_armazem_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]

    def __str__(self) -> str:
        return f"{self.armazem.codigo}-{self.codigo}"


class Prateleira(PaddockBaseModel):
    """Estante dentro de uma rua."""

    rua = models.ForeignKey(
        Rua,
        on_delete=models.CASCADE,
        related_name="prateleiras",
    )
    codigo = models.CharField(max_length=10, help_text="P01, P02.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    capacidade_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Peso máximo suportado (kg).",
    )
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_prateleira"
        verbose_name = "Prateleira"
        verbose_name_plural = "Prateleiras"
        constraints = [
            models.UniqueConstraint(
                fields=["rua", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_prateleira_rua_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]

    def __str__(self) -> str:
        return f"{self.rua}-{self.codigo}"


class Nivel(PaddockBaseModel):
    """Posição individual dentro de uma prateleira. Ponto terminal do endereçamento."""

    prateleira = models.ForeignKey(
        Prateleira,
        on_delete=models.CASCADE,
        related_name="niveis",
    )
    codigo = models.CharField(max_length=10, help_text="N1, N2.")
    descricao = models.CharField(max_length=80, blank=True, default="")
    altura_cm = models.PositiveIntegerField(null=True, blank=True)
    largura_cm = models.PositiveIntegerField(null=True, blank=True)
    profundidade_cm = models.PositiveIntegerField(null=True, blank=True)
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_nivel"
        verbose_name = "Nível"
        verbose_name_plural = "Níveis"
        constraints = [
            models.UniqueConstraint(
                fields=["prateleira", "codigo"],
                condition=models.Q(is_active=True),
                name="unique_nivel_prateleira_codigo_active",
            ),
        ]
        ordering = ["ordem", "codigo"]
        indexes = [
            models.Index(fields=["prateleira", "ordem"]),
        ]

    @property
    def endereco_completo(self) -> str:
        """WMS-4: computed, nunca stored — evita desync."""
        rua = self.prateleira.rua
        armazem = rua.armazem
        return f"{armazem.codigo}-{rua.codigo}-{self.prateleira.codigo}-{self.codigo}"

    def __str__(self) -> str:
        return self.endereco_completo
```

- [ ] **Step 2: Escrever testes unitários para os models**

```python
# backend/core/apps/inventory/tests/test_location_models.py
"""Testes unitários para models de localização — sem banco."""
import uuid
from unittest.mock import MagicMock, PropertyMock

import pytest

from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua


class TestNivelEnderecoCompleto:
    """WMS-4: endereco_completo é computed, nunca stored."""

    def test_endereco_completo_format(self) -> None:
        armazem = MagicMock(spec=Armazem)
        armazem.codigo = "G1"

        rua = MagicMock(spec=Rua)
        rua.codigo = "R03"
        rua.armazem = armazem

        prateleira = MagicMock(spec=Prateleira)
        prateleira.codigo = "P02"
        prateleira.rua = rua

        nivel = Nivel(
            id=uuid.uuid4(),
            prateleira=prateleira,
            codigo="N4",
        )
        # Precisamos do mock no atributo direto
        nivel.prateleira = prateleira

        assert nivel.endereco_completo == "G1-R03-P02-N4"

    def test_endereco_completo_patio(self) -> None:
        armazem = MagicMock(spec=Armazem)
        armazem.codigo = "PT1"

        rua = MagicMock(spec=Rua)
        rua.codigo = "A01"
        rua.armazem = armazem

        prateleira = MagicMock(spec=Prateleira)
        prateleira.codigo = "Z01"
        prateleira.rua = rua

        nivel = Nivel(id=uuid.uuid4(), prateleira=prateleira, codigo="N1")
        nivel.prateleira = prateleira

        assert nivel.endereco_completo == "PT1-A01-Z01-N1"

    def test_str_uses_endereco_completo(self) -> None:
        armazem = MagicMock(spec=Armazem)
        armazem.codigo = "G2"

        rua = MagicMock(spec=Rua)
        rua.codigo = "R01"
        rua.armazem = armazem

        prateleira = MagicMock(spec=Prateleira)
        prateleira.codigo = "P01"
        prateleira.rua = rua

        nivel = Nivel(id=uuid.uuid4(), prateleira=prateleira, codigo="N1")
        nivel.prateleira = prateleira

        assert str(nivel) == "G2-R01-P01-N1"


class TestArmazemStr:
    def test_str_format(self) -> None:
        armazem = Armazem(id=uuid.uuid4(), codigo="G1", nome="Galpão Principal")
        assert str(armazem) == "G1 — Galpão Principal"


class TestRuaStr:
    def test_str_format(self) -> None:
        armazem = MagicMock(spec=Armazem)
        armazem.codigo = "G1"
        rua = Rua(id=uuid.uuid4(), armazem=armazem, codigo="R01")
        rua.armazem = armazem
        assert str(rua) == "G1-R01"
```

- [ ] **Step 3: Rodar testes**

Run: `cd backend/core && python -m pytest apps/inventory/tests/test_location_models.py -v`
Expected: 5 testes passando

- [ ] **Step 4: Gerar e aplicar migration**

Run: `cd backend/core && python manage.py makemigrations inventory --name wms_location_models`
Run: `cd backend/core && python manage.py migrate_schemas`
Expected: Migration criada e aplicada sem erros

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/inventory/models_location.py \
        backend/core/apps/inventory/tests/test_location_models.py \
        backend/core/apps/inventory/migrations/0003_*.py
git commit -m "feat(inventory): models de localização — Armazem, Rua, Prateleira, Nivel"
```

---

### Task 1.3: Serializers + ViewSets + URLs de localização

**Files:**
- Create: `backend/core/apps/inventory/serializers_location.py`
- Create: `backend/core/apps/inventory/views_location.py`
- Modify: `backend/core/apps/inventory/urls.py`
- Test: `backend/core/apps/inventory/tests/test_location_views.py`

- [ ] **Step 1: Criar serializers_location.py**

```python
"""Serializers para hierarquia de localização."""
from rest_framework import serializers

from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua


class ArmazemSerializer(serializers.ModelSerializer):
    total_ruas = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Armazem
        fields = [
            "id", "nome", "codigo", "tipo", "endereco",
            "responsavel", "observacoes", "total_ruas", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RuaSerializer(serializers.ModelSerializer):
    armazem_codigo = serializers.CharField(source="armazem.codigo", read_only=True)
    total_prateleiras = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Rua
        fields = [
            "id", "armazem", "armazem_codigo", "codigo", "descricao",
            "ordem", "total_prateleiras", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PrateleiraSerializer(serializers.ModelSerializer):
    rua_codigo = serializers.CharField(source="rua.codigo", read_only=True)
    total_niveis = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Prateleira
        fields = [
            "id", "rua", "rua_codigo", "codigo", "descricao",
            "capacidade_kg", "ordem", "total_niveis", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class NivelSerializer(serializers.ModelSerializer):
    prateleira_codigo = serializers.CharField(
        source="prateleira.codigo", read_only=True,
    )
    endereco_completo = serializers.CharField(read_only=True)
    total_unidades = serializers.IntegerField(read_only=True, default=0)
    total_lotes = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Nivel
        fields = [
            "id", "prateleira", "prateleira_codigo", "codigo", "descricao",
            "altura_cm", "largura_cm", "profundidade_cm", "ordem",
            "endereco_completo", "total_unidades", "total_lotes",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "endereco_completo", "created_at"]


class NivelConteudoSerializer(serializers.Serializer):
    """Retorna o conteúdo de um nível (unidades + lotes)."""
    unidades = serializers.ListField(read_only=True)
    lotes = serializers.ListField(read_only=True)
```

- [ ] **Step 2: Criar views_location.py**

```python
"""ViewSets de localização — CRUD hierárquico."""
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.authentication.permissions import IsConsultantOrAbove, IsManagerOrAbove
from apps.inventory.models_location import Armazem, Nivel, Prateleira, Rua
from apps.inventory.serializers_location import (
    ArmazemSerializer,
    NivelSerializer,
    PrateleiraSerializer,
    RuaSerializer,
)


class ArmazemViewSet(viewsets.ModelViewSet):
    serializer_class = ArmazemSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        return (
            Armazem.objects.filter(is_active=True)
            .annotate(total_ruas=Count("ruas", filter=Q(ruas__is_active=True)))
            .order_by("codigo")
        )

    def perform_destroy(self, instance: Armazem) -> None:
        instance.soft_delete()

    @action(detail=True, methods=["get"])
    def ocupacao(self, request: Request, pk: str = None) -> Response:
        armazem = self.get_object()
        ruas = Rua.objects.filter(armazem=armazem, is_active=True).annotate(
            total_prateleiras=Count("prateleiras", filter=Q(prateleiras__is_active=True)),
        )
        # Contar unidades e lotes por rua
        data = []
        for rua in ruas:
            niveis = Nivel.objects.filter(
                prateleira__rua=rua,
                prateleira__is_active=True,
                is_active=True,
            )
            nivel_ids = niveis.values_list("id", flat=True)
            from apps.inventory.models_physical import LoteInsumo, UnidadeFisica

            unidades = UnidadeFisica.objects.filter(
                nivel__in=nivel_ids, is_active=True, status="available",
            ).count()
            lotes = LoteInsumo.objects.filter(
                nivel__in=nivel_ids, is_active=True, saldo__gt=0,
            ).count()
            data.append({
                "rua_id": str(rua.id),
                "rua_codigo": rua.codigo,
                "descricao": rua.descricao,
                "total_prateleiras": rua.total_prateleiras,
                "total_unidades": unidades,
                "total_lotes": lotes,
            })
        return Response(data)


class RuaViewSet(viewsets.ModelViewSet):
    serializer_class = RuaSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = Rua.objects.filter(is_active=True).select_related("armazem").annotate(
            total_prateleiras=Count("prateleiras", filter=Q(prateleiras__is_active=True)),
        )
        armazem_id = self.request.query_params.get("armazem")
        if armazem_id:
            qs = qs.filter(armazem_id=armazem_id)
        return qs.order_by("armazem__codigo", "ordem", "codigo")

    def perform_destroy(self, instance: Rua) -> None:
        instance.soft_delete()


class PrateleiraViewSet(viewsets.ModelViewSet):
    serializer_class = PrateleiraSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = Prateleira.objects.filter(is_active=True).select_related("rua").annotate(
            total_niveis=Count("niveis", filter=Q(niveis__is_active=True)),
        )
        rua_id = self.request.query_params.get("rua")
        if rua_id:
            qs = qs.filter(rua_id=rua_id)
        return qs.order_by("rua__codigo", "ordem", "codigo")

    def perform_destroy(self, instance: Prateleira) -> None:
        instance.soft_delete()


class NivelViewSet(viewsets.ModelViewSet):
    serializer_class = NivelSerializer
    permission_classes = [IsAuthenticated, IsConsultantOrAbove]

    def get_permissions(self) -> list:
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        return [IsAuthenticated(), IsConsultantOrAbove()]

    def get_queryset(self):  # type: ignore[override]
        qs = (
            Nivel.objects.filter(is_active=True)
            .select_related("prateleira__rua__armazem")
            .annotate(
                total_unidades=Count(
                    "unidades_fisicas",
                    filter=Q(unidades_fisicas__is_active=True),
                ),
                total_lotes=Count(
                    "lotes_insumo",
                    filter=Q(lotes_insumo__is_active=True),
                ),
            )
        )
        prateleira_id = self.request.query_params.get("prateleira")
        if prateleira_id:
            qs = qs.filter(prateleira_id=prateleira_id)
        return qs.order_by("prateleira__codigo", "ordem", "codigo")

    def perform_destroy(self, instance: Nivel) -> None:
        instance.soft_delete()

    @action(detail=True, methods=["get"])
    def conteudo(self, request: Request, pk: str = None) -> Response:
        nivel = self.get_object()
        from apps.inventory.models_physical import LoteInsumo, UnidadeFisica
        from apps.inventory.serializers import (
            LoteInsumoListSerializer,
            UnidadeFisicaListSerializer,
        )

        unidades = UnidadeFisica.objects.filter(
            nivel=nivel, is_active=True,
        ).select_related("peca_canonica")
        lotes = LoteInsumo.objects.filter(
            nivel=nivel, is_active=True, saldo__gt=0,
        ).select_related("material_canonico")

        return Response({
            "unidades": UnidadeFisicaListSerializer(unidades, many=True).data,
            "lotes": LoteInsumoListSerializer(lotes, many=True).data,
        })
```

- [ ] **Step 3: Registrar nos URLs**

Adicionar ao `backend/core/apps/inventory/urls.py`:

```python
# Adicionar imports
from apps.inventory.views_location import (
    ArmazemViewSet,
    NivelViewSet,
    PrateleiraViewSet,
    RuaViewSet,
)

# Adicionar registros no router
router.register(r"armazens", ArmazemViewSet, basename="armazem")
router.register(r"ruas", RuaViewSet, basename="rua")
router.register(r"prateleiras", PrateleiraViewSet, basename="prateleira")
router.register(r"niveis", NivelViewSet, basename="nivel")
```

- [ ] **Step 4: Verificar que funciona**

Run: `cd backend/core && python manage.py check`
Expected: `System check identified no issues.`

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/inventory/serializers_location.py \
        backend/core/apps/inventory/views_location.py \
        backend/core/apps/inventory/urls.py
git commit -m "feat(inventory): CRUD endpoints de localização — armazém, rua, prateleira, nível"
```

---

### Task 1.4: Adicionar FK `nivel` em UnidadeFisica e LoteInsumo

**Files:**
- Modify: `backend/core/apps/inventory/models_physical.py`

- [ ] **Step 1: Adicionar campo nivel nos dois models**

Em `models_physical.py`, classe `UnidadeFisica`, após o campo `localizacao`:

```python
    nivel = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="unidades_fisicas",
        help_text="Posição no armazém (WMS).",
    )
```

Em `LoteInsumo`, após o campo `localizacao`:

```python
    nivel = models.ForeignKey(
        "inventory.Nivel",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lotes_insumo",
        help_text="Posição no armazém (WMS).",
    )
```

- [ ] **Step 2: Gerar e aplicar migration**

Run: `cd backend/core && python manage.py makemigrations inventory --name wms_add_nivel_fk`
Run: `cd backend/core && python manage.py migrate_schemas`

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/inventory/models_physical.py \
        backend/core/apps/inventory/migrations/0004_*.py
git commit -m "feat(inventory): FK nivel em UnidadeFisica e LoteInsumo"
```

---

### Task 1.5: Management command `setup_estoque_base`

**Files:**
- Create: `backend/core/apps/inventory/management/commands/setup_estoque_base.py`

- [ ] **Step 1: Criar comando idempotente com seeds**

```python
"""Seeds de estoque: TipoPeca (sprint futura) + 3 armazéns DS Car."""
import logging

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.inventory.models_location import Armazem

logger = logging.getLogger(__name__)

ARMAZENS_DSCAR = [
    {"codigo": "G1", "nome": "Galpão Principal", "tipo": "galpao"},
    {"codigo": "G2", "nome": "Galpão Secundário", "tipo": "galpao"},
    {"codigo": "G3", "nome": "Galpão Reserva", "tipo": "galpao"},
    {"codigo": "PT1", "nome": "Pátio Externo", "tipo": "patio"},
]


class Command(BaseCommand):
    help = "Popula dados base de estoque (armazéns DS Car). Idempotente."

    def handle(self, *args: object, **options: object) -> None:
        schema = "tenant_dscar"
        with schema_context(schema):
            created = 0
            for data in ARMAZENS_DSCAR:
                _, was_created = Armazem.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={"nome": data["nome"], "tipo": data["tipo"]},
                )
                if was_created:
                    created += 1
            logger.info(f"Armazéns: {created} criados, {len(ARMAZENS_DSCAR) - created} já existiam.")
            self.stdout.write(self.style.SUCCESS(f"Setup estoque base concluído: {created} armazéns criados."))
```

- [ ] **Step 2: Verificar**

Run: `cd backend/core && python manage.py check`

- [ ] **Step 3: Commit**

```bash
git add backend/core/apps/inventory/management/commands/setup_estoque_base.py
git commit -m "feat(inventory): management command setup_estoque_base — seeds armazéns DS Car"
```

---

## Sprint 2 — Backend: Produto Comercial

### Task 2.1: Models de classificação e produto comercial

**Files:**
- Create: `backend/core/apps/inventory/models_product.py`
- Test: `backend/core/apps/inventory/tests/test_product_models.py`

- [ ] **Step 1: Criar models_product.py**

```python
"""
Paddock Solutions — Inventory — Produto Comercial
WMS-5: Peças e insumos são models SEPARADOS — nunca misturar.

ProdutoComercialPeca: cadastro comercial de peças (SKU, EAN, tipo, posição, margem).
ProdutoComercialInsumo: cadastro comercial de insumos (SKU, EAN, unidade, margem).
"""
from decimal import Decimal

from django.db import models

from apps.authentication.models import PaddockBaseModel


class TipoPeca(PaddockBaseModel):
    """Tipo de peça automotiva — extensível via CRUD (sem migration)."""

    nome = models.CharField(max_length=80)
    codigo = models.CharField(max_length=10)
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_tipo_peca"
        verbose_name = "Tipo de Peça"
        verbose_name_plural = "Tipos de Peça"
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(is_active=True),
                name="unique_tipo_peca_codigo_active",
            ),
        ]
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class CategoriaProduto(PaddockBaseModel):
    """Categoria comercial de peças com margem padrão."""

    nome = models.CharField(max_length=80)
    codigo = models.CharField(max_length=10)
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Margem padrão sobre custo (ex: 35.00 = +35%).",
    )
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_categoria_produto"
        verbose_name = "Categoria de Produto"
        verbose_name_plural = "Categorias de Produto"
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(is_active=True),
                name="unique_categoria_produto_codigo_active",
            ),
        ]
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome} ({self.margem_padrao_pct}%)"


class CategoriaInsumo(PaddockBaseModel):
    """Categoria comercial de insumos com margem padrão."""

    nome = models.CharField(max_length=80)
    codigo = models.CharField(max_length=10)
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Margem padrão sobre custo (ex: 30.00 = +30%).",
    )
    ordem = models.PositiveIntegerField(default=0)

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_categoria_insumo"
        verbose_name = "Categoria de Insumo"
        verbose_name_plural = "Categorias de Insumo"
        constraints = [
            models.UniqueConstraint(
                fields=["codigo"],
                condition=models.Q(is_active=True),
                name="unique_categoria_insumo_codigo_active",
            ),
        ]
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nome} ({self.margem_padrao_pct}%)"


class PosicaoVeiculo(models.TextChoices):
    DIANTEIRO = "dianteiro", "Dianteiro"
    TRASEIRO = "traseiro", "Traseiro"
    LATERAL_ESQ = "lateral_esq", "Lateral Esquerdo"
    LATERAL_DIR = "lateral_dir", "Lateral Direito"
    SUPERIOR = "superior", "Superior"
    INFERIOR = "inferior", "Inferior"
    NA = "na", "N/A"


class LadoPeca(models.TextChoices):
    ESQUERDO = "esquerdo", "Esquerdo"
    DIREITO = "direito", "Direito"
    CENTRAL = "central", "Central"
    NA = "na", "N/A"


class ProdutoComercialPeca(PaddockBaseModel):
    """Cadastro comercial de peça — identidade, classificação e preço."""

    # Identidade
    sku_interno = models.CharField(max_length=30, help_text="Código DS Car: PC-001.")
    nome_interno = models.CharField(max_length=150)
    codigo_fabricante = models.CharField(max_length=60, blank=True, default="")
    codigo_ean = models.CharField(max_length=14, blank=True, default="")
    codigo_distribuidor = models.CharField(max_length=60, blank=True, default="")
    nome_fabricante = models.CharField(max_length=150, blank=True, default="")

    # Classificação
    tipo_peca = models.ForeignKey(
        TipoPeca,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )
    posicao_veiculo = models.CharField(
        max_length=15,
        choices=PosicaoVeiculo.choices,
        default=PosicaoVeiculo.NA,
    )
    lado = models.CharField(
        max_length=10,
        choices=LadoPeca.choices,
        default=LadoPeca.NA,
    )
    categoria = models.ForeignKey(
        CategoriaProduto,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )

    # Vínculo catálogo técnico
    peca_canonica = models.ForeignKey(
        "pricing_catalog.PecaCanonica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos_comerciais",
    )

    # Preço
    preco_venda_sugerido = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Override manual — prioridade máxima.",
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Override por produto — prioridade sobre categoria.",
    )
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_produto_comercial_peca"
        verbose_name = "Produto Comercial (Peça)"
        verbose_name_plural = "Produtos Comerciais (Peças)"
        constraints = [
            models.UniqueConstraint(
                fields=["sku_interno"],
                condition=models.Q(is_active=True),
                name="unique_peca_sku_active",
            ),
        ]
        indexes = [
            models.Index(fields=["codigo_ean"]),
            models.Index(fields=["codigo_fabricante"]),
            models.Index(fields=["peca_canonica"]),
            models.Index(fields=["tipo_peca", "posicao_veiculo", "lado"]),
        ]

    def __str__(self) -> str:
        return f"[{self.sku_interno}] {self.nome_interno}"


class ProdutoComercialInsumo(PaddockBaseModel):
    """Cadastro comercial de insumo — identidade, classificação e preço."""

    # Identidade
    sku_interno = models.CharField(max_length=30, help_text="Código DS Car: VN-001.")
    nome_interno = models.CharField(max_length=150)
    codigo_fabricante = models.CharField(max_length=60, blank=True, default="")
    codigo_ean = models.CharField(max_length=14, blank=True, default="")
    nome_fabricante = models.CharField(max_length=150, blank=True, default="")

    # Classificação
    unidade_base = models.CharField(
        max_length=10,
        help_text="Unidade de medida base: L, KG, UN, M.",
    )
    categoria_insumo = models.ForeignKey(
        CategoriaInsumo,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos",
    )

    # Vínculo catálogo técnico
    material_canonico = models.ForeignKey(
        "pricing_catalog.MaterialCanonico",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="produtos_comerciais",
    )

    # Preço
    preco_venda_sugerido = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    margem_padrao_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    observacoes = models.TextField(blank=True, default="")

    class Meta(PaddockBaseModel.Meta):
        db_table = "inventory_produto_comercial_insumo"
        verbose_name = "Produto Comercial (Insumo)"
        verbose_name_plural = "Produtos Comerciais (Insumos)"
        constraints = [
            models.UniqueConstraint(
                fields=["sku_interno"],
                condition=models.Q(is_active=True),
                name="unique_insumo_sku_active",
            ),
        ]
        indexes = [
            models.Index(fields=["codigo_ean"]),
            models.Index(fields=["codigo_fabricante"]),
            models.Index(fields=["material_canonico"]),
        ]

    def __str__(self) -> str:
        return f"[{self.sku_interno}] {self.nome_interno}"
```

- [ ] **Step 2: Adicionar FK produto_peca/produto_insumo nos models físicos**

Em `models_physical.py`, classe `UnidadeFisica`, adicionar:

```python
    produto_peca = models.ForeignKey(
        "inventory.ProdutoComercialPeca",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="unidades_fisicas",
    )
```

Em `LoteInsumo`, adicionar:

```python
    produto_insumo = models.ForeignKey(
        "inventory.ProdutoComercialInsumo",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lotes",
    )
```

- [ ] **Step 3: Escrever testes unitários**

```python
# backend/core/apps/inventory/tests/test_product_models.py
"""Testes unitários para models de produto comercial."""
import uuid

import pytest

from apps.inventory.models_product import (
    CategoriaInsumo,
    CategoriaProduto,
    ProdutoComercialInsumo,
    ProdutoComercialPeca,
    TipoPeca,
)


class TestTipoPecaStr:
    def test_str(self) -> None:
        tipo = TipoPeca(id=uuid.uuid4(), nome="Para-choque", codigo="PCHQ")
        assert str(tipo) == "Para-choque"


class TestCategoriaProdutoStr:
    def test_str_with_margem(self) -> None:
        cat = CategoriaProduto(
            id=uuid.uuid4(), nome="Funilaria", codigo="FUN", margem_padrao_pct=35,
        )
        assert "35" in str(cat)
        assert "FUN" in str(cat)


class TestProdutoComercialPecaStr:
    def test_str(self) -> None:
        prod = ProdutoComercialPeca(
            id=uuid.uuid4(), sku_interno="PC-001", nome_interno="Para-choque Gol G5",
        )
        assert str(prod) == "[PC-001] Para-choque Gol G5"


class TestProdutoComercialInsumoStr:
    def test_str(self) -> None:
        prod = ProdutoComercialInsumo(
            id=uuid.uuid4(), sku_interno="VN-001", nome_interno="Verniz PU",
        )
        assert str(prod) == "[VN-001] Verniz PU"
```

- [ ] **Step 4: Rodar testes**

Run: `cd backend/core && python -m pytest apps/inventory/tests/test_product_models.py -v`
Expected: 4 testes passando

- [ ] **Step 5: Gerar e aplicar migrations**

Run: `cd backend/core && python manage.py makemigrations inventory --name wms_product_models`
Run: `cd backend/core && python manage.py migrate_schemas`

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/inventory/models_product.py \
        backend/core/apps/inventory/models_physical.py \
        backend/core/apps/inventory/tests/test_product_models.py \
        backend/core/apps/inventory/migrations/0005_*.py
git commit -m "feat(inventory): models produto comercial — peças e insumos separados (WMS-5)"
```

---

### Task 2.2: Serializers + ViewSets + URLs de produto comercial

**Files:**
- Create: `backend/core/apps/inventory/serializers_product.py`
- Create: `backend/core/apps/inventory/views_product.py`
- Modify: `backend/core/apps/inventory/urls.py`

- [ ] **Step 1: Criar serializers_product.py**

Serializers CRUD para TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca, ProdutoComercialInsumo. ProdutoComercialPeca inclui `tipo_peca_nome`, `categoria_nome`, `posicao_display`, `lado_display` como read_only. `read_only_fields` protege `id`, `created_at`, `updated_at`.

- [ ] **Step 2: Criar views_product.py**

5 ModelViewSets com `get_permissions()`: leitura CONSULTANT+, escrita MANAGER+. `get_queryset()` com `select_related` nas FKs. Filtros por query params: `?tipo_peca=`, `?categoria=`, `?busca=` (nome ou SKU).

- [ ] **Step 3: Registrar nos URLs**

Adicionar 5 routers: `tipos-peca`, `categorias-produto`, `categorias-insumo`, `produtos-peca`, `produtos-insumo`.

- [ ] **Step 4: Seed TipoPeca no setup_estoque_base**

Adicionar lista exata de seeds ao `setup_estoque_base`:

```python
TIPOS_PECA_DSCAR = [
    {"codigo": "PCHQ", "nome": "Para-choque"},
    {"codigo": "CAPO", "nome": "Capô"},
    {"codigo": "TAMP", "nome": "Tampa Traseira"},
    {"codigo": "PORT", "nome": "Porta"},
    {"codigo": "PBRZ", "nome": "Parabrisas"},
    {"codigo": "VIGA", "nome": "Vigia"},
    {"codigo": "VDPT", "nome": "Vidro de Porta"},
    {"codigo": "VDLT", "nome": "Vidro Lateral"},
    {"codigo": "RETV", "nome": "Retrovisor"},
    {"codigo": "FARL", "nome": "Farol"},
    {"codigo": "LANT", "nome": "Lanterna"},
    {"codigo": "RODA", "nome": "Roda"},
    {"codigo": "PNEU", "nome": "Pneu"},
    {"codigo": "AMRT", "nome": "Amortecedor"},
    {"codigo": "FILT", "nome": "Filtro"},
    {"codigo": "COXM", "nome": "Coxim"},
    {"codigo": "RADI", "nome": "Radiador"},
    {"codigo": "COND", "nome": "Condensador"},
    {"codigo": "ELTV", "nome": "Eletroventilador"},
    {"codigo": "OUTR", "nome": "Outros"},
]
```

Usar `get_or_create` por `codigo` (idempotente). Adicionar `ordem` incremental.

- [ ] **Step 5: `python manage.py check` sem erros**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(inventory): CRUD endpoints produto comercial — peças e insumos"
```

---

## Sprint 3 — Backend: Movimentação + Auditoria

### Task 3.1: Model MovimentacaoEstoque

**Files:**
- Create: `backend/core/apps/inventory/models_movement.py`
- Test: `backend/core/apps/inventory/tests/test_movement_models.py`

- [ ] **Step 1: Criar model imutável com 7 tipos de movimentação**

Conforme spec seção 3.4. `save()` bloqueia update após criação (WMS-1). `realizado_por` NUNCA nullable (WMS-3). FileField para evidência. Indexes em `[tipo, created_at]`, `[unidade_fisica]`, `[lote_insumo]`, `[ordem_servico]`, `[realizado_por]`.

- [ ] **Step 2: Testes de imutabilidade**

Testar que `save()` em instância já persistida levanta `ValueError`. Testar que `realizado_por` é obrigatório.

- [ ] **Step 3: Migration + check**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(inventory): model MovimentacaoEstoque imutável (WMS-1)"
```

---

### Task 3.2: Models de contagem de inventário

**Files:**
- Create: `backend/core/apps/inventory/models_counting.py`
- Test: `backend/core/apps/inventory/tests/test_counting_models.py`

- [ ] **Step 1: Criar ContagemInventario + ItemContagem**

Conforme spec seção 3.5. Status: ABERTA → EM_ANDAMENTO → FINALIZADA | CANCELADA. `divergencia` computed no save().

- [ ] **Step 2: Testes unitários**

- [ ] **Step 3: Migration + check**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(inventory): models contagem de inventário"
```

---

### Task 3.3: Services — LocalizacaoService + EntradaEstoqueService

**Files:**
- Create: `backend/core/apps/inventory/services/localizacao.py`
- Create: `backend/core/apps/inventory/services/entrada.py`
- Test: `backend/core/apps/inventory/tests/test_localizacao_service.py`
- Test: `backend/core/apps/inventory/tests/test_entrada_service.py`

- [ ] **Step 1: Implementar LocalizacaoService**

`mover_item()`, `ocupacao_nivel()`, `ocupacao_armazem()`, `endereco_completo()`. `mover_item` cria `MovimentacaoEstoque(TRANSFERENCIA)`.

- [ ] **Step 2: Implementar EntradaEstoqueService**

`entrada_manual_peca()`, `entrada_manual_lote()`, `registrar_devolucao()`. Todos criam `MovimentacaoEstoque` correspondente. Tudo `@transaction.atomic`.

- [ ] **Step 3: Testes (mocks para banco)**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(inventory): LocalizacaoService + EntradaEstoqueService"
```

---

### Task 3.4: Services — SaidaEstoqueService + adaptação Reserva/Baixa

**Files:**
- Create: `backend/core/apps/inventory/services/saida.py`
- Modify: `backend/core/apps/inventory/services/reserva.py`
- Test: `backend/core/apps/inventory/tests/test_saida_service.py`

- [ ] **Step 1: Implementar SaidaEstoqueService**

`registrar_perda()` — cria `MovimentacaoEstoque(SAIDA_PERDA)` com evidência obrigatória. Status pendente até aprovação.

- [ ] **Step 2: Adaptar ReservaUnidadeService.reservar()**

Após reservar, criar `MovimentacaoEstoque(SAIDA_OS)` com `nivel_origem` da unidade + `ordem_servico` + `realizado_por`.

- [ ] **Step 3: Adaptar BaixaInsumoService.baixar()**

Idem — criar `MovimentacaoEstoque(SAIDA_OS)` para cada `ConsumoInsumo`.

- [ ] **Step 4: Testes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): SaidaEstoqueService + MovimentacaoEstoque em reserva/baixa"
```

---

### Task 3.5: Services — AprovacaoEstoqueService + ContagemService

**Files:**
- Create: `backend/core/apps/inventory/services/aprovacao.py`
- Create: `backend/core/apps/inventory/services/contagem.py`
- Create: `backend/core/apps/inventory/services/movimentacao.py`
- Test: `backend/core/apps/inventory/tests/test_aprovacao_service.py`
- Test: `backend/core/apps/inventory/tests/test_contagem_service.py`

- [ ] **Step 1: Implementar AprovacaoEstoqueService**

`aprovar()` preenche `aprovado_por` + `aprovado_em`, executa a movimentação pendente. `rejeitar()` soft_delete. MANAGER+ validado no service.

- [ ] **Step 2: Implementar ContagemService**

`abrir_contagem()` pré-popula `ItemContagem` com `quantidade_sistema`. `finalizar_contagem()` gera `MovimentacaoEstoque(AJUSTE_INVENTARIO)` para divergências.

- [ ] **Step 3: Implementar MovimentacaoService**

`historico_item()`, `historico_posicao()`, `historico_os()`, `resumo_periodo()` — queries de consulta.

- [ ] **Step 4: Testes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): AprovacaoEstoqueService + ContagemService + MovimentacaoService"
```

---

### Task 3.6: ViewSets de movimentação, aprovação e contagem + URLs

**Files:**
- Create: `backend/core/apps/inventory/serializers_movement.py`
- Create: `backend/core/apps/inventory/serializers_counting.py`
- Create: `backend/core/apps/inventory/views_movement.py`
- Create: `backend/core/apps/inventory/views_counting.py`
- Modify: `backend/core/apps/inventory/urls.py`

- [ ] **Step 1: Serializers de movimentação e contagem**

`MovimentacaoEstoqueSerializer` (read-only, com `realizado_por_nome`, `nivel_origem_endereco`, `nivel_destino_endereco`). `ContagemInventarioSerializer`, `ItemContagemSerializer`.

- [ ] **Step 2: Views de movimentação**

`EntradaPecaView` (POST), `EntradaLoteView` (POST), `DevolucaoView` (POST), `TransferenciaView` (POST), `PerdaView` (POST), `MovimentacaoViewSet` (ReadOnly, filtros), `AprovacaoPendentesList` (GET), `AprovarView` (POST), `RejeitarView` (POST).

- [ ] **Step 3: Views de contagem**

`ContagemViewSet` (CRUD + actions `finalizar`, `cancelar`). `ItemContagemUpdateView` (PATCH).

- [ ] **Step 4: Registrar URLs**

Endpoints conforme spec seções 5.3-5.6.

- [ ] **Step 5: `python manage.py check` sem erros**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(inventory): endpoints movimentação, aprovação e contagem"
```

---

## Sprint 4 — Frontend: Types + Hooks + Sidebar

### Task 4.1: TypeScript types

**Files:**
- Create: `packages/types/src/inventory-location.types.ts`
- Create: `packages/types/src/inventory-product.types.ts`
- Create: `packages/types/src/inventory-movement.types.ts`
- Modify: `packages/types/src/inventory.types.ts`

- [ ] **Step 1: Criar tipos de localização**

Interfaces: `Armazem`, `Rua`, `Prateleira`, `Nivel`, `NivelConteudo`, `OcupacaoRua`.

- [ ] **Step 2: Criar tipos de produto comercial**

Interfaces: `TipoPeca`, `CategoriaProduto`, `CategoriaInsumo`, `ProdutoComercialPeca`, `ProdutoComercialInsumo`, `PosicaoVeiculo`, `LadoPeca`.

- [ ] **Step 3: Criar tipos de movimentação**

Interfaces: `MovimentacaoEstoque`, `TipoMovimentacao`, `ContagemInventario`, `ItemContagem`, `AprovacaoPendente`.

- [ ] **Step 4: Adicionar campos `nivel` e `produto_peca/insumo` nos tipos existentes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(types): tipos TypeScript para WMS — localização, produto, movimentação"
```

---

### Task 4.2: Hooks TanStack Query

**Files:**
- Create: `apps/dscar-web/src/hooks/useInventoryLocation.ts`
- Create: `apps/dscar-web/src/hooks/useInventoryProduct.ts`
- Create: `apps/dscar-web/src/hooks/useInventoryMovement.ts`
- Create: `apps/dscar-web/src/hooks/useInventoryCounting.ts`

- [ ] **Step 1: Hooks de localização**

`useArmazens()`, `useArmazem(id)`, `useArmazemOcupacao(id)`, `useArmazemCreate()`, `useArmazemUpdate(id)`, `useArmazemDelete(id)`, `useRuas(armazemId?)`, `useRuaCreate()`, `usePrateleiras(ruaId?)`, `usePrateleiraCreate()`, `useNiveis(prateleiraId?)`, `useNivelCreate()`, `useNivelConteudo(id)`. Todos usam `fetchList<T>`.

- [ ] **Step 2: Hooks de produto comercial**

`useTiposPeca()`, `useTipoPecaCreate()`, etc. `useProdutosPeca(params?)`, `useProdutoPecaCreate()`, `useProdutoPecaUpdate(id)`, `useProdutoPecaDelete(id)`. Idem para insumos e categorias.

- [ ] **Step 3: Hooks de movimentação e aprovação**

`useMovimentacoes(params?)`, `useEntradaPeca()`, `useEntradaLote()`, `useDevolucao(id)`, `useTransferir()`, `usePerda()`, `useAprovacoesPendentes()`, `useAprovar(id)`, `useRejeitar(id)`.

- [ ] **Step 4: Hooks de contagem**

`useContagens()`, `useContagem(id)`, `useContagemCreate()`, `useRegistrarItem(contagemId, itemId)`, `useFinalizarContagem(id)`, `useCancelarContagem(id)`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dscar-web): hooks TanStack Query para WMS completo"
```

---

### Task 4.3: Expandir Sidebar

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [ ] **Step 1: Substituir seção ESTOQUE atual por versão expandida**

Substituir as linhas 203-217 da seção ESTOQUE na sidebar. 11 itens com ícones Lucide conforme spec 9.2. Badge de contagem em "Aprovações". Ícones: `Warehouse`, `Package`, `FlaskConical`, `Barcode`, `Layers`, `PackagePlus`, `ArrowLeftRight`, `CheckCircle`, `ClipboardList`, `FileText`, `Tag`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): sidebar expandida com submódulos WMS"
```

---

## Sprint 5 — Frontend: Páginas Core

### Task 5.1: Dashboard de estoque (reescrita)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/estoque/page.tsx`

- [ ] **Step 1: Reescrever com 4 KPIs + grid de submódulos**

StatCards: Peças disponíveis, Valor em estoque (formatCurrency compact), Reservadas para OS, Aprovações pendentes. Grid de 9 cards de navegação. Design system fintech-red.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): dashboard estoque com KPIs e submódulos"
```

---

### Task 5.2: Armazéns — lista + detalhe com árvore

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/armazens/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/estoque/armazens/[id]/page.tsx`
- Create: `apps/dscar-web/src/components/inventory/ArmazemTree.tsx`
- Create: `apps/dscar-web/src/components/inventory/PosicaoSelector.tsx`

- [ ] **Step 1: Página lista de armazéns com cards**
- [ ] **Step 2: Componente ArmazemTree — árvore colapsável**
- [ ] **Step 3: Página detalhe com árvore + botões criar rua/prateleira/nível**
- [ ] **Step 4: Componente PosicaoSelector — 4 selects cascata**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dscar-web): páginas armazéns — lista, detalhe com árvore, PosicaoSelector"
```

---

### Task 5.3: Produtos — peças e insumos

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/produtos/pecas/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/estoque/produtos/insumos/page.tsx`
- Create: `apps/dscar-web/src/components/inventory/ProdutoPecaDialog.tsx`
- Create: `apps/dscar-web/src/components/inventory/ProdutoInsumoDialog.tsx`

- [ ] **Step 1: Lista ProdutoComercialPeca com busca (SKU, EAN, nome), filtros (tipo_peca, categoria)**
- [ ] **Step 2: ProdutoPecaDialog — Sheet lateral com form: identidade, classificação, preço**
- [ ] **Step 3: Lista ProdutoComercialInsumo com busca e filtros**
- [ ] **Step 4: ProdutoInsumoDialog — Sheet lateral**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dscar-web): CRUD produtos comerciais — peças e insumos"
```

---

### Task 5.4: Categorias + TipoPeca

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/categorias/page.tsx`

- [ ] **Step 1: Página com 3 tabs: TipoPeca, CategoriaProduto, CategoriaInsumo**

Cada tab com tabela + form inline para criar/editar. Margem % editável direto na tabela para categorias.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): CRUD categorias e tipos de peça"
```

---

## Sprint 6 — Frontend: Operações

### Task 6.1: Reescrita Unidades Físicas + Lotes

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/estoque/unidades/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/estoque/lotes/page.tsx`
- Create: `apps/dscar-web/src/components/inventory/BarcodeScanInput.tsx`

- [ ] **Step 1: BarcodeScanInput — input para leitor USB ou digitação**
- [ ] **Step 2: Reescrever unidades com ações (reservar, transferir, etiqueta), posição, produto**
- [ ] **Step 3: Reescrever lotes com ações (baixar, transferir, etiqueta) + custo FIFO visível**

Cada lote exibe: `{saldo} {unidade_base} a R$ {valor_unitario_base}/{unidade_base} (lote de {created_at})`. Ordenação FIFO (mais antigo primeiro). Card de resumo por material: custo médio ponderado = `SUM(saldo × valor_unitario_base) / SUM(saldo)`.
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dscar-web): reescrita unidades/lotes com ações e posição WMS"
```

---

### Task 6.2: Entrada Manual

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/entrada/page.tsx`

- [ ] **Step 1: Formulário com toggle Peça/Lote**

Peça: PecaCanonica select + valor + PosicaoSelector + ProdutoComercialPeca opcional.
Lote: MaterialCanonico select + quantidade + valor + fator conversão + PosicaoSelector + ProdutoComercialInsumo opcional.
Motivo obrigatório em ambos.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): página entrada manual de estoque"
```

---

### Task 6.3: Movimentações + Aprovações

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/movimentacoes/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/estoque/aprovacoes/page.tsx`
- Create: `apps/dscar-web/src/components/inventory/MovimentacaoTimeline.tsx`
- Create: `apps/dscar-web/src/components/inventory/EvidenciaUpload.tsx`

- [ ] **Step 1: MovimentacaoTimeline — timeline vertical reutilizável**
- [ ] **Step 2: Página movimentações — tabela com filtros (tipo, período, usuário, OS)**
- [ ] **Step 3: EvidenciaUpload — upload de foto com preview**
- [ ] **Step 4: Página aprovações — lista pendentes MANAGER+ com evidência e botões aprovar/rejeitar**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dscar-web): páginas movimentações e aprovações"
```

---

### Task 6.4: Contagens de Inventário

**Files:**
- Create: `apps/dscar-web/src/app/(app)/estoque/contagens/page.tsx`
- Create: `apps/dscar-web/src/app/(app)/estoque/contagens/[id]/page.tsx`

- [ ] **Step 1: Lista contagens com status + botão "Nova Contagem" (tipo + armazém/rua)**
- [ ] **Step 2: Detalhe — tabela de itens com input quantidade_contada, badge divergência, botão finalizar MANAGER+**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(dscar-web): páginas contagem de inventário"
```

---

## Sprint 7 — Integração OS + Polish

### Task 7.1: Aba "Estoque" na OS Detail

**Files:**
- Create: `apps/dscar-web/src/components/inventory/MargemBadge.tsx`
- Modify: OS detail page (adicionar tab "Estoque")

- [ ] **Step 1: MargemBadge — success-* (lucro) / error-* (prejuízo)**

```tsx
// Usar tokens do design system — NUNCA emerald/red brutos
// Positivo: bg-success-500/10 text-success-400
// Negativo: bg-error-500/10 text-error-400
// Zero: bg-white/5 text-white/40
```
- [ ] **Step 2: Tab "Estoque" na OS: BarcodeScanInput + tabela margem + resumo + timeline**

Tabela: Peça/Insumo | SKU | Posição | Custo (NF) | Cobrado | Margem.

Fontes de dados (spec 7.4):
- **Custo peça**: `UnidadeFisica.valor_nf` (via `service_order.unidades_fisicas`)
- **Custo insumo**: `ConsumoInsumo.valor_unitario_na_baixa` (via `service_order.consumos_insumo`)
- **Valor cobrado peça**: `OSIntervencao.valor_peca` (via `service_order.intervencoes_motor`) OU `ServiceOrderPart.sale_price` (legado via `service_order.parts`)
- **Margem**: `(cobrado - custo) / custo × 100`

Visível apenas MANAGER+ via `<PermissionGate role="MANAGER">`.

- [ ] **Step 3: Cards resumo: custo total, valor cobrado, margem total**
- [ ] **Step 4: MovimentacaoTimeline filtrando por `ordem_servico`**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dscar-web): aba Estoque na OS detail — margem e movimentações"
```

---

### Task 7.2: Melhorias NF-e (reconciliação interativa)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/estoque/nfe-recebida/[id]/page.tsx`

- [ ] **Step 1: Adicionar select por item para reconciliar (peça/insumo/ignorado)**

Quando "peça": select de PecaCanonica + ProdutoComercialPeca.
Quando "insumo": select de MaterialCanonico + ProdutoComercialInsumo.
Botão "Reconciliar" por item + "Gerar Estoque" quando todos reconciliados.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(dscar-web): reconciliação interativa de itens NF-e"
```

---

### Task 7.3: Testes E2E (smoke tests)

**Files:**
- Create: `apps/dscar-web/e2e/inventory-wms.spec.ts`

- [ ] **Step 1: Smoke tests Playwright**

- Navegar para `/estoque` — dashboard carrega sem erros
- Navegar para `/estoque/armazens` — lista de armazéns aparece
- Navegar para `/estoque/produtos/pecas` — lista carrega
- Navegar para `/estoque/movimentacoes` — lista carrega
- Criar armazém via UI e verificar que aparece na lista

- [ ] **Step 2: Commit**

```bash
git commit -m "test(dscar-web): smoke tests E2E para WMS"
```

---

## Resumo de Sprints

| Sprint | Foco | Tasks | Estimativa |
|--------|------|-------|------------|
| **1** | Backend: Localização + Permission | 1.1–1.5 | Models, ViewSets, URLs, seeds |
| **2** | Backend: Produto Comercial | 2.1–2.2 | Models, ViewSets, URLs |
| **3** | Backend: Movimentação + Auditoria | 3.1–3.6 | Models, 6 services, ViewSets |
| **4** | Frontend: Types + Hooks + Sidebar | 4.1–4.3 | Types TS, hooks, sidebar |
| **5** | Frontend: Páginas Core | 5.1–5.4 | Dashboard, armazéns, produtos, categorias |
| **6** | Frontend: Operações | 6.1–6.4 | Unidades, lotes, entrada, movimentações, contagens |
| **7** | Integração OS + Polish | 7.1–7.3 | Aba estoque OS, NF-e, E2E |

**Total:** 7 sprints · 20 tasks · ~130 checkboxes
