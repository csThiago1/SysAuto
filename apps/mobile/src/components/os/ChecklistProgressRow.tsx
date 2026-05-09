import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Spacing, SemanticColors } from '@/constants/theme';

// ─── ChecklistProgressRow ──────────────────────────────────────────────────

export interface ChecklistProgressRowProps {
  photoCount: number;
  ok: number;
  attention: number;
  critical: number;
}

export function ChecklistProgressRow({ photoCount, ok, attention, critical }: ChecklistProgressRowProps): React.JSX.Element {
  const hasAny = photoCount > 0 || ok > 0 || attention > 0 || critical > 0;
  if (!hasAny) return <View style={styles.progressRowEmpty} />;

  return (
    <View style={styles.progressRow}>
      {photoCount > 0 && (
        <View style={styles.progressChip}>
          <Ionicons name="camera-outline" size={12} color={Colors.textTertiary} />
          <Text variant="caption" color={Colors.textTertiary}>{photoCount} foto{photoCount !== 1 ? 's' : ''}</Text>
        </View>
      )}
      {ok > 0 && (
        <View style={[styles.progressChip, styles.progressChipOk]}>
          <Ionicons name="checkmark-circle" size={12} color={SemanticColors.success.color} />
          <Text variant="caption" style={{ color: SemanticColors.success.color }}>{ok} OK</Text>
        </View>
      )}
      {attention > 0 && (
        <View style={[styles.progressChip, styles.progressChipAttention]}>
          <Ionicons name="warning" size={12} color={Colors.warning} />
          <Text variant="caption" style={{ color: Colors.warning }}>{attention} Atenção</Text>
        </View>
      )}
      {critical > 0 && (
        <View style={[styles.progressChip, styles.progressChipCritical]}>
          <Ionicons name="alert-circle" size={12} color={SemanticColors.error.color} />
          <Text variant="caption" style={{ color: SemanticColors.error.color }}>{critical} Crítico</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  progressRowEmpty: {
    height: 8,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 20,
  },
  progressChipOk: {
    backgroundColor: SemanticColors.success.bg,
  },
  progressChipAttention: {
    backgroundColor: SemanticColors.warning.bg,
  },
  progressChipCritical: {
    backgroundColor: SemanticColors.error.bg,
  },
});
