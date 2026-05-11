import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { PipelineBar } from './PipelineBar';
import type { InsurerOption } from '@/hooks/useInsurers';
import { OS_STATUS_MAP, Colors, Radii, Shadow, Spacing, type OSStatus } from '@/constants/theme';
import { timeAgo } from '@/lib/timeAgo';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OSCardProps {
  order: ServiceOrder;
  insurer?: InsurerOption;
}

// ─── Component ──────────────────────────────────────────────────────────────

function OSCardComponent({ order, insurer }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePress = useCallback((): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

  const plateLine = order.vehiclePlate ? order.vehiclePlate.toUpperCase() : '—';
  const vehicleLine = [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ');
  const statusColor = OS_STATUS_MAP[order.status as OSStatus]?.color ?? '#94a3b8';
  const statusLabel = OS_STATUS_MAP[order.status as OSStatus]?.label ?? order.status;
  const ownerName = insurer?.displayName ?? order.customerName;
  const relativeTime = timeAgo(order.createdAtRemote);
  const cardAccessibilityLabel = `OS ${order.number}, ${vehicleLine}, ${statusLabel}`;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={styles.touchable}
        accessibilityRole="button"
        accessibilityLabel={cardAccessibilityLabel}
      >
        <View style={styles.card}>
          {/* ── Top row: icon + info + time ──────────────────────────────── */}
          <View style={styles.topRow}>
            {/* Colored vehicle icon */}
            <View style={[styles.vehicleIcon, { backgroundColor: statusColor + '22' }]}>
              <Ionicons name="car-outline" size={24} color={statusColor} />
            </View>

            {/* Info column */}
            <View style={styles.infoCol}>
              {/* Plate + OS number */}
              <View style={styles.plateRow}>
                <Text style={styles.plate}>{plateLine}</Text>
                <Text style={styles.osNumber}>#{order.number}</Text>
              </View>
              {/* Vehicle */}
              {vehicleLine.length > 0 && (
                <Text style={styles.vehicle} numberOfLines={1}>{vehicleLine}</Text>
              )}
              {/* Customer / insurer name */}
              <Text style={styles.owner} numberOfLines={1}>{ownerName}</Text>
            </View>

            {/* Relative time */}
            <Text style={styles.time}>{relativeTime}</Text>
          </View>

          {/* ── Bottom row: status badge + pipeline bar ──────────────────── */}
          <View style={styles.bottomRow}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <View style={styles.pipelineWrapper}>
              <PipelineBar status={order.status} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
    prev.order.makeLogo === next.order.makeLogo &&
    prev.order.createdAtRemote === next.order.createdAtRemote &&
    prev.insurer?.id === next.insurer?.id,
);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
    borderRadius: Radii.lg,
    ...Shadow.card,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopColor: Colors.borderGlintTop,
    padding: 14,
    gap: 12,
  },

  // ── Top row ───────────────────────────────────────────────────────────────
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  plate: {
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 15,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  osNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  vehicle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  owner: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // ── Bottom row ────────────────────────────────────────────────────────────
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pipelineWrapper: {
    flex: 1,
  },
});
