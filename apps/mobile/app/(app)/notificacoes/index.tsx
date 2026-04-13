import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function NotificacoesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text variant="heading2" style={styles.pageTitle}>
          Notificacoes
        </Text>
        <Card style={styles.card}>
          <Text variant="body" color={Colors.textTertiary}>
            Disponivel no Sprint M3
          </Text>
          <Text variant="bodySmall" color={Colors.textSecondary} style={styles.hint}>
            Alertas de OS prontas, mudancas de status, aprovacoes pendentes e mensagens do sistema.
            Push notifications via APNs e FCM.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.lg,
  },
  pageTitle: {
    paddingTop: Spacing.sm,
  },
  card: {
    gap: Spacing.sm,
  },
  hint: {
    lineHeight: 18,
  },
});
