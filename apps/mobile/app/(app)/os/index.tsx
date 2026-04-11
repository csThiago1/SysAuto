import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function OSListScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text variant="heading3" style={styles.title}>
            Lista de OS
          </Text>
          <Text variant="body" color="#6b7280" style={styles.subtitle}>
            Disponivel no Sprint M2
          </Text>
          <Text variant="bodySmall" color="#9ca3af" style={styles.hint}>
            Aqui serao listadas as Ordens de Servico com filtros, busca e acesso rapido ao Kanban.
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
    paddingBottom: 120, // espaco para a PillTabBar flutuante
  },
  card: {
    gap: 8,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 8,
  },
  hint: {
    lineHeight: 18,
  },
});
