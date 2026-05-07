import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Colors, Spacing } from '@/constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  subtitle,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={Colors.textTertiary} />
      <Text variant="body" style={styles.title}>{title}</Text>
      {subtitle != null && subtitle.length > 0 && (
        <Text variant="bodySmall" style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
