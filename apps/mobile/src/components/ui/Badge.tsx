import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Colors, SemanticColors, OS_STATUS_MAP } from '@/constants/theme';

interface BadgeProps {
  status: string;
}

function getStatusStyle(status: string): { backgroundColor: string; color: string; label: string } {
  const mapped = OS_STATUS_MAP[status as keyof typeof OS_STATUS_MAP];
  if (mapped) {
    return { backgroundColor: mapped.bg, color: mapped.color, label: mapped.label };
  }
  return {
    backgroundColor: SemanticColors.neutral.bg,
    color: SemanticColors.neutral.color,
    label: status,
  };
}

export function Badge({ status }: BadgeProps) {
  const config = getStatusStyle(status);

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text variant="caption" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
