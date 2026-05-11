# Apontamento de Horas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable technicians and consultants to register work hours on service orders via the mobile app, with timer and manual modes, auto-filtering technicians by sector based on OS status, and seed 18 test employees.

**Architecture:** Backend adds a seed command for employees, a nested ViewSet for apontamentos under `/service-orders/{id}/apontamentos/`, and a department filter on the existing staff endpoint. Mobile adds a full-screen timesheet screen with timer + manual modes, reusing existing hooks and API patterns.

**Tech Stack:** Django 5 + DRF (backend), React Native + Expo Router + TanStack Query (mobile)

**Spec:** `docs/superpowers/specs/2026-05-11-apontamento-horas-design.md`

---

## File Structure

```
BACKEND — NEW:
  apps/hr/management/__init__.py
  apps/hr/management/commands/__init__.py
  apps/hr/management/commands/seed_employees.py         ← Seed 18 employees
  apps/service_orders/serializers/apontamento.py        ← Serializer
  apps/service_orders/views/apontamento.py              ← ViewSet

BACKEND — MODIFIED:
  apps/service_orders/urls.py                           ← Register apontamento routes
  apps/authentication/views.py                          ← Add departments filter

MOBILE — NEW:
  app/(app)/os/apontamento/[osId].tsx                   ← Main screen
  src/components/os/TimerCard.tsx                       ← Timer widget
  src/hooks/useApontamentos.ts                          ← CRUD hooks

MOBILE — MODIFIED:
  app/(app)/os/_layout.tsx                              ← Register route
  src/components/os/GeneralTab.tsx                      ← Add button
  src/components/os/TransitionRequirementsSheet.tsx      ← TIMESHEET_CLOSED action
  src/components/navigation/FrostedNavBar.tsx            ← Hide navbar
```

---

### Task 1: Seed employees command

**Files:**
- Create: `backend/core/apps/hr/management/__init__.py`
- Create: `backend/core/apps/hr/management/commands/__init__.py`
- Create: `backend/core/apps/hr/management/commands/seed_employees.py`

- [ ] **Step 1: Create management directory structure**

```bash
mkdir -p backend/core/apps/hr/management/commands
touch backend/core/apps/hr/management/__init__.py
touch backend/core/apps/hr/management/commands/__init__.py
```

- [ ] **Step 2: Create the seed command**

Create `backend/core/apps/hr/management/commands/seed_employees.py`:

