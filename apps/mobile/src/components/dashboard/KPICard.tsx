import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Colors, SemanticColors, Spacing, type SemanticVariant } from '@/constants/theme';

type KPIVariant = 'neutral' | 'success' | 'error' | 'warning' | 'accent';

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  variant?: KPIVariant;
}

function getValueColor(variant: KPIVariant): string {
  if (variant === 'accent') return Colors.brand;
  if (variant === 'neutral') return Colors.textPrimary;
  return SemanticColors[variant as SemanticVariant].color;
}

export function KPICard({
  label,
  value,
  hint,
  variant = 'neutral',
}: KPICardProps): React.JSX.Element {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: getValueColor(variant) }]}>
        {value}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
    textAlign: 'center',
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
});
