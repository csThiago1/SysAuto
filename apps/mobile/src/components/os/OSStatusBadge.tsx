import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { OS_STATUS_MAP, Colors, type OSStatus } from '@/constants/theme';

interface OSStatusBadgeProps {
  status: string;
}

export function OSStatusBadge({ status }: OSStatusBadgeProps): React.JSX.Element {
  const config = OS_STATUS_MAP[status as OSStatus];
  if (!config) {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.bg }]}>
        <Text variant="caption" style={[styles.label, { color: Colors.textPrimary }]}>
          Desconhecido
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text variant="caption" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

/** Get the primary color for a status (used by filter chips). */
export function getStatusColor(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.color ?? Colors.textPrimary;
}

/** Get the background color for a status (used by selected chips). */
export function getStatusBackgroundColor(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.bg ?? Colors.bg;
}

/** Get the translated label for a status. */
export function getStatusLabel(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.label ?? 'Desconhecido';
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
