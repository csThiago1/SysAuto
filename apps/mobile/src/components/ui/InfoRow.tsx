import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Typography, Colors, Spacing } from '@/constants/theme';

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  noDivider?: boolean;
  style?: ViewStyle;
}

export function InfoRow({
  label,
  value,
  icon,
  noDivider = false,
  style,
}: InfoRowProps): React.JSX.Element {
  return (
    <View style={[styles.container, !noDivider && styles.divider, style]}>
      <View style={styles.labelRow}>
        {icon != null && (
          <Ionicons name={icon} size={14} color={Colors.textTertiary} style={styles.icon} />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textTertiary,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
