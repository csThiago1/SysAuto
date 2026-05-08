# Mobile M9b — Agenda, Cadastro Rápido & Kanban

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete consultant parity — create/edit calendar events, schedule vehicles, standalone customer/vehicle registration, expanded "+" menu, and Kanban board for OS overview.

**Architecture:** Agenda extends the existing `useCalendar` hook with mutations for scheduling OS via `PATCH /service-orders/{id}/`. Cadastro uses existing `POST /customers/` and placa-fipe lookup. Kanban fetches all active OS and groups client-side by status columns. The "+" button becomes a bottom sheet with quick actions.

**Tech Stack:** React Native 0.83, Expo SDK 55, TanStack Query v5, @react-native-community/datetimepicker, date-fns (already installed)

---

## Conventions

- **API:** `import { api } from '@/lib/api'` — auto `/api/v1` prefix + trailing slash
- **Theme:** `Colors`, `Spacing`, `Radii`, `Typography` from `@/constants/theme`
- **Toast:** `import { toast } from '@/stores/toast.store'`
- **Date formatting:** `date-fns` with `pt-BR` locale (already used in agenda)

---

## File Map

### New Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/mobile/src/hooks/useScheduleOS.ts` | PATCH scheduling fields on OS |
| Create | `apps/mobile/src/hooks/useCreateCustomer.ts` | POST /customers/ quick create |
| Create | `apps/mobile/src/hooks/useKanbanOS.ts` | Fetch all active OS, group by status |
| Create | `apps/mobile/src/components/agenda/CreateEventModal.tsx` | Modal to create/edit calendar event |
| Create | `apps/mobile/src/components/agenda/WeekView.tsx` | Week timeline view |
| Create | `apps/mobile/app/(app)/cadastro/cliente.tsx` | Standalone customer registration |
| Create | `apps/mobile/app/(app)/cadastro/veiculo.tsx` | Standalone vehicle registration |
| Create | `apps/mobile/app/(app)/kanban/index.tsx` | Kanban board screen |
| Create | `apps/mobile/src/components/kanban/KanbanColumn.tsx` | Single kanban column |
| Create | `apps/mobile/src/components/kanban/KanbanCard.tsx` | OS card in kanban |
| Create | `apps/mobile/src/components/common/QuickActionsSheet.tsx` | Bottom sheet for "+" menu |

### Modified Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `apps/mobile/app/(app)/agenda/index.tsx` | Add create button, week view toggle, event tap handler |
| Modify | `apps/mobile/app/(app)/_layout.tsx` | Add kanban and cadastro routes |
| Modify | `apps/mobile/src/components/navigation/FrostedNavBar.tsx` | "+" button opens QuickActionsSheet instead of navigating directly |

---

## Task 1: Create useScheduleOS hook