```python
"""
Paddock Solutions — Seed Employee Test Data

Cria 3 colaboradores por setor produtivo (18 total).
Idempotente: usa get_or_create no username.
"""
import hashlib
import logging
from datetime import date
from typing import Any

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

EMPLOYEES = [
    # (username, name, department, position, role)
    # Funilaria
    ("carlos.funileiro", "Carlos Silva", "bodywork", "bodyworker", "STOREKEEPER"),
    ("roberto.funileiro", "Roberto Santos", "bodywork", "bodyworker", "STOREKEEPER"),
    ("andre.funileiro", "Andre Oliveira", "bodywork", "bodyworker", "STOREKEEPER"),
    # Pintura
    ("marcos.pintor", "Marcos Lima", "painting", "painter", "STOREKEEPER"),
    ("paulo.pintor", "Paulo Costa", "painting", "painter", "STOREKEEPER"),
    ("lucas.pintor", "Lucas Souza", "painting", "painter", "STOREKEEPER"),
    # Mecanica
    ("jose.mecanico", "Jose Pereira", "mechanical", "mechanic", "STOREKEEPER"),
    ("rafael.mecanico", "Rafael Almeida", "mechanical", "mechanic", "STOREKEEPER"),
    ("fernando.mecanico", "Fernando Rocha", "mechanical", "mechanic", "STOREKEEPER"),
    # Polimento
    ("diego.polidor", "Diego Nascimento", "polishing", "polisher", "STOREKEEPER"),
    ("bruno.polidor", "Bruno Ferreira", "polishing", "polisher", "STOREKEEPER"),
    ("leandro.polidor", "Leandro Carvalho", "polishing", "polisher", "STOREKEEPER"),
    # Lavagem
    ("mateus.lavador", "Mateus Ribeiro", "washing", "washer", "STOREKEEPER"),
    ("gustavo.lavador", "Gustavo Martins", "washing", "washer", "STOREKEEPER"),
    ("felipe.lavador", "Felipe Gomes", "washing", "washer", "STOREKEEPER"),
    # Consultores
    ("marina.consultora", "Marina Campos", "reception", "consultant", "CONSULTANT"),
    ("juliana.consultora", "Juliana Dias", "reception", "consultant", "CONSULTANT"),
    ("amanda.consultora", "Amanda Moreira", "reception", "consultant", "CONSULTANT"),
]


class Command(BaseCommand):
    help = "Seed 18 test employees (3 per production sector)"

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--schema",
            default="tenant_dscar",
            help="Tenant schema name (default: tenant_dscar)",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        from django_tenants.utils import schema_context

        schema: str = options["schema"]
        self.stdout.write(f"Seeding employees in schema '{schema}'...")

        with schema_context(schema):
            self._seed_employees()

        self.stdout.write(self.style.SUCCESS("Done!"))

    def _seed_employees(self) -> None:
        from apps.authentication.models import GlobalUser
        from apps.hr.models import Employee

        created_count = 0
        for username, name, department, position, role in EMPLOYEES:
            email = f"{username}@dscar.paddock.solutions"
            email_hash = hashlib.sha256(email.encode()).hexdigest()

            user, user_created = GlobalUser.objects.get_or_create(
                email_hash=email_hash,
                defaults={
                    "email": email,
                    "name": name,
                    "username": username,
                    "is_active": True,
                },
            )
            if user_created:
                user.set_password("paddock123")
                user.save(update_fields=["password"])

            _, emp_created = Employee.objects.get_or_create(
                user=user,
                defaults={
                    "department": department,
                    "position": position,
                    "role": role,
                    "status": "active",
                    "contract_type": "clt",
                    "hire_date": date(2025, 1, 1),
                    "registration_number": username.replace(".", ""),
                },
            )

            if user_created or emp_created:
                created_count += 1
                self.stdout.write(f"  + {name} ({department}/{position})")
            else:
                self.stdout.write(f"  = {name} (already exists)")

        self.stdout.write(f"  Total: {created_count} new employees created")
```

- [ ] **Step 3: Run the seed**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py seed_employees
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/hr/management/
git commit -m "feat(hr): add seed_employees command — 18 test employees by sector"
```

---

### Task 2: Add departments filter to StaffListView

**Files:**
- Modify: `backend/core/apps/authentication/views.py`

- [ ] **Step 1: Add departments filter**

In `backend/core/apps/authentication/views.py`, modify the `StaffListView.get()` method. The current method filters by `positions`. Add a `departments` parameter that filters by `Employee.department`:

Find the `get` method of `StaffListView` (line ~287) and replace it:

```python
    def get(self, request: Request) -> Response:
        positions_param = request.query_params.get("positions", "").strip()
        departments_param = request.query_params.get("departments", "").strip()

        if positions_param or departments_param:
            try:
                from apps.hr.models import Employee

                filters: dict = {"is_active": True}
                if positions_param:
                    positions = [p.strip() for p in positions_param.split(",") if p.strip()]
                    filters["position__in"] = positions
                if departments_param:
                    departments = [d.strip() for d in departments_param.split(",") if d.strip()]
                    filters["department__in"] = departments

                employee_user_ids = Employee.objects.filter(**filters).values_list(
                    "user_id", flat=True
                )
                users = GlobalUser.objects.filter(
                    id__in=employee_user_ids,
                    is_active=True,
                ).order_by("name")
            except Exception:
                users = GlobalUser.objects.filter(is_active=True).order_by("name")
        else:
            users = GlobalUser.objects.filter(is_active=True).order_by("name")

        return Response(StaffUserSerializer(users, many=True).data)
