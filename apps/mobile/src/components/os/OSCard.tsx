import React, { useCallback } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';
import type { InsurerOption } from '@/hooks/useInsurers';
import { Colors, Radii, Shadow, Spacing } from '@/constants/theme';

interface OSCardProps {
  order: ServiceOrder;
  insurer?: InsurerOption;
}

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

function OSCardComponent({ order, insurer }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const handlePress = useCallback((): void => {
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

  const plateLine = order.vehiclePlate ? order.vehiclePlate.toUpperCase() : '—';
  const vehicleLine = [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ');
  const borderColor = getLeftBorderColor(order.status);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={styles.touchable}
    >
      <LinearGradient
        colors={[Colors.cardTop, Colors.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.card, { borderLeftColor: borderColor }]}
      >
        {/* Glass glint — linha de luz no topo */}
        <View style={styles.topGlint} />

        {/* Row 1: OS number */}
        <View style={styles.row}>
          <Text variant="label" style={styles.osNumber}>
            OS #{order.number}
          </Text>
        </View>

        {/* Row 2: plate */}
        <Text variant="bodySmall" style={styles.plate}>
          {plateLine}
        </Text>

        {/* Row 3: customer · vehicle */}
        <Text variant="bodySmall" color={Colors.textSecondary} numberOfLines={1}>
          {order.customerName}
          {vehicleLine.length > 0 ? ` · ${vehicleLine}` : ''}
        </Text>

        {/* Row 4: status badge + insurer */}
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
              <View style={[styles.insurerBadge, { borderColor: insurer.brandColor + '66' }]}>
                <View style={[styles.insurerDot, { backgroundColor: insurer.brandColor }]} />
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
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
    borderRadius: Radii.lg,
    ...Shadow.card,
  },
  card: {
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.textSecondary,
    // Borda glass: topo claro, laterais e base mais escuras
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: Colors.borderGlintTop,
    borderRightColor: Colors.borderGlintSide,
    borderBottomColor: Colors.borderGlintBottom,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    gap: 6,
    overflow: 'hidden',
  },
  // Linha de luz que simula o reflexo do vidro
  topGlint: {
    position: 'absolute',
    top: 0,
    left: Spacing.lg,
    right: 0,
    height: 1,
    backgroundColor: Colors.borderGlintTop,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  osNumber: {
    color: Colors.textPrimary,
  },
  plate: {
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textPrimary,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    backgroundColor: Colors.surfaceLight,
  },
  insurerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  insurerAbbr: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 11,
  },
});
