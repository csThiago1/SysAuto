import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useConnectivity } from '@/hooks/useConnectivity';

export function OfflineBanner() {
  const isOnline = useConnectivity();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? insets.top : 8 }]}>
      <Text variant="label" style={styles.text}>
        Sem conexão — modo offline
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#ef4444',
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
  },
});
