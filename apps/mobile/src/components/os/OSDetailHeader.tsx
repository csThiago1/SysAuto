import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';
import { Colors, Radii, Spacing } from '@/constants/theme';

export interface OSDetailHeaderProps {
  number: number;
  status: string;
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  onBack: () => void;
}

export function OSDetailHeader({
  number,
  status,
  plate,
  make,
  model,
  year,
  color,
  onBack,
}: OSDetailHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const vehicleLine = [make, model, year ? String(year) : undefined, color]
    .filter(Boolean)
    .join(' · ');

  return (
    <LinearGradient
      colors={[Colors.bgHeader, Colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}
    >
      {/* Glass glint — linha de luz no topo */}
      <View style={styles.topGlint} />

      {/* Back + OS number + status badge */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="label" color={Colors.textSecondary} style={styles.osNumber}>
          OS #{number}
        </Text>
        <OSStatusBadge status={status} />
      </View>

      {/* Placa em destaque */}
      <View style={styles.plateBadge}>
        <Text style={styles.plate}>{plate.toUpperCase()}</Text>
      </View>

      {/* Veículo */}
      {vehicleLine.length > 0 && (
        <Text variant="bodySmall" color={Colors.textSecondary} numberOfLines={1}>
          {vehicleLine}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  topGlint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.borderGlintTop,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  backBtn: {
    marginLeft: -Spacing.xs,
    padding: Spacing.xs,
  },
  osNumber: {
    flex: 1,
  },
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  plate: {
    fontWeight: '800',
    letterSpacing: 3,
    fontSize: 22,
    color: Colors.textPrimary,
  },
});
