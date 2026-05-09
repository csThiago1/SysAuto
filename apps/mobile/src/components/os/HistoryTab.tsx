import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { TransitionLogItem } from './TransitionLogItem';
import type { OSTransitionLog } from './os-detail-utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HistoryTabProps {
  logs: OSTransitionLog[] | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HistoryTab({ logs }: HistoryTabProps): React.JSX.Element {
  const hasHistory = logs != null && logs.length > 0;

  return (
    <>
      {hasHistory ? (
        <Card style={styles.card}>
          {logs.map((log) => (
            <TransitionLogItem key={log.id} log={log} />
          ))}
        </Card>
      ) : (
        <View style={styles.tabEmpty}>
          <Ionicons name="time-outline" size={40} color={Colors.skeleton} />
          <Text variant="bodySmall" color={Colors.textSecondary}>
            Nenhuma transição registrada
          </Text>
        </View>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  tabEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
});
