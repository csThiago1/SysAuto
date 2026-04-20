import React from 'react';
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
import { Colors, Radii, Spacing } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECKLIST_TYPE_LABEL: Record<string, string> = {
  reception:      'Checklist de Entrada',
  initial_survey: 'Vistoria Inicial',
  final_survey:   'Vistoria Final',
  waiting_parts:  'Aguardando Peça',
  budget:         'Orçamento',
  delivered:      'Entregue',
};

// ─── ChecklistCard ────────────────────────────────────────────────────────────

interface ChecklistCardProps {
  order: ServiceOrder;
  onPress: (order: ServiceOrder) => void;
}

function ChecklistCard({ order, onPress }: ChecklistCardProps): React.JSX.Element {
  const photoCount = usePhotoStore(
    (state) => state.queue.filter((item) => item.osId === order.remoteId).length,
  );

  const checklistLabel = CHECKLIST_TYPE_LABEL[order.status] ?? order.status;

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
          <Text variant="label" color={Colors.textPrimary}>
            {`OS #${order.number}`}
          </Text>
          <Text variant="bodySmall" color={Colors.textTertiary} style={styles.vehicleInfo}>
            {[order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ')}
          </Text>
        </View>

        {/* Row 3: checklist type label */}
        <Text variant="bodySmall" color={Colors.brand} style={styles.checklistType}>
          {checklistLabel}
        </Text>

        {/* Row 4: photo count */}
        <Text variant="caption" color={Colors.textSecondary}>
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
      <Text variant="body" color={Colors.textPrimary} style={styles.emptyTitle}>
        Nenhuma OS aguardando checklist
      </Text>
      <Text variant="bodySmall" color={Colors.textSecondary} style={styles.emptyHint}>
        Nenhuma OS encontrada. Sincronize para carregar as ordens de serviço.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChecklistIndexScreen(): React.JSX.Element {
  const router = useRouter();

  const { orders, isLoading, isRefreshing, refetch } = useServiceOrdersList({});

  const checklistOrders = orders;

  function handleCardPress(order: ServiceOrder): void {
    router.push(`/(app)/checklist/${order.remoteId}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading2">Checklists</Text>
        {!isLoading && (
          <View style={styles.countBadge}>
            <Text variant="label" color={Colors.textPrimary}>
              {checklistOrders.length}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand} />
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
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  countBadge: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.md,
    minWidth: 24,
    height: 24,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatListContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  flatListEmpty: {
    flex: 1,
    padding: Spacing.lg,
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
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
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
