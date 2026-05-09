import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/stores/auth.store';
import {
  useDashboardStats,
  isManager,
  isConsultant,
  isTechnician,
  type ManagerStats,
  type ConsultantStats,
  type TechnicianStats,
} from '@/hooks/useDashboardStats';
import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { MonoLabel } from '@/components/ui/MonoLabel';
import {
  DashboardHeader,
  KPIHeroCard,
  KPICard,
  PipelineDistribution,
  OverdueOSList,
  OperationalHero,
  TechnicianHero,
} from '@/components/dashboard';

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0';
  if (num >= 1000) return `R$ ${(num / 1000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${num.toFixed(0)}`;
}

function formatMonth(): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[new Date().getMonth()] ?? '';
}

// ─── Manager View ────────────────────────────────────────────────────────────

function ManagerDashboard({ stats }: { stats: ManagerStats }): React.JSX.Element {
  const router = useRouter();
  const series = stats.billing_last_6_months.map((m) => ({
    month: m.month,
    value: parseFloat(m.amount),
  }));

  return (
    <>
      <KPIHeroCard
        title={`Faturamento · ${formatMonth()}`}
        value={`R$ ${parseFloat(stats.billing_month).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
        series={series}
      />

      <View style={styles.kpiRow}>
        <KPICard
          label="Ticket méd"
          value={formatCurrency(stats.avg_ticket)}
        />
        <KPICard
          label="Entregues"
          value={String(stats.delivered_month)}
          variant="success"
        />
        <KPICard
          label="Atrasadas"
          value={String(stats.overdue_count)}
          variant={stats.overdue_count > 0 ? 'error' : 'neutral'}
        />
      </View>

      <OperationalHero
        title="Operacional · Hoje"
        stats={[
          { value: stats.total_open, label: 'OS abertas' },
          { value: stats.overdue_count, label: 'atrasadas', color: stats.overdue_count > 0 ? Colors.error : undefined },
          { value: stats.scheduled_today, label: 'agendadas' },
        ]}
      />

      {Object.keys(stats.by_status).length > 0 && (
        <PipelineDistribution counts={stats.by_status} />
      )}

      <OverdueOSList
        items={stats.overdue_os}
        onPress={(id) => router.push(`/(app)/os/${id}`)}
      />

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => router.push('/(app)/nova-os')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Nova OS"
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.brand} />
          <Text style={styles.quickLabel}>Nova OS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => router.push('/(app)/agenda')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Agendar"
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.brand} />
          <Text style={styles.quickLabel}>Agendar</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Consultant View ─────────────────────────────────────────────────────────

function ConsultantDashboard({ stats }: { stats: ConsultantStats }): React.JSX.Element {
  const router = useRouter();

  return (
    <>
      <OperationalHero
        title="Operacional · Hoje"
        stats={[
          { value: stats.my_deliveries_today, label: 'entregas hoje' },
          { value: stats.my_overdue, label: 'atrasados', color: stats.my_overdue > 0 ? Colors.error : undefined },
          { value: stats.my_scheduled_today, label: 'agendadas' },
        ]}
      />

      <View style={styles.kpiRow}>
        <KPICard label="OS abertas" value={String(stats.my_open)} />
        <KPICard
          label="Aguard. Autoriz."
          value={String(stats.my_waiting_auth)}
          variant={stats.my_waiting_auth > 0 ? 'warning' : 'neutral'}
        />
        <KPICard
          label="Aguard. Peças"
          value={String(stats.my_waiting_parts)}
          variant={stats.my_waiting_parts > 0 ? 'warning' : 'neutral'}
        />
      </View>

      {Object.keys(stats.my_by_status).length > 0 && (
        <PipelineDistribution counts={stats.my_by_status} />
      )}

      {stats.my_next_deliveries.length > 0 && (
        <Card style={styles.deliveriesCard}>
          <Text style={styles.sectionTitle}>Próximas Entregas</Text>
          {stats.my_next_deliveries.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={styles.deliveryRow}
              onPress={() => router.push(`/(app)/os/${d.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`OS ${d.number}`}
            >
              <View style={styles.deliveryLeft}>
                <MonoLabel size="sm">{d.estimated_delivery_date}</MonoLabel>
              </View>
              <View style={styles.deliveryRight}>
                <Text style={styles.deliveryPlate}>{d.plate}</Text>
                <Text style={styles.deliveryCustomer} numberOfLines={1}>{d.customer_name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </>
  );
}

// ─── Technician View ─────────────────────────────────────────────────────────

function TechnicianDashboard({ stats }: { stats: TechnicianStats }): React.JSX.Element {
  const router = useRouter();

  return (
    <>
      <TechnicianHero
        osCount={stats.my_open}
        toFinish={stats.my_deliveries_today}
        nextPlate={stats.my_next_os?.plate}
        nextStage={stats.my_next_os?.status_display}
        onPressNext={
          stats.my_os[0]
            ? () => router.push(`/(app)/os/${stats.my_os[0].id}`)
            : undefined
        }
      />

      <View style={styles.kpiRow}>
        <KPICard
          label="Concluídas mês"
          value={String(stats.my_completed_month)}
          variant="success"
        />
        <KPICard
          label="Tempo médio"
          value={`${stats.my_avg_days}d`}
        />
      </View>

      {stats.my_os.length > 0 && (
        <Card style={styles.queueCard}>
          <Text style={styles.sectionTitle}>Minha Fila</Text>
          {stats.my_os.map((os, i) => (
            <TouchableOpacity
              key={os.id}
              style={styles.queueRow}
              onPress={() => router.push(`/(app)/os/${os.id}`)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`OS ${os.number}`}
            >
              <View style={[styles.queueNumber, i === 0 && styles.queueNumberActive]}>
                <Text style={[styles.queueNumberText, i === 0 && styles.queueNumberTextActive]}>
                  {i + 1}
                </Text>
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queuePlate}>{os.plate}</Text>
                <Text style={styles.queueVehicle} numberOfLines={1}>{os.vehicle}</Text>
              </View>
              <Text style={styles.queueStatus}>{os.status_display}</Text>
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const userName = useAuthStore((s) => s.user?.name ?? 'Usuário');
  const { data: stats, isLoading, refetch, isFetching } = useDashboardStats();

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand} />
      </View>
    );
  }

  const roleSubtitle = stats
    ? stats.role === 'consultant' ? 'Consultor(a)'
    : stats.role === 'technician' ? 'Técnico(a)'
    : undefined
    : undefined;

  return (
    <View style={styles.safe}>
      <DashboardHeader userName={userName} subtitle={roleSubtitle} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            tintColor={Colors.brand}
            colors={[Colors.brand]}
          />
        }
      >
        {stats && isManager(stats) && <ManagerDashboard stats={stats} />}
        {stats && isConsultant(stats) && <ConsultantDashboard stats={stats} />}
        {stats && isTechnician(stats) && <TechnicianDashboard stats={stats} />}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // KPI row
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // Quick actions (gerente)
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brandTint,
    borderWidth: 1,
    borderColor: Colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand,
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.md,
  },

  // Deliveries (consultor)
  deliveriesCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 10,
  },
  deliveryLeft: {
    width: 80,
  },
  deliveryRight: {
    flex: 1,
    gap: 2,
  },
  deliveryPlate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  deliveryCustomer: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Queue (técnico)
  queueCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.md,
  },
  queueNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueNumberActive: {
    backgroundColor: Colors.brand,
  },
  queueNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  queueNumberTextActive: {
    color: '#ffffff',
  },
  queueInfo: {
    flex: 1,
    gap: 2,
  },
  queuePlate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  queueVehicle: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  queueStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand,
  },
});