```

Also update the docstring to mention the new parameter:

```python
    """
    GET  /api/v1/auth/staff/                                — lista todos os usuários ativos
    GET  /api/v1/auth/staff/?positions=consultant,manager   — filtra por cargo HR
    GET  /api/v1/auth/staff/?departments=painting,bodywork  — filtra por setor HR
    """
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/apps/authentication/views.py
git commit -m "feat(auth): add departments filter to StaffListView"
```

---

### Task 3: Backend — Apontamento serializer + viewset + urls

**Files:**
- Create: `backend/core/apps/service_orders/serializers/apontamento.py`
- Create: `backend/core/apps/service_orders/views/apontamento.py`
- Modify: `backend/core/apps/service_orders/urls.py`

- [ ] **Step 1: Create serializer**

Create `backend/core/apps/service_orders/serializers/apontamento.py`:

```python
"""Apontamento de Horas — Serializers."""
from __future__ import annotations

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.authentication.models import GlobalUser
from apps.service_orders.models.capacity import ApontamentoHoras


class TecnicoMiniSerializer(serializers.ModelSerializer):
    """Snapshot mínimo do técnico para listagem de apontamentos."""

    class Meta:
        model = GlobalUser
        fields = ["id", "name"]
        read_only_fields = ["id", "name"]


