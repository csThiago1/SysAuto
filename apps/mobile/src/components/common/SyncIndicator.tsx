import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSync } from '@/hooks/useSync';

function formatLastSync(lastSyncAt: number): string {
  const diffMs = Date.now() - lastSyncAt;
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return 'Sincronizado agora';
  if (diffMin === 1) return 'Sync ha 1 min';
  if (diffMin < 60) return `Sync ha ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH === 1) return 'Sync ha 1 h';
  return `Sync ha ${diffH} h`;
}

export function SyncIndicator(): React.JSX.Element {
  const { isSyncing, lastSyncAt, isOnline } = useSync();

  if (!isOnline) {
    return (
      <View style={styles.container}>
        <View style={[styles.dot, styles.dotOffline]} />
        <Text variant="caption" color="#ef4444">
          Offline
        </Text>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#e31b1b" style={styles.spinner} />
        <Text variant="caption" color="#e31b1b">
          Sincronizando...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.dot, styles.dotOnline]} />
      <Text variant="caption" color="#6b7280">
        {lastSyncAt != null ? formatLastSync(lastSyncAt) : 'Online'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: {
    backgroundColor: '#22c55e',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  spinner: {
    width: 14,
    height: 14,
  },
});
