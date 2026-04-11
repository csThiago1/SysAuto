import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function BuscaScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text variant="heading2" style={styles.pageTitle}>
          Busca
        </Text>
        <Card style={styles.card}>
          <Text variant="body" color="#6b7280">
            Disponivel no Sprint M2
          </Text>
          <Text variant="bodySmall" color="#9ca3af" style={styles.hint}>
            Busca global por OS, cliente, veiculo ou placa.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  pageTitle: {
    paddingTop: 8,
  },
  card: {
    gap: 8,
  },
  hint: {
    lineHeight: 18,
  },
});
