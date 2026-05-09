import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';

interface TechnicianHeroProps {
  osCount: number;
  toFinish: number;
  nextPlate?: string;
  nextStage?: string;
  onPressNext?: () => void;
}

export function TechnicianHero({
  osCount,
  toFinish,
  nextPlate,
  nextStage,
  onPressNext,
}: TechnicianHeroProps): React.JSX.Element {
  return (
    <LinearGradient
      colors={[Colors.brand, Colors.brandShade]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.title}>Minha jornada · hoje</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{osCount}</Text>
          <Text style={styles.statLabel}>OS atribuídas</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{toFinish}</Text>
          <Text style={styles.statLabel}>concluir hoje</Text>
        </View>
      </View>

      {nextPlate ? (
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={onPressNext}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Próxima OS: ${nextPlate}`}
        >
          <Text style={styles.nextText}>
            Próxima: {nextPlate} · {nextStage}
          </Text>
          <Text style={styles.nextArrow}>→</Text>
        </TouchableOpacity>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.xl,
    padding: Spacing.lg + 2,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  statCol: {
    gap: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 36,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  nextBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  nextArrow: {
    fontSize: 14,
    color: '#ffffff',
  },
});
