import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface KanbanCardProps {
  number: number;
  plate: string;
  model: string;
  customerName: string;
  daysInShop: number;
  onPress: () => void;
}

export function KanbanCard({ number, plate, model, customerName, daysInShop, onPress }: KanbanCardProps): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text variant="mono">OS #{number}</Text>
            <Text variant="caption" color={daysInShop > 15 ? Colors.error : Colors.textTertiary}>
              <Ionicons name="time-outline" size={11} /> {daysInShop}d
            </Text>
          </View>
          <Text variant="body">{plate} · {model}</Text>
          <Text variant="bodySmall" color={Colors.textTertiary}>{customerName}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
