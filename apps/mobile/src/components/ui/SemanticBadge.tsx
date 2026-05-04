import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { SemanticColors, Radii, type SemanticVariant } from '@/constants/theme';

interface SemanticBadgeProps {
  variant: SemanticVariant;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SemanticBadge({ variant, label, icon }: SemanticBadgeProps): React.JSX.Element {
  const colors = SemanticColors[variant];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
    >
      {icon != null && (
        <Ionicons name={icon} size={12} color={colors.color} />
      )}
      <Text style={[styles.label, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
