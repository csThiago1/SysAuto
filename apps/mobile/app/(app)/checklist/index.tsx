import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from '@/components/os/OSStatusBadge';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { usePhotoStore } from '@/stores/photo.store';
import type { ServiceOrder } from '@/db/models/ServiceOrder';

// ─── Constants ────────────────────────────────────────────────────────────────

type ChecklistStatus = 'reception' | 'initial_survey' | 'final_survey';

const CHECKLIST_STATUSES: readonly ChecklistStatus[] = [
  'reception',
  'initial_survey',
  'final_survey',
] as const;

const CHECKLIST_TYPE_LABEL: Record<ChecklistStatus, string> = {
  reception: 'Checklist de Entrada',
  initial_survey: 'Vistoria Inicial',
  final_survey: 'Vistoria Final',
};

function isChecklistStatus(status: string): status is ChecklistStatus {
  return (CHECKLIST_STATUSES as readonly string[]).includes(status);
}

// ─── ChecklistCard ────────────────────────────────────────────────────────────

interface ChecklistCardProps {
  order: ServiceOrder;
  onPress: (order: ServiceOrder) => void;
}

function ChecklistCard({ order, onPress }: ChecklistCardProps): React.JSX.Element {
  const photoCount = usePhotoStore(
    (state) => state.queue.filter((item) => item.osId === order.remoteId).length,
  );

  const checklistLabel = isChecklistStatus(order.status)
    ? CHECKLIST_TYPE_LABEL[order.status]
    : order.status;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(order)}
      accessibilityRole="button"
      accessibilityLabel={`OS ${order.number}, placa ${order.vehiclePlate}`}
    >
      <Card style={styles.card}>
        {/* Row 1: plate + status badge */}
        <View style={styles.row}>
          <Text variant="heading3" style={styles.plate}>
            {order.vehiclePlate}
          </Text>
          <OSStatusBadge status={order.status} />
        </View>

        {/* Row 2: OS number + make + model */}
        <View style={styles.row}>
          <Text variant="label" color="#374151">
            {`OS #${order.number}`}
          </Text>
          <Text variant="bodySmall" color="#6b7280" style={styles.vehicleInfo}>
            {[order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ')}
          </Text>
        </View>

        {/* Row 3: checklist type label */}
        <Text variant="bodySmall" color="#e31b1b" style={styles.checklistType}>
          {checklistLabel}
        </Text>

        {/* Row 4: photo count */}
        <Text variant="caption" color="#9ca3af">
          {photoCount === 0
            ? 'Nenhuma foto capturada'
            : `${photoCount} ${photoCount === 1 ? 'foto capturada' : 'fotos capturadas'}`}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Text variant="body" color="#374151" style={styles.emptyTitle}>
        Nenhuma OS aguardando checklist
      </Text>
      <Text variant="bodySmall" color="#9ca3af" style={styles.emptyHint}>
        OS em recepção, vistoria inicial ou vistoria final aparecem aqui.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChecklistIndexScreen(): React.JSX.Element {
  const router = useRouter();

  const { orders, isLoading, isRefreshing, refetch } = useServiceOrdersList({});

  const checklistOrders = useMemo(
    () => orders.filter((o) => isChecklistStatus(o.status)),
    [orders],
  );

  function handleCardPress(order: ServiceOrder): void {
    router.push(`/(app)/checklist/${order.remoteId}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading2">Checklists</Text>
        {!isLoading && (
          <View style={styles.countBadge}>
            <Text variant="label" color="#ffffff">
              {checklistOrders.length}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e31b1b" />
        </View>
      ) : (
        <FlatList<ServiceOrder>
          data={checklistOrders}
          keyExtractor={(item) => item.remoteId}
          renderItem={({ item }) => (
            <ChecklistCard order={item} onPress={handleCardPress} />
          )}
          contentContainerStyle={
            checklistOrders.length === 0
              ? styles.flatListEmpty
              : styles.flatListContent
          }
          ListEmptyComponent={<EmptyState />}
          onRefresh={refetch}
          refreshing={isRefreshing}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  countBadge: {
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatListContent: {
    padding: 16,
    gap: 12,
  },
  flatListEmpty: {
    flex: 1,
    padding: 16,
  },
  card: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  plate: {
    letterSpacing: 1,
    flexShrink: 1,
  },
  vehicleInfo: {
    flexShrink: 1,
    textAlign: 'right',
  },
  checklistType: {
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
