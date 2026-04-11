import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function OSDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text variant="heading3">Detalhe da OS</Text>
          <Text variant="bodySmall" color="#6b7280">
            ID: {id}
          </Text>
          <Text variant="body" color="#9ca3af" style={styles.hint}>
            Implementacao completa no Sprint M2 — incluindo checklist, fotos, status Kanban e
            historico de movimentacoes.
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
    lineHeight: 20,
  },
});
