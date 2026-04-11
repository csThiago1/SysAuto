import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

export default function ChecklistDetailScreen() {
  const { osId } = useLocalSearchParams<{ osId: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text variant="heading3">Checklist</Text>
          <Text variant="bodySmall" color="#6b7280">
            OS: {osId}
          </Text>
          <Text variant="body" color="#9ca3af" style={styles.hint}>
            Implementacao completa no Sprint M2 — incluindo vistoria com fotos, marca dagua e
            assinatura digital.
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
