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

        {/* Two-column layout: info left, OS number + insurer right */}
        <View style={styles.bodyRow}>
          {/* Left: plate, customer·vehicle, status */}
          <View style={styles.leftCol}>
            <Text variant="bodySmall" style={styles.plate}>
              {plateLine}
            </Text>
            <Text variant="bodySmall" color={Colors.textSecondary} numberOfLines={1}>
              {order.customerName}
              {vehicleLine.length > 0 ? ` · ${vehicleLine}` : ''}
            </Text>
            <View style={styles.badgeRow}>
              <OSStatusBadge status={order.status} />
            </View>
          </View>

          {/* Right: OS number on top, insurer avatar below */}
          <View style={styles.rightCol}>
            <Text variant="label" style={styles.osNumber}>
              OS #{order.number}
            </Text>
            {insurer != null && (
              insurer.logoUrl ? (
                <View style={styles.insurerAvatar}>
                  <Image
                    source={{ uri: insurer.logoUrl }}
                    style={styles.insurerLogo}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={[styles.insurerAvatar, { backgroundColor: insurer.brandColor + '22', borderColor: insurer.brandColor + '66' }]}>
                  <Text variant="caption" style={[styles.insurerAbbr, { color: insurer.brandColor }]}>
                    {insurer.abbreviation}
                  </Text>
                </View>
              )
            )}
          </View>
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
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  leftCol: {
    flex: 1,
    gap: 6,
  },
  rightCol: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badgeRow: {
    marginTop: 2,
  },
  osNumber: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  plate: {
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textPrimary,
  },
  insurerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderGlintSide,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insurerLogo: {
    width: 64,
    height: 64,
  },
  insurerAbbr: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
