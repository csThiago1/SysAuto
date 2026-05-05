import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { SemanticColors, Spacing } from '@/constants/theme';
import { useConnectivity } from '@/hooks/useConnectivity';

export function OfflineBanner(): React.JSX.Element | null {
  const isOnline = useConnectivity();
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={SemanticColors.warning.color} />
      <Text style={styles.text}>Sem conexão — dados podem estar desatualizados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    backgroundColor: SemanticColors.warning.bg,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.warning.border,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
    color: SemanticColors.warning.color,
  },
});
