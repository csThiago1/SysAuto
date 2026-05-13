import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { KanbanCard } from './KanbanCard';
import { Colors, Spacing, Radii } from '@/constants/theme';
import type { KanbanColumn as KanbanColumnType } from '@/hooks/useKanbanOS';

type KanbanOS = KanbanColumnType['items'][number];

interface KanbanColumnProps {
  column: KanbanColumnType;
  onCardPress: (osId: string) => void;
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const KanbanColumn = React.memo(function KanbanColumn({ column, onCardPress }: KanbanColumnProps): React.JSX.Element {
  const renderItem = useCallback(({ item }: { item: KanbanOS }) => (
    <KanbanCard
      number={item.number}
      plate={item.plate}
      model={[item.make, item.model].filter(Boolean).join(' ')}
      customerName={item.customer_name}
      daysInShop={daysAgo(item.entry_date)}
      hasTransitionBlocks={item.has_transition_blocks ?? false}
      onPress={() => onCardPress(item.id)}
    />
  ), [onCardPress]);

  const keyExtractor = useCallback((item: KanbanOS) => item.id, []);

  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <Text variant="mono" style={styles.title}>{column.label}</Text>
        <View style={styles.badge}>
          <Text variant="caption" color={Colors.textPrimary}>{column.items.length}</Text>
        </View>
      </View>
      <FlatList
        data={column.items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
})

const styles = StyleSheet.create({
  column: {
    width: 260,
    marginRight: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: { color: Colors.textSecondary, fontSize: 12 },
  badge: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: { gap: Spacing.sm, paddingBottom: Spacing.xl },
});