class ApontamentoSerializer(serializers.ModelSerializer):
    """Serializer para leitura de apontamentos."""

    tecnico = TecnicoMiniSerializer(read_only=True)

    class Meta:
        model = ApontamentoHoras
        fields = [
            "id",
            "tecnico",
            "iniciado_em",
            "encerrado_em",
            "horas_apontadas",
            "observacao",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class ApontamentoCreateSerializer(serializers.Serializer):
    """Serializer para criação de apontamentos (timer ou manual)."""

    tecnico_id = serializers.UUIDField()
    iniciado_em = serializers.DateTimeField(required=False)
    encerrado_em = serializers.DateTimeField(required=False)
    observacao = serializers.CharField(required=False, default="", allow_blank=True)

    def validate_tecnico_id(self, value: str) -> str:
        if not GlobalUser.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Técnico não encontrado.")
        return value

    def validate(self, attrs: dict) -> dict:
        iniciado = attrs.get("iniciado_em")
        encerrado = attrs.get("encerrado_em")
        if encerrado and not iniciado:
            raise serializers.ValidationError(
                {"iniciado_em": "Obrigatório quando encerrado_em é informado."}
            )
        if encerrado and iniciado and encerrado <= iniciado:
            raise serializers.ValidationError(
                {"encerrado_em": "Deve ser posterior ao início."}
            )
        return attrs
```

- [ ] **Step 2: Create viewset**

Create `backend/core/apps/service_orders/views/apontamento.py`:

```python
"""Apontamento de Horas — ViewSet."""
from __future__ import annotations

import logging
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.authentication.permissions import IsConsultantOrAbove
from apps.service_orders.models.capacity import ApontamentoHoras
from apps.service_orders.models.service_order import ServiceOrder
from apps.service_orders.serializers.apontamento import (
    ApontamentoCreateSerializer,
    ApontamentoSerializer,
)

logger = logging.getLogger(__name__)


class ApontamentoViewSet(GenericViewSet):
    """
    Apontamentos de horas vinculados a uma OS.

    GET  /service-orders/{os_id}/apontamentos/           — lista
    POST /service-orders/{os_id}/apontamentos/           — cria (timer ou manual)
    POST /service-orders/{os_id}/apontamentos/{id}/encerrar/ — encerra timer
    """

    permission_classes = [IsAuthenticated, IsConsultantOrAbove]
    serializer_class = ApontamentoSerializer

    def get_queryset(self):  # type: ignore[override]
        os_id = self.kwargs.get("service_order_pk")
        return (
            ApontamentoHoras.objects.filter(
                service_order_id=os_id, is_active=True
            )
            .select_related("tecnico")
            .order_by("-iniciado_em")
        )

    def list(self, request: Request, **kwargs: object) -> Response:
        """Lista apontamentos da OS."""
        qs = self.get_queryset()
        return Response(ApontamentoSerializer(qs, many=True).data)

    def create(self, request: Request, **kwargs: object) -> Response:
        """Cria apontamento — timer (só tecnico_id) ou manual (com horários)."""
        os_id = self.kwargs["service_order_pk"]
        serializer = ApontamentoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tecnico_id = data["tecnico_id"]
        iniciado_em = data.get("iniciado_em")
        encerrado_em = data.get("encerrado_em")
        observacao = data.get("observacao", "")

        # Modo timer: verifica se já tem timer aberto
        if not iniciado_em and not encerrado_em:
            existing = ApontamentoHoras.objects.filter(
                service_order_id=os_id,
                tecnico_id=tecnico_id,
                status="iniciado",
                is_active=True,
            ).exists()
            if existing:
                return Response(
                    {"detail": "Técnico já possui timer aberto nesta OS."},
                    status=status.HTTP_409_CONFLICT,
                )

        # Calcular horas se manual
        horas = Decimal("0")
        apto_status = "iniciado"
        now = timezone.now()

        if iniciado_em and encerrado_em:
            diff = encerrado_em - iniciado_em
            horas = Decimal(str(round(diff.total_seconds() / 3600, 2)))
            apto_status = "encerrado"
        elif not iniciado_em:
            iniciado_em = now

        apontamento = ApontamentoHoras.objects.create(
            service_order_id=os_id,
            tecnico_id=tecnico_id,
            iniciado_em=iniciado_em,
            encerrado_em=encerrado_em,
            horas_apontadas=horas,
            observacao=observacao,
            status=apto_status,
        )

        return Response(
            ApontamentoSerializer(apontamento).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="encerrar")
    def encerrar(self, request: Request, **kwargs: object) -> Response:
        """Encerra um timer aberto."""
        apontamento = self.get_object()

        if apontamento.status != "iniciado":
            return Response(
                {"detail": "Apontamento já encerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        diff = now - apontamento.iniciado_em
        horas = Decimal(str(round(diff.total_seconds() / 3600, 2)))

        apontamento.encerrado_em = now
        apontamento.horas_apontadas = horas
        apontamento.status = "encerrado"
        apontamento.save(update_fields=["encerrado_em", "horas_apontadas", "status", "updated_at"])

        return Response(ApontamentoSerializer(apontamento).data)
```

- [ ] **Step 3: Register URLs**

In `backend/core/apps/service_orders/urls.py`, add the apontamento routes. Add import and router:

```python
from .views.apontamento import ApontamentoViewSet

apontamento_router = SimpleRouter()
apontamento_router.register(r"", ApontamentoViewSet, basename="apontamento")
```

Add the path in `urlpatterns` **before** the catch-all `path("", include(router.urls))`:

```python
    path("<uuid:service_order_pk>/apontamentos/", include(apontamento_router.urls)),
```

- [ ] **Step 4: Commit**

```bash
git add backend/core/apps/service_orders/serializers/apontamento.py \
        backend/core/apps/service_orders/views/apontamento.py \
        backend/core/apps/service_orders/urls.py
git commit -m "feat(service-orders): add ApontamentoHoras API (list, create, encerrar)"
```

---

### Task 4: Mobile — useApontamentos hook

**Files:**
- Create: `apps/mobile/src/hooks/useApontamentos.ts`

- [ ] **Step 1: Create the hook**

Create `apps/mobile/src/hooks/useApontamentos.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast.store';
import { serviceOrderKeys } from './useServiceOrders';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApontamentoTecnico {
  id: string;
  name: string;
}

export interface Apontamento {
  id: string;
  tecnico: ApontamentoTecnico;
  iniciado_em: string;
  encerrado_em: string | null;
  horas_apontadas: string;
  observacao: string;
  status: 'iniciado' | 'encerrado' | 'validado';
  created_at: string;
}

interface CreateTimerPayload {
  tecnico_id: string;
}

interface CreateManualPayload {
  tecnico_id: string;
  iniciado_em: string;
  encerrado_em: string;
  observacao?: string;
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const apontamentoKeys = {
  all: (osId: string) => ['apontamentos', osId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useApontamentos(osId: string) {
  return useQuery<Apontamento[]>({
    queryKey: apontamentoKeys.all(osId),
    queryFn: () => api.get<Apontamento[]>(`/service-orders/${osId}/apontamentos/`),
    enabled: osId.length > 0,
  });
}

export function useCreateApontamento(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTimerPayload | CreateManualPayload) =>
      api.post<Apontamento>(`/service-orders/${osId}/apontamentos/`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apontamentoKeys.all(osId) });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    onError: () => {
      toast.error('Erro ao criar apontamento');
    },
  });
}

export function useEncerrarApontamento(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (apontamentoId: string) =>
      api.post<Apontamento>(
        `/service-orders/${osId}/apontamentos/${apontamentoId}/encerrar/`,
        {},
      ),
    onSuccess: () => {
      toast.success('Apontamento encerrado');
      void qc.invalidateQueries({ queryKey: apontamentoKeys.all(osId) });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    onError: () => {
      toast.error('Erro ao encerrar apontamento');
    },
  });
}

// ─── Staff by department ────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  job_title: string;
  job_title_display: string;
}

