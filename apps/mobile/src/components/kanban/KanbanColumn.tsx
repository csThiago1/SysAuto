import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { KanbanCard } from './KanbanCard';
import { Colors, Spacing, Radii } from '@/constants/theme';
import type { KanbanColumn as KanbanColumnType } from '@/hooks/useKanbanOS';

interface KanbanColumnProps {
  column: KanbanColumnType;
  onCardPress: (osId: string) => void;
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function KanbanColumn({ column, onCardPress }: KanbanColumnProps): React.JSX.Element {
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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <KanbanCard
            number={item.number}
            plate={item.plate}
            model={[item.make, item.model].filter(Boolean).join(' ')}
            customerName={item.customer_name}
            daysInShop={daysAgo(item.entry_date)}
            onPress={() => onCardPress(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

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
