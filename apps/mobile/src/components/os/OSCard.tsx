import React, { useCallback } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';
import type { InsurerOption } from '@/hooks/useInsurers';

interface OSCardProps {
  order: ServiceOrder;
  insurer?: InsurerOption;
}

// Status → left border color (spec §2.5)
const STATUS_BORDER_COLOR: Record<string, string> = {
  reception:      '#3b82f6',
  initial_survey: '#6d28d9',
  budget:         '#f59e0b',
  waiting_auth:   '#ea580c',
  authorized:     '#059669',
  waiting_parts:  '#64748b',
  repair:         '#0e7490',
  mechanic:       '#0369a1',
  bodywork:       '#d97706',
  painting:       '#7c3aed',
  assembly:       '#d97706',
  polishing:      '#0e7490',
  washing:        '#0891b2',
  final_survey:   '#6d28d9',
  ready:          '#16a34a',
  delivered:      '#94a3b8',
  cancelled:      '#ef4444',
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

function OSCardComponent({ order, insurer }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const handlePress = useCallback((): void => {
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

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
      <LinearGradient
        colors={['#2c2c2e', '#1c1c1e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderLeftColor: borderColor }]}
      >
        {/* Row 1: OS number + time ago */}
        <View style={styles.row}>
          <Text variant="label" style={styles.osNumber}>
            OS #{order.number}
          </Text>
          <Text variant="caption" color="#9ca3af">
            {timeAgo}
          </Text>
        </View>

        {/* Row 2: plate */}
        <Text variant="bodySmall" style={styles.plate}>
          {plateLine}
        </Text>

        {/* Row 3: customer · vehicle */}
        <Text variant="bodySmall" color="#9ca3af" numberOfLines={1}>
          {order.customerName}
          {vehicleLine.length > 0 ? ` · ${vehicleLine}` : ''}
        </Text>

        {/* Row 4: status badge + insurer logo/sigla */}
        <View style={styles.footer}>
          <OSStatusBadge status={order.status} />
          {insurer != null && (
            insurer.logoUrl ? (
              <Image
                source={{ uri: insurer.logoUrl }}
                style={styles.insurerLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.insurerBadge, { backgroundColor: insurer.brandColor }]}>
                <Text variant="caption" style={styles.insurerAbbr}>
                  {insurer.abbreviation}
                </Text>
              </View>
            )
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Comparador explícito: re-renderiza quando status, totais ou seguradora mudarem.
export const OSCard = React.memo(
  OSCardComponent,
  (prev, next) =>
    prev.order.id === next.order.id &&
    prev.order.status === next.order.status &&
    prev.order.totalParts === next.order.totalParts &&
    prev.order.totalServices === next.order.totalServices &&
    prev.order.insurerId === next.order.insurerId &&
    prev.insurer?.id === next.insurer?.id,
);

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  osNumber: {
    color: '#ffffff',
  },
  plate: {
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  insurerLogo: {
    width: 56,
    height: 24,
  },
  insurerBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  insurerAbbr: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
});