const STATUS_TO_DEPARTMENT: Record<string, string> = {
  mechanic: 'mechanical',
  bodywork: 'bodywork',
  painting: 'painting',
  polishing: 'polishing',
  washing: 'washing',
  assembly: 'bodywork',
  repair: 'mechanical',
};

export function useStaffByDepartment(osStatus: string) {
  const dept = STATUS_TO_DEPARTMENT[osStatus];
  const queryParam = dept ? `?departments=${dept}` : '';

  return useQuery<StaffMember[]>({
    queryKey: ['staff', dept ?? 'all'],
    queryFn: () => api.get<StaffMember[]>(`/auth/staff/${queryParam}`),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useApontamentos.ts
git commit -m "feat(mobile): add useApontamentos hooks + useStaffByDepartment"
```

---

### Task 5: Mobile — TimerCard component

**Files:**
- Create: `apps/mobile/src/components/os/TimerCard.tsx`

- [ ] **Step 1: Create the component**

Create `apps/mobile/src/components/os/TimerCard.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';

interface TimerCardProps {
  tecnicoName: string;
  iniciadoEm: string; // ISO string
  onEncerrar: () => void;
  isLoading: boolean;
}

function formatElapsed(startIso: string): string {
  const diff = Date.now() - new Date(startIso).getTime();
  if (diff < 0) return '00:00:00';
  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerCard({ tecnicoName, iniciadoEm, onEncerrar, isLoading }: TimerCardProps): React.JSX.Element {
  const [elapsed, setElapsed] = useState(formatElapsed(iniciadoEm));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(iniciadoEm));
    }, 1000);
    return () => clearInterval(interval);
  }, [iniciadoEm]);

  return (
    <View style={styles.card}>
      <View style={styles.dot} />
      <View style={styles.info}>
        <Text style={styles.name}>{tecnicoName}</Text>
        <Text style={styles.timer}>{elapsed}</Text>
      </View>
      <Button
        label="Encerrar"
        variant="secondary"
        onPress={onEncerrar}
        loading={isLoading}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.success.bg,
    borderWidth: 1,
    borderColor: SemanticColors.success.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SemanticColors.success.color,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  timer: {
    fontSize: 22, fontWeight: '800', color: SemanticColors.success.color,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  btn: { minWidth: 90 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/TimerCard.tsx
git commit -m "feat(mobile): add TimerCard component with live countdown"
```

---

### Task 6: Mobile — Apontamento screen + route registration + integrations

**Files:**
- Create: `apps/mobile/app/(app)/os/apontamento/[osId].tsx`
- Modify: `apps/mobile/app/(app)/os/_layout.tsx`
- Modify: `apps/mobile/src/components/os/GeneralTab.tsx`
- Modify: `apps/mobile/src/components/os/TransitionRequirementsSheet.tsx`
- Modify: `apps/mobile/src/components/navigation/FrostedNavBar.tsx`

- [ ] **Step 1: Create the apontamento screen**

Create `apps/mobile/app/(app)/os/apontamento/[osId].tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TimerCard } from '@/components/os/TimerCard';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import {
  useApontamentos,
  useCreateApontamento,
  useEncerrarApontamento,
  useStaffByDepartment,
  type Apontamento,
} from '@/hooks/useApontamentos';
import type { ServiceOrderDetail } from '@/components/os/os-detail-utils';

const MODE_TABS = ['Timer', 'Manual'];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function formatHours(h: string): string {
  const num = parseFloat(h);
  if (isNaN(num)) return '0h';
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  return mins > 0 ? `${hrs}h${String(mins).padStart(2, '0')}` : `${hrs}h`;
}

export default function ApontamentoScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { order: rawOrder, isLoading: osLoading } = useServiceOrder(osId ?? '');
  const order = rawOrder as ServiceOrderDetail | null;
  const { data: apontamentos, isLoading: aptLoading, refetch } = useApontamentos(osId ?? '');
  const { data: staff } = useStaffByDepartment(order?.status ?? '');
  const createMutation = useCreateApontamento(osId ?? '');
  const encerrarMutation = useEncerrarApontamento(osId ?? '');

  const [mode, setMode] = useState(0);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('');
  const [manualInicio, setManualInicio] = useState('');
  const [manualFim, setManualFim] = useState('');
  const [observacao, setObservacao] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const activeTimers = (apontamentos ?? []).filter((a) => a.status === 'iniciado');
  const closedApts = (apontamentos ?? []).filter((a) => a.status !== 'iniciado');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStartTimer = async (): Promise<void> => {
    if (!selectedTecnico) return;
    await createMutation.mutateAsync({ tecnico_id: selectedTecnico });
  };

  const handleManualSave = async (): Promise<void> => {
    if (!selectedTecnico || !manualInicio || !manualFim) return;
    const today = new Date().toISOString().split('T')[0];
    await createMutation.mutateAsync({
      tecnico_id: selectedTecnico,
      iniciado_em: `${today}T${manualInicio}:00`,
      encerrado_em: `${today}T${manualFim}:00`,
      observacao,
    });
    setManualInicio('');
    setManualFim('');
    setObservacao('');
  };

  if (osLoading || !order) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.loading}><ActivityIndicator size="large" color={Colors.brand} /></View>
      </View>
    );
  }

  const selectedName = staff?.find((s) => s.id === selectedTecnico)?.name ?? '';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Apontamento de Horas</Text>
          <Text style={styles.headerSub}>OS #{order.number} · {order.plate?.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={Colors.brand} />}
      >
        {/* Active timers */}
        {activeTimers.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>EM ANDAMENTO</Text>
            {activeTimers.map((apt) => (
              <TimerCard
                key={apt.id}
                tecnicoName={apt.tecnico.name}
                iniciadoEm={apt.iniciado_em}
                onEncerrar={() => { void encerrarMutation.mutateAsync(apt.id); }}
                isLoading={encerrarMutation.isPending}
              />
            ))}
          </>
        )}

        {/* Technician picker */}
        <Text style={[styles.sectionLabel, { marginTop: activeTimers.length > 0 ? Spacing.lg : 0 }]}>TECNICO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techList}>
          {(staff ?? []).map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.techChip, selectedTecnico === s.id && styles.techChipActive]}
              onPress={() => setSelectedTecnico(s.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.techChipText, selectedTecnico === s.id && styles.techChipTextActive]}>
                {s.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          <SegmentedControl tabs={MODE_TABS} activeIndex={mode} onTabChange={setMode} />
        </View>

        {/* Timer mode */}
        {mode === 0 && (
          <Button
            label="Iniciar Trabalho"
            onPress={() => { void handleStartTimer(); }}
            loading={createMutation.isPending}
            disabled={!selectedTecnico}
          />
        )}

        {/* Manual mode */}
        {mode === 1 && (
          <View style={styles.manualForm}>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>INICIO</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="09:00"
                  placeholderTextColor={Colors.textTertiary}
                  value={manualInicio}
                  onChangeText={setManualInicio}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>FIM</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="11:30"
                  placeholderTextColor={Colors.textTertiary}
                  value={manualFim}
                  onChangeText={setManualFim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>OBSERVACAO</Text>
            <TextInput
              style={styles.obsInput}
              placeholder="Descricao do trabalho..."
              placeholderTextColor={Colors.textTertiary}
              value={observacao}
              onChangeText={setObservacao}
              multiline
            />
            <Button
              label="Salvar Apontamento"
              onPress={() => { void handleManualSave(); }}
              loading={createMutation.isPending}
              disabled={!selectedTecnico || !manualInicio || !manualFim}
            />
          </View>
        )}

        {/* Closed entries */}
        {closedApts.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>REGISTROS</Text>
            {closedApts.map((apt) => (
              <View key={apt.id} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{apt.tecnico.name}</Text>
                  <Text style={styles.entryTime}>
                    {formatTime(apt.iniciado_em)}–{apt.encerrado_em ? formatTime(apt.encerrado_em) : '...'}
                  </Text>
                </View>
                <Text style={styles.entryHours}>{formatHours(apt.horas_apontadas)}</Text>
                <Ionicons name="checkmark-circle" size={16} color={SemanticColors.success.color} />
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  techList: { gap: 8, paddingBottom: 4 },
  techChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  techChipActive: { borderColor: Colors.brand, backgroundColor: Colors.brandTint },
  techChipText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  techChipTextActive: { color: Colors.brand, fontWeight: '700' },
  modeRow: { marginVertical: Spacing.lg },
  manualForm: { gap: 12 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  timeInput: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, color: Colors.textPrimary, fontVariant: ['tabular-nums'],
  },
  obsInput: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, minHeight: 60,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  entryTime: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  entryHours: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
});
```

- [ ] **Step 2: Register route in OS Stack**

In `apps/mobile/app/(app)/os/_layout.tsx`, add:
```tsx
<Stack.Screen name="apontamento/[osId]" options={{ headerShown: false }} />
```

- [ ] **Step 3: Hide navbar on apontamento screen**

In `apps/mobile/src/components/navigation/FrostedNavBar.tsx`, add `'/os/apontamento'` to `HIDDEN_SUBPATHS`:
```typescript
const HIDDEN_SUBPATHS = ['/os/resolver', '/os/apontamento'];
```

- [ ] **Step 4: Add "Apontar Horas" button to GeneralTab**

In `apps/mobile/src/components/os/GeneralTab.tsx`, add a third action button after the existing "Avancar Status" and "Checklist" buttons. Inside the `actionRow` View, after the Checklist button:

```tsx
<TouchableOpacity
  style={[styles.actionBtn, styles.actionBtnSecondary]}
  onPress={() => {
    router.push({
      pathname: '/(app)/os/apontamento/[osId]',
      params: { osId },
    });
  }}
  activeOpacity={0.8}
>
  <Ionicons name="timer-outline" size={16} color={Colors.brand} />
  <Text variant="label" color={Colors.brand}>Horas</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Wire TIMESHEET_CLOSED in TransitionRequirementsSheet**

In `apps/mobile/src/components/os/TransitionRequirementsSheet.tsx`, update the `TIMESHEET_CLOSED` entry in `BLOCK_ACTIONS` to navigate to the apontamento screen:

```typescript
TIMESHEET_CLOSED: {
  label: 'Apontar Horas',
  icon: 'timer',
  route: (osId) => ({ pathname: '/(app)/os/apontamento/[osId]', params: { osId } }),
},
```

Also update `TIMESHEET_CLOSED` in the resolver wizard — in `app/(app)/os/resolver/[osId].tsx`, add to `NAV_ACTIONS`:

```typescript
TIMESHEET_CLOSED: {
  label: 'Apontar Horas',
  icon: 'timer',
  route: (osId) => ({ pathname: '/(app)/os/apontamento/[osId]', params: { osId } }),
},
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(app\)/os/apontamento/ \
        apps/mobile/app/\(app\)/os/_layout.tsx \
        apps/mobile/src/components/os/TimerCard.tsx \
        apps/mobile/src/components/os/GeneralTab.tsx \
        apps/mobile/src/components/os/TransitionRequirementsSheet.tsx \
        apps/mobile/app/\(app\)/os/resolver/\[osId\].tsx \
        apps/mobile/src/components/navigation/FrostedNavBar.tsx
git commit -m "feat(mobile): apontamento de horas screen with timer + manual modes"
```

---

### Task 7: Run seed + verify full flow

- [ ] **Step 1: Run seed command**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py seed_employees
```

Expected: 18 employees created (3 per sector)

- [ ] **Step 2: Test staff filter**

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Domain: dscar.localhost" \
  http://localhost:8000/api/v1/auth/staff/?departments=painting | python3 -m json.tool
```

Expected: 3 painters (Marcos, Paulo, Lucas)

- [ ] **Step 3: Test full mobile flow**

1. Open OS in painting status
2. Tap "Horas" button in GeneralTab
3. Verify painters are shown as technician options
4. Select a painter, start timer → verify countdown runs
5. Encerrar → verify entry appears in "REGISTROS"
6. Switch to Manual mode → fill in times → save
7. Go back to OS detail → try advancing status → TIMESHEET_CLOSED should be resolved

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: apontamento de horas — backend API + mobile screen + seed employees"
```
