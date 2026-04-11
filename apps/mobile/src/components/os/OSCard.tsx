import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { OSStatusBadge } from './OSStatusBadge';

interface OSCardProps {
  order: ServiceOrder;
}

function getDaysOpen(createdAtMs: number): number {
  const now = Date.now();
  const diffMs = now - createdAtMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const OSCard = React.memo(function OSCard({ order }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const handlePress = useCallback((): void => {
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

  const daysOpen = getDaysOpen(order.createdAtRemote);
  const totalParts = order.totalParts ?? 0;
  const totalServices = order.totalServices ?? 0;
  const total = totalParts + totalServices;

  const vehicleLine = [order.vehicleBrand, order.vehicleModel]
    .filter(Boolean)
    .join(' / ');

  const plateLine = order.vehiclePlate
    ? order.vehiclePlate.toUpperCase()
    : '—';

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75}>
      <Card style={styles.card}>
        {/* Linha 1: numero OS + badge de status */}
        <View style={styles.row}>
          <Text variant="label" style={styles.osNumber}>
            OS #{order.number}
          </Text>
          <OSStatusBadge status={order.status} />
        </View>

        {/* Linha 2: placa · marca/modelo */}
        <View style={styles.row}>
          <Text variant="bodySmall" color="#1a1a1a" style={styles.plate}>
            {plateLine}
          </Text>
          {vehicleLine.length > 0 && (
            <>
              <View style={styles.dot} />
              <Text variant="bodySmall" color="#6b7280" style={styles.vehicle} numberOfLines={1}>
                {vehicleLine}
              </Text>
            </>
          )}
        </View>

        {/* Linha 3: cliente */}
        <Text variant="bodySmall" color="#374151" numberOfLines={1}>
          {order.customerName}
        </Text>

        {/* Linha 4: dias aberto + total */}
        <View style={styles.footer}>
          <Text variant="caption" color="#9ca3af">
            {daysOpen === 0 ? 'Aberta hoje' : `${daysOpen} ${daysOpen === 1 ? 'dia' : 'dias'} aberta`}
          </Text>
          <Text variant="caption" color="#6b7280" style={styles.total}>
            {formatCurrency(total)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  osNumber: {
    color: '#111827',
    flex: 0,
  },
  plate: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#d1d5db',
  },
  vehicle: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  total: {
    fontWeight: '600',
  },
});
