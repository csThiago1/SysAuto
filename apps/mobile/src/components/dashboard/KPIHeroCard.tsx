import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';

interface KPIHeroCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  series?: { month: string; value: number }[];
}

export function KPIHeroCard({
  title,
  value,
  delta,
  deltaPositive = true,
  series,
}: KPIHeroCardProps): React.JSX.Element {
  const maxValue = series ? Math.max(...series.map((s) => s.value), 1) : 1;

  return (
    <LinearGradient
      colors={[Colors.brand, Colors.brandShade]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {delta ? (
          <View style={[styles.deltaBadge, !deltaPositive && styles.deltaNeg]}>
            <Text style={styles.deltaText}>
              {deltaPositive ? '↑' : '↓'} {delta}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.value}>{value}</Text>

      {series && series.length > 0 ? (
        <View style={styles.chartRow}>
          {series.map((item, i) => (
            <View key={i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(4, (item.value / maxValue) * 40) },
                ]}
              />
            </View>
          ))}
        </View>
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
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  deltaBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  deltaNeg: {
    backgroundColor: 'rgba(255,80,80,0.3)',
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 38,
    marginBottom: Spacing.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 44,
    marginTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 2,
  },
});
