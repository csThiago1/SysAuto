import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function ChecklistIndexScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text variant="heading3">Checklists</Text>
          <Text variant="body" color="#6b7280">
            Disponivel no Sprint M2
          </Text>
          <Text variant="bodySmall" color="#9ca3af" style={styles.hint}>
            Lista de checklists pendentes para vistoria de entrada e saida de veiculos.
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
  },
  card: {
    gap: 8,
  },
  hint: {
    lineHeight: 18,
  },
});
