import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { useKanbanOS } from '@/hooks/useKanbanOS';
import { Colors, Spacing } from '@/constants/theme';

export default function KanbanScreen(): React.JSX.Element {
  const router = useRouter();
  const { columns, isLoading, refetch } = useKanbanOS();

  const totalOS = columns.reduce((sum, col) => sum + col.items.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading2">Kanban</Text>
        <Text variant="mono" color={Colors.textTertiary}>{totalOS} OS ativas</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columnsContainer}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void refetch()} tintColor={Colors.brand} />
          }
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.key}
              column={column}
              onCardPress={(osId) => router.push(`/(app)/os/${osId}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: Spacing.lg,
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  columnsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
});
