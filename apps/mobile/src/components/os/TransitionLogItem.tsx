import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/theme';
import { getStatusLabel } from '@/components/os/OSStatusBadge';
import { formatDateTime } from '@/components/os/os-detail-utils';
import type { OSTransitionLog } from '@/components/os/os-detail-utils';

// ─── TransitionLogItem ─────────────────────────────────────────────────────

export interface TransitionLogItemProps {
  log: OSTransitionLog;
}

export function TransitionLogItem({ log }: TransitionLogItemProps): React.JSX.Element {
  const fromLabel = getStatusLabel(log.from_status);
  const toLabel = getStatusLabel(log.to_status);

  return (
    <View style={styles.logItem}>
      <View style={styles.logDot} />
      <View style={styles.logContent}>
        <Text variant="bodySmall" color={Colors.textSecondary}>
          {fromLabel} → {toLabel}
        </Text>
        <Text variant="caption" color={Colors.textSecondary}>
          {formatDateTime(log.created_at)}
          {log.changed_by_name != null && log.changed_by_name.length > 0
            ? ` · ${log.changed_by_name}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  logItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand,
    marginTop: 6,
  },
  logContent: {
    flex: 1,
    gap: 2,
  },
});
