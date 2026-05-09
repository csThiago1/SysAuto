import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';

interface OverdueItem {
  id: string;
  number: number;
  plate: string;
  days_overdue: number;
  status: string;
  status_display?: string;
}

interface OverdueOSListProps {
  items: OverdueItem[];
  onPress: (id: string) => void;
}

export function OverdueOSList({ items, onPress }: OverdueOSListProps): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="alert-circle" size={16} color={Colors.error} />
        <Text style={styles.title}>OS Atrasadas</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={() => onPress(item.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`OS ${item.number}, ${item.days_overdue} dias atrasada`}
        >
          <View style={styles.leftCol}>
            <MonoLabel variant="accent" size="sm">
              {`OS #${item.number}`}
            </MonoLabel>
            <Text style={styles.plate}>{item.plate}</Text>
          </View>
          <View style={styles.rightCol}>
            <Text style={styles.overdue}>{item.days_overdue}d</Text>
            <Text style={styles.statusLabel}>
              {item.status_display ?? item.status}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.error,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 8,
  },
  leftCol: {
    flex: 1,
    gap: 2,
  },
  plate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  overdue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
  statusLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
});
