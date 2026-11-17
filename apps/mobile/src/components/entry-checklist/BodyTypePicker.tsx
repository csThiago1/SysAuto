import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BodyType } from '@paddock/car-3d/core';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';

const OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'hatch', label: 'Hatch' },
  { value: 'sedan', label: 'Sedã' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Picape' },
  { value: 'van', label: 'Van' },
];

export function BodyTypePicker({ onPick }: { onPick: (bodyType: BodyType) => void }): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text variant="heading3">Qual a carroceria?</Text>
      <Text variant="bodySmall" color={Colors.textSecondary}>
        Escolhe o carro 3D das paradas. Fica gravada para os próximos carros desta família.
      </Text>
      {OPTIONS.map((o) => (
        <TouchableOpacity key={o.value} style={styles.option} onPress={() => onPick(o.value)} activeOpacity={0.8}>
          <Ionicons name="car-sport-outline" size={28} color={Colors.textPrimary} />
          <Text variant="heading3">{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 72,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
