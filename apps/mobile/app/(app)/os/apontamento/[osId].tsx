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
