import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { Card } from '@/components/ui/Card';
import { Colors, OS_STATUS_MAP, Spacing, type OSStatus } from '@/constants/theme';

interface PipelineDistributionProps {
  counts: Record<string, number>;
}

export function PipelineDistribution({ counts }: PipelineDistributionProps): React.JSX.Element {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Pipeline</Text>
      <Text style={styles.subtitle}>distribuição atual</Text>
      <View style={styles.list}>
        {entries.map(([status, count]) => {
          const meta = OS_STATUS_MAP[status as OSStatus];
          const color = meta?.color ?? Colors.textSecondary;
          const label = meta?.label ?? status;
          const pct = (count / total) * 100;

          return (
            <View key={status} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.label} numberOfLines={1}>{label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
                />
              </View>
              <MonoLabel size="sm">{String(count)}</MonoLabel>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    width: 90,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});
