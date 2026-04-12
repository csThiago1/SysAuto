import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';

interface OSCardProps {
  order: ServiceOrder;
}

// Status → left border color (spec §2.5)
const STATUS_BORDER_COLOR: Record<string, string> = {
  reception:        '#3b82f6',
  initial_survey:   '#3b82f6',
  final_survey:     '#3b82f6',
  budget:           '#f59e0b',
  waiting_approval: '#f59e0b',
  waiting_parts:    '#f59e0b',
  approved:         '#22c55e',
  in_progress:      '#22c55e',
  ready:            '#10b981',
  delivered:        '#94a3b8',
  cancelled:        '#ef4444',
};

function getLeftBorderColor(status: string): string {
  return STATUS_BORDER_COLOR[status] ?? '#94a3b8';
}

function getDaysOpen(createdAtMs: number): string {
  const diffMs = Date.now() - createdAtMs;
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'hoje';
  return `${days}d`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const OSCard = React.memo(function OSCard({ order }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const handlePress = useCallback((): void => {
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

  const total = (order.totalParts ?? 0) + (order.totalServices ?? 0);
  const plateLine = order.vehiclePlate ? order.vehiclePlate.toUpperCase() : '—';
  const vehicleLine = [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ');
  const timeAgo = getDaysOpen(order.createdAtRemote);
  const borderColor = getLeftBorderColor(order.status);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={styles.touchable}
    >
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        {/* Row 1: OS number + time ago */}
        <View style={styles.row}>
          <Text variant="label" style={styles.osNumber}>
            OS #{order.number}
          </Text>
          <Text variant="caption" color="#9ca3af">
            {timeAgo}
          </Text>
        </View>

        {/* Row 2: plate (monospace letterSpacing) */}
        <Text variant="bodySmall" style={styles.plate}>
          {plateLine}
        </Text>

        {/* Row 3: customer · vehicle */}
        <Text variant="bodySmall" color="#6b7280" numberOfLines={1}>
          {order.customerName}
          {vehicleLine.length > 0 ? ` · ${vehicleLine}` : ''}
        </Text>

        {/* Row 4: status badge + total */}
        <View style={styles.footer}>
          <OSStatusBadge status={order.status} />
          <Text variant="caption" style={styles.total}>
            {formatCurrency(total)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8', // overridden inline by status
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  osNumber: {
    color: '#111827',
  },
  plate: {
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#1a1a1a',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  total: {
    fontWeight: '600',
    color: '#374151',
  },
});
