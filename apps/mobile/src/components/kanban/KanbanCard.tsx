import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, SemanticColors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface KanbanCardProps {
  number: number;
  plate: string;
  model: string;
  customerName: string;
  daysInShop: number;
  /** Indica que a OS tem hard ou soft blocks para o próximo status (campo leve da listagem). */
  hasTransitionBlocks?: boolean;
  onPress: () => void;
}

export function KanbanCard({
  number,
  plate,
  model,
  customerName,
  daysInShop,
  hasTransitionBlocks = false,
  onPress,
}: KanbanCardProps): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text variant="mono">OS #{number}</Text>
            <View style={styles.headerRight}>
              <Text variant="caption" color={daysInShop > 15 ? Colors.error : Colors.textTertiary}>
                <Ionicons name="time-outline" size={11} /> {daysInShop}d
              </Text>
              {hasTransitionBlocks && (
                <View style={styles.blockDot} />
              )}
            </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.warning.color,
  },
});
