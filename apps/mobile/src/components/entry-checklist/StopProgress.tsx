import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { STOPS, type StopKey } from '@paddock/car-3d/core';
import { Text } from '@/components/ui/Text';
import { Colors, Spacing } from '@/constants/theme';
import type { StopValue } from '@/stores/entry-checklist.store';

// roxo da marca do carro 3D (BRAND_PURPLE de packages/car-3d/src/Car3D.tsx)
const CURRENT = '#ac27ce';

interface Props {
  /** Índice em STOPS; STOPS.length = revisão e envio. */
  current: number;
  stops: Partial<Record<StopKey, StopValue>>;
  onSelect: (index: number) => void;
}

export function StopProgress({ current, stops, onSelect }: Props): React.ReactElement {
  const stop = STOPS[current];
  return (
    <View style={styles.container}>
      <View style={styles.segments}>
        {STOPS.map((s, i) => {
          const color = i === current ? CURRENT : stops[s.key] ? Colors.success : Colors.border;
          return (
            <TouchableOpacity
              key={s.key}
              style={styles.hit}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityLabel={`Ir para a parada ${i + 1}: ${s.label}`}
            >
              <View style={[styles.segment, { backgroundColor: color }]} />
            </TouchableOpacity>
          );
        })}
      </View>
      <Text variant="caption" color={Colors.textSecondary} style={styles.counter}>
        {stop ? `PARADA ${current + 1} DE ${STOPS.length}` : 'REVISÃO'}
      </Text>
      <Text variant="heading3">{stop ? stop.label : 'Enviar para conferência'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 4 },
  segments: { flexDirection: 'row', gap: 4, marginBottom: Spacing.sm },
  hit: { flex: 1, paddingVertical: 8 },
  segment: { height: 6, borderRadius: 3 },
  counter: { letterSpacing: 1, fontWeight: '700' },
});