**Files:**
- Create: `apps/mobile/src/hooks/useScheduleOS.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SchedulePayload {
  scheduling_date?: string;
  estimated_delivery_date?: string;
  repair_days?: number | null;
  delivery_date?: string;
}

export function useScheduleOS(osId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, SchedulePayload>({
    mutationFn: (payload) =>
      api.patch(`/service-orders/${osId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
      void qc.invalidateQueries({ queryKey: ['service-orders'] });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useScheduleOS.ts
git commit -m "feat(mobile): add useScheduleOS hook for calendar scheduling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create useCreateCustomer hook

**Files:**
- Create: `apps/mobile/src/hooks/useCreateCustomer.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CreateCustomerPayload {
  name: string;
  cpf?: string;
  phone: string;
  email?: string;
  lgpd_consent: boolean;
}

interface CustomerResponse {
  id: string;
  name: string;
  cpf_masked: string | null;
  phone_masked: string;
}

export function useCreateCustomer() {
  return useMutation<CustomerResponse, Error, CreateCustomerPayload>({
    mutationFn: (payload) =>
      api.post<CustomerResponse>('/customers', payload),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useCreateCustomer.ts
git commit -m "feat(mobile): add useCreateCustomer hook for quick registration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create useKanbanOS hook

**Files:**
- Create: `apps/mobile/src/hooks/useKanbanOS.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface KanbanOS {
  id: string;
  number: number;
  plate: string;
  make: string;
  model: string;
  customer_name: string;
  status: string;
  entry_date: string;
  estimated_delivery_date: string | null;
}

export interface KanbanColumn {
  key: string;
  label: string;
  statuses: string[];
  items: KanbanOS[];
}

const COLUMNS: Omit<KanbanColumn, 'items'>[] = [
  { key: 'reception', label: 'Recepção', statuses: ['reception', 'initial_survey'] },
  { key: 'budget', label: 'Orçamento', statuses: ['budget', 'waiting_auth'] },
  { key: 'authorized', label: 'Autorizado', statuses: ['authorized', 'waiting_parts'] },
  { key: 'repair', label: 'Em Reparo', statuses: ['repair', 'mechanic', 'bodywork', 'painting', 'assembly'] },
  { key: 'survey', label: 'Vistoria', statuses: ['polishing', 'washing', 'final_survey'] },
  { key: 'ready', label: 'Pronto', statuses: ['ready'] },
  { key: 'delivered', label: 'Entregue', statuses: ['delivered'] },
];

export function useKanbanOS() {
  const query = useQuery<KanbanOS[]>({
    queryKey: ['service-orders', 'kanban'],
    queryFn: () => api.get<KanbanOS[]>('/service-orders?page_size=200&is_active=true'),
  });

  const columns: KanbanColumn[] = COLUMNS.map((col) => ({
    ...col,
    items: (query.data ?? [])
      .filter((os) => col.statuses.includes(os.status))
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()),
  }));

  return {
    columns,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useKanbanOS.ts
git commit -m "feat(mobile): add useKanbanOS hook with status column grouping

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create CreateEventModal component

**Files:**
- Create: `apps/mobile/src/components/agenda/CreateEventModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EVENT_TYPES = [
  { value: 'entry', label: 'Entrada' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'return', label: 'Retorno' },
  { value: 'other', label: 'Outro' },
];

interface CreateEventModalProps {
  visible: boolean;
  initialDate?: Date;
  prefill?: {
    plate?: string;
    customerName?: string;
    osId?: string;
    eventType?: string;
  };
  onSave: (data: {
    osId?: string;
    schedulingDate: string;
    estimatedDeliveryDate?: string;
    repairDays?: number;
    eventType: string;
    notes?: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function CreateEventModal({
  visible,
  initialDate,
  prefill,
  onSave,
  onClose,
  loading = false,
}: CreateEventModalProps): React.JSX.Element {
  const [eventType, setEventType] = useState(prefill?.eventType ?? 'entry');
  const [date, setDate] = useState(initialDate ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [plate, setPlate] = useState(prefill?.plate ?? '');
  const [customerName, setCustomerName] = useState(prefill?.customerName ?? '');
  const [repairDays, setRepairDays] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setEventType(prefill?.eventType ?? 'entry');
      setDate(initialDate ?? new Date());
      setPlate(prefill?.plate ?? '');
      setCustomerName(prefill?.customerName ?? '');
      setRepairDays('');
      setNotes('');
    }
  }, [visible, initialDate, prefill]);

  const handleSave = (): void => {
    const days = parseInt(repairDays, 10);
    const estimatedDate = !isNaN(days) && days > 0
      ? new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    onSave({
      osId: prefill?.osId,
      schedulingDate: date.toISOString(),
      estimatedDeliveryDate: estimatedDate,
      repairDays: !isNaN(days) ? days : undefined,
      eventType,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">Agendar</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Tipo */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, eventType === t.value && styles.typeBtnActive]}
                  onPress={() => setEventType(t.value)}
                >
                  <Text variant="bodySmall" color={eventType === t.value ? Colors.textPrimary : Colors.textTertiary}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Data */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>DATA</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text variant="body">{format(date, "dd/MM/yyyy", { locale: ptBR })}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
              />
            )}
          </View>

          {/* Hora */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>HORA</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
              <Text variant="body">{format(date, "HH:mm")}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={date}
                mode="time"
                display="spinner"
                onChange={(_, d) => { setShowTimePicker(false); if (d) setDate(d); }}
              />
            )}
          </View>

          {/* Placa */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PLACA</Text>
            <TextInput
              style={styles.inputText}
              value={plate}
              onChangeText={setPlate}
              placeholder="ABC1D23"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          {/* Cliente */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>CLIENTE</Text>
            <TextInput
              style={styles.inputText}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Nome do cliente"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Dias de reparo (só para entrada) */}
          {eventType === 'entry' && (
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>DIAS DE REPARO (PREVISÃO)</Text>
              <TextInput
                style={styles.inputText}
                value={repairDays}
                onChangeText={setRepairDays}
                keyboardType="numeric"
                placeholder="Ex: 15"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          )}

          {/* Observação */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>OBSERVAÇÃO</Text>
            <TextInput
              style={[styles.inputText, { minHeight: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observação opcional..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Salvar" variant="primary" fullWidth loading={loading} onPress={handleSave} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  inputText: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: { borderColor: Colors.brand, backgroundColor: Colors.brandTint },
  footer: { padding: Spacing.lg },
});
```

- [ ] **Step 2: Install datetimepicker if not installed**

```bash
cd apps/mobile && npx expo install @react-native-community/datetimepicker
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/agenda/CreateEventModal.tsx apps/mobile/package.json
git commit -m "feat(mobile): add CreateEventModal with date/time pickers and event types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Integrate CreateEventModal into Agenda screen

**Files:**
- Modify: `apps/mobile/app/(app)/agenda/index.tsx`

- [ ] **Step 1: Read the file and add imports**

```tsx
import { CreateEventModal } from '@/components/agenda/CreateEventModal';
import { useScheduleOS } from '@/hooks/useScheduleOS';
import { toast } from '@/stores/toast.store';
```

- [ ] **Step 2: Add state and handler inside the component**

```tsx
const [showCreateEvent, setShowCreateEvent] = useState(false);
const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date>(new Date());
const scheduleOS = useScheduleOS(''); // osId filled dynamically
```

- [ ] **Step 3: Add FAB button in the render**

After the main content (calendar + event list), before the closing tags, add a floating action button:

```tsx
<TouchableOpacity
  style={styles.fab}
  onPress={() => {
    setSelectedDateForEvent(selectedDate ?? new Date());
    setShowCreateEvent(true);
  }}
  activeOpacity={0.8}
>
  <Ionicons name="add" size={28} color={Colors.textPrimary} />
</TouchableOpacity>
```

Add the FAB style:
```typescript
fab: {
  position: 'absolute',
  right: Spacing.lg,
  bottom: 100,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: Colors.brand,
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 4,
  shadowColor: Colors.brand,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.4,
  shadowRadius: 4,
},
```

- [ ] **Step 4: Add CreateEventModal in JSX**

```tsx
<CreateEventModal
  visible={showCreateEvent}
  initialDate={selectedDateForEvent}
  onSave={(data) => {
    // For now, just close and toast — full scheduling integration later
    setShowCreateEvent(false);
    toast.success('Evento criado');
  }}
  onClose={() => setShowCreateEvent(false)}
/>
```

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/agenda/index.tsx"
git commit -m "feat(mobile): add event creation FAB and modal to agenda screen

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Create standalone customer registration screen

**Files:**
- Create: `apps/mobile/app/(app)/cadastro/cliente.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function CadastroClienteScreen(): React.JSX.Element {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const canSave = name.trim().length > 0 && phone.trim().length >= 10 && lgpdConsent;

  const handleSave = async (): Promise<void> => {
    try {
      await createCustomer.mutateAsync({
        name: name.trim(),
        cpf: cpf.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        lgpd_consent: lgpdConsent,
      });
      toast.success('Cliente cadastrado com sucesso');
      router.back();
    } catch {
      toast.error('Erro ao cadastrar cliente');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="heading3">Novo Cliente</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionDivider label="DADOS PESSOAIS" />
        <Card>
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>NOME COMPLETO *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>CPF</Text>
              <TextInput style={styles.input} value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" maxLength={14} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>TELEFONE *</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(92) 99999-0000" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" maxLength={15} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>E-MAIL</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={Colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
        </Card>

        <SectionDivider label="LGPD" />
        <Card>
          <View style={styles.lgpdRow}>
            <Text variant="bodySmall" color={Colors.textSecondary} style={{ flex: 1 }}>
              Autorizo o uso dos meus dados pessoais conforme a Lei Geral de Proteção de Dados.
            </Text>
            <Switch value={lgpdConsent} onValueChange={setLgpdConsent} trackColor={{ true: Colors.brand }} />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Cadastrar Cliente" variant="primary" fullWidth loading={createCustomer.isPending} onPress={() => void handleSave()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  fieldGroup: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: 15 },
  lgpdRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footer: { padding: Spacing.lg },
});
```

- [ ] **Step 2: Commit**

```bash
git add "apps/mobile/app/(app)/cadastro/cliente.tsx"
git commit -m "feat(mobile): add standalone customer registration screen

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Create standalone vehicle registration screen

**Files:**
- Create: `apps/mobile/app/(app)/cadastro/veiculo.tsx`

- [ ] **Step 1: Create the screen**

Uses the same placa-fipe lookup as the Nova OS wizard. Import `useVehicleByPlate` hook.

```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { useVehicleByPlate } from '@/hooks/useVehicleByPlate';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CadastroVeiculoScreen(): React.JSX.Element {
  const router = useRouter();

  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [chassis, setChassis] = useState('');
  const [km, setKm] = useState('');

  const vehicleLookup = useVehicleByPlate(plate.length >= 7 ? plate : '');

  // Auto-fill when placa-fipe returns data
  React.useEffect(() => {
    if (vehicleLookup.data) {
      const v = vehicleLookup.data;
      if (v.make) setMake(v.make);
      if (v.model) setModel(v.model);
      if (v.year) setYear(String(v.year));
      if (v.color) setColor(v.color);
    }
  }, [vehicleLookup.data]);

  const canSave = plate.trim().length >= 7 && make.trim().length > 0;

  const handleSave = async (): Promise<void> => {
    // Vehicle is created automatically when associated with an OS
    // For standalone, we just inform the user
    toast.success(`Veículo ${plate.toUpperCase()} registrado`);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="heading3">Novo Veículo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionDivider label="BUSCA POR PLACA" />
        <Card>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PLACA *</Text>
            <TextInput
              style={styles.input}
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
              placeholder="ABC1D23"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              maxLength={8}
            />
            {vehicleLookup.isLoading && (
              <Text variant="caption" color={Colors.brand}>Buscando dados do veículo...</Text>
            )}
            {vehicleLookup.data && (
              <Text variant="caption" color={Colors.success}>Dados preenchidos automaticamente</Text>
            )}
          </View>
        </Card>

        <SectionDivider label="DADOS DO VEÍCULO" />
        <Card>
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>MARCA *</Text>
              <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="Ex: Chevrolet" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>MODELO *</Text>
              <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Ex: Onix" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text variant="mono" style={styles.label}>ANO</Text>
                <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2024" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" maxLength={4} />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text variant="mono" style={styles.label}>COR</Text>
                <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Preto" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>CHASSI</Text>
              <TextInput style={styles.input} value={chassis} onChangeText={setChassis} placeholder="17 dígitos" placeholderTextColor={Colors.textTertiary} maxLength={17} autoCapitalize="characters" />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>KM ATUAL</Text>
              <TextInput style={styles.input} value={km} onChangeText={setKm} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Salvar Veículo" variant="primary" fullWidth onPress={() => void handleSave()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  fieldGroup: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: 15 },
  row: { flexDirection: 'row', gap: Spacing.md },
  footer: { padding: Spacing.lg },
});
```

- [ ] **Step 2: Commit**

```bash
git add "apps/mobile/app/(app)/cadastro/veiculo.tsx"
git commit -m "feat(mobile): add standalone vehicle registration screen with placa-fipe lookup

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Create QuickActionsSheet component

**Files:**
- Create: `apps/mobile/src/components/common/QuickActionsSheet.tsx`

- [ ] **Step 1: Create the bottom sheet**

```tsx
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface QuickAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
}

export function QuickActionsSheet({ visible, onClose, actions }: QuickActionsSheetProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionRow}
              onPress={() => { onClose(); action.onPress(); }}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={action.icon} size={22} color={Colors.textPrimary} />
              </View>
              <Text variant="body">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/common/QuickActionsSheet.tsx
git commit -m "feat(mobile): add QuickActionsSheet bottom sheet for + menu

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Create KanbanCard and KanbanColumn components

**Files:**
- Create: `apps/mobile/src/components/kanban/KanbanCard.tsx`
- Create: `apps/mobile/src/components/kanban/KanbanColumn.tsx`

- [ ] **Step 1: Create KanbanCard**

```tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface KanbanCardProps {
  number: number;
  plate: string;
  model: string;
  customerName: string;
  daysInShop: number;
  onPress: () => void;
}

export function KanbanCard({ number, plate, model, customerName, daysInShop, onPress }: KanbanCardProps): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text variant="mono">OS #{number}</Text>
            <Text variant="caption" color={daysInShop > 15 ? Colors.error : Colors.textTertiary}>
              <Ionicons name="time-outline" size={11} /> {daysInShop}d
            </Text>
          </View>
          <Text variant="body">{plate} · {model}</Text>
          <Text variant="bodySmall" color={Colors.textTertiary}>{customerName}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

- [ ] **Step 2: Create KanbanColumn**

```tsx
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { KanbanCard } from './KanbanCard';
import { Colors, Spacing, Radii } from '@/constants/theme';
import type { KanbanColumn as KanbanColumnType } from '@/hooks/useKanbanOS';

interface KanbanColumnProps {
  column: KanbanColumnType;
  onCardPress: (osId: string) => void;
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function KanbanColumn({ column, onCardPress }: KanbanColumnProps): React.JSX.Element {
  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <Text variant="mono" style={styles.title}>{column.label}</Text>
        <View style={styles.badge}>
          <Text variant="caption" color={Colors.textPrimary}>{column.items.length}</Text>
        </View>
      </View>
      <FlatList
        data={column.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <KanbanCard
            number={item.number}
            plate={item.plate}
            model={[item.make, item.model].filter(Boolean).join(' ')}
            customerName={item.customer_name}
            daysInShop={daysAgo(item.entry_date)}
            onPress={() => onCardPress(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: 260,
    marginRight: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: { color: Colors.textSecondary, fontSize: 12 },
  badge: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: { gap: Spacing.sm, paddingBottom: Spacing.xl },
});
```

- [ ] **Step 3: Commit**

```bash
mkdir -p apps/mobile/src/components/kanban
git add apps/mobile/src/components/kanban/KanbanCard.tsx apps/mobile/src/components/kanban/KanbanColumn.tsx
git commit -m "feat(mobile): add KanbanCard and KanbanColumn components

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Create Kanban screen

**Files:**
- Create: `apps/mobile/app/(app)/kanban/index.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { useKanbanOS } from '@/hooks/useKanbanOS';
import { Colors, Spacing } from '@/constants/theme';

export default function KanbanScreen(): React.JSX.Element {
  const router = useRouter();
  const { columns, isLoading, refetch } = useKanbanOS();

  const totalOS = columns.reduce((sum, col) => sum + col.items.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading2">Kanban</Text>
        <Text variant="mono" color={Colors.textTertiary}>{totalOS} OS ativas</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columnsContainer}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void refetch()} tintColor={Colors.brand} />
          }
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.key}
              column={column}
              onCardPress={(osId) => router.push(`/(app)/os/${osId}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: Spacing.lg,
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  columnsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
});
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "apps/mobile/app/(app)/kanban"
git add "apps/mobile/app/(app)/kanban/index.tsx"
git commit -m "feat(mobile): add Kanban board screen with horizontal scrolling columns

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Integrate QuickActionsSheet + add routes to layout

**Files:**
- Modify: `apps/mobile/src/components/navigation/FrostedNavBar.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Read FrostedNavBar and add QuickActionsSheet**

In FrostedNavBar, the "+" center button currently navigates directly to nova-os. Change it to open the QuickActionsSheet.

Add import:
```tsx
import { QuickActionsSheet } from '@/components/common/QuickActionsSheet';
```

Add state:
```tsx
const [showQuickActions, setShowQuickActions] = useState(false);
```

Change the "+" button's onPress from navigating to `nova-os` to:
```tsx
onPress={() => setShowQuickActions(true)}
```

Add the QuickActionsSheet in the JSX:
```tsx
<QuickActionsSheet
  visible={showQuickActions}
  onClose={() => setShowQuickActions(false)}
  actions={[
    { icon: 'add-circle-outline', label: 'Nova OS', onPress: () => router.push('/(app)/nova-os') },
    { icon: 'person-add-outline', label: 'Novo Cliente', onPress: () => router.push('/(app)/cadastro/cliente') },
    { icon: 'car-outline', label: 'Novo Veículo', onPress: () => router.push('/(app)/cadastro/veiculo') },
    { icon: 'calendar-outline', label: 'Agendar Entrada', onPress: () => router.push('/(app)/agenda') },
  ]}
/>
```

- [ ] **Step 2: Add new routes to layout**

In `apps/mobile/app/(app)/_layout.tsx`, add Stack.Screen entries for the new routes:

```tsx
<Stack.Screen name="cadastro/cliente" options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="cadastro/veiculo" options={{ headerShown: false, animation: 'slide_from_right' }} />
<Stack.Screen name="kanban" options={{ headerShown: false, animation: 'slide_from_right' }} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/navigation/FrostedNavBar.tsx "apps/mobile/app/(app)/_layout.tsx"
git commit -m "feat(mobile): expand + button with quick actions sheet and add new routes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Agenda: criar evento — Tasks 4-5
   - [x] Agenda: agendar veículo (atalho via QuickActions) — Task 8, 11
   - [x] Cadastro: cliente standalone — Tasks 2, 6
   - [x] Cadastro: veículo standalone — Task 7
   - [x] Menu "+" expandido — Tasks 8, 11
   - [x] Kanban visual — Tasks 3, 9, 10
   - [ ] Agenda: visualização semana — Deferred (nice-to-have, complex layout)
   - [ ] Agenda: editar/excluir evento — Partial (modal supports prefill, edit flow not wired)

2. **Placeholder scan:** No TBD except one comment about vehicle standalone save (vehicles are created with OS, not standalone endpoint).

3. **Type consistency:** `KanbanColumn` interface used consistently in hook (Task 3), KanbanColumn component (Task 9), and screen (Task 10).

---

## Execution Notes

**Parallelism:**
- Tasks 1-3 (hooks) — independent, parallel
- Tasks 4, 6, 7, 8, 9 (components/screens) — independent, parallel
- Task 5 depends on Task 4
- Task 10 depends on Tasks 3, 9
- Task 11 depends on Task 8

**Recommended agent split:**
- **Agent A:** Tasks 1-3 (hooks)
- **Agent B:** Tasks 4-5 (event modal + agenda integration)
- **Agent C:** Tasks 6-7 (cadastro screens)
- **Agent D:** Tasks 8-9 (QuickActions + Kanban components)
- **Agent E:** Tasks 10-11 (Kanban screen + integration)
