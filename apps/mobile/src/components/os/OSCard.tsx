import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';
import type { InsurerOption } from '@/hooks/useInsurers';
import { OS_STATUS_MAP, Colors, Radii, Shadow, Spacing, type OSStatus } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/MonoLabel';

// Logos de montadoras via CDN público (fallback quando make_logo está vazio)
const MAKE_LOGO_MAP: Record<string, string> = {
  chevrolet: 'https://logo.clearbit.com/chevrolet.com',
  fiat: 'https://logo.clearbit.com/fiat.com',
  ford: 'https://logo.clearbit.com/ford.com',
  honda: 'https://logo.clearbit.com/honda.com.br',
  hyundai: 'https://logo.clearbit.com/hyundai.com.br',
  toyota: 'https://logo.clearbit.com/toyota.com.br',
  volkswagen: 'https://logo.clearbit.com/vw.com.br',
  renault: 'https://logo.clearbit.com/renault.com.br',
  nissan: 'https://logo.clearbit.com/nissan.com.br',
  jeep: 'https://logo.clearbit.com/jeep.com.br',
  bmw: 'https://logo.clearbit.com/bmw.com.br',
  'mercedes-benz': 'https://logo.clearbit.com/mercedes-benz.com.br',
  audi: 'https://logo.clearbit.com/audi.com.br',
  kia: 'https://logo.clearbit.com/kia.com.br',
  peugeot: 'https://logo.clearbit.com/peugeot.com.br',
  mitsubishi: 'https://logo.clearbit.com/mitsubishi-motors.com.br',
  volvo: 'https://logo.clearbit.com/volvocars.com',
  byd: 'https://logo.clearbit.com/byd.com',
};

function getMakeLogo(make: string): string {
  if (!make) return '';
  return MAKE_LOGO_MAP[make.toLowerCase()] ?? '';
}

interface OSCardProps {
  order: ServiceOrder;
  insurer?: InsurerOption;
}

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
  const borderColor = OS_STATUS_MAP[order.status as OSStatus]?.color ?? '#94a3b8';
  const statusLabel = OS_STATUS_MAP[order.status as OSStatus]?.label ?? order.status;
  const cardAccessibilityLabel = `OS ${order.number}, ${vehicleLine}, ${statusLabel}`;
  const makeLogoUrl = getMakeLogo(order.vehicleBrand ?? '');

  const isSvgLogo = insurer?.logoUrl?.endsWith('.svg') ?? false;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={styles.touchable}
        accessibilityRole="button"
        accessibilityLabel={cardAccessibilityLabel}
      >
        <LinearGradient
        colors={[Colors.cardTop, Colors.cardBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.card, { borderLeftColor: borderColor }]}
      >
        {/* Glass glint */}
        <View style={styles.topGlint} />

        <View style={styles.bodyRow}>
          {/* Left: plate, vehicle, status */}
          <View style={styles.leftCol}>
            <View style={styles.plateBadge}>
              <Text style={styles.plate}>{plateLine}</Text>
            </View>
            {vehicleLine.length > 0 && (
              <View style={styles.vehicleRow}>
                {makeLogoUrl.length > 0 && (
                  <Image
                    source={{ uri: makeLogoUrl }}
                    style={styles.makeLogo}
                    resizeMode="contain"
                  />
                )}
                <Text variant="bodySmall" color={Colors.textPrimary} numberOfLines={1} style={styles.vehicleText}>
                  {vehicleLine}
                </Text>
              </View>
            )}
            <View style={styles.badgeRow}>
              <OSStatusBadge status={order.status} />
            </View>
          </View>

          {/* Right: OS number + insurer logo */}
          <View style={styles.rightCol}>
            <MonoLabel variant="accent" size="sm">
              {`OS #${order.number}`}
            </MonoLabel>
            {insurer != null && insurer.logoUrl ? (
              <View style={styles.insurerLogoCircle}>
                {isSvgLogo ? (
                  <SvgUri uri={insurer.logoUrl} width={38} height={38} />
                ) : (
                  <Image
                    source={{ uri: insurer.logoUrl }}
                    style={styles.insurerLogo}
                    resizeMode="contain"
                  />
                )}
              </View>
            ) : insurer != null ? (
              <View style={[styles.insurerAvatar, { backgroundColor: insurer.brandColor + '22', borderColor: insurer.brandColor + '66' }]}>
                <Text variant="caption" style={[styles.insurerAbbr, { color: insurer.brandColor }]}>
                  {insurer.abbreviation || insurer.displayName.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        </LinearGradient>
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
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  plate: {
    fontWeight: '800',
    letterSpacing: 3,
    fontSize: 18,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleText: {
    flex: 1,
  },
  makeLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  insurerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderGlintSide,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  insurerLogoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    ...Shadow.sm,
  },
  insurerLogo: {
    width: 38,
    height: 38,
  },
  insurerAbbr: {
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
