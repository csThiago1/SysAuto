import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import type { ValidationBlock } from '@paddock/types';

interface ResolutionItemProps {
  block: ValidationBlock;
  type: 'hard' | 'soft' | 'warn';
  resolved: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}

export function ResolutionItem({
  block,
  type,
  resolved,
  onAction,
  actionLabel,
  actionIcon,
}: ResolutionItemProps): React.JSX.Element {
  const iconName = resolved
    ? 'checkmark-circle'
    : type === 'soft'
      ? 'lock-closed'
      : type === 'warn'
        ? 'alert-circle'
        : 'ellipse-outline';

  const iconColor = resolved
    ? SemanticColors.success.color
    : type === 'hard'
      ? SemanticColors.error.color
      : type === 'soft'
        ? SemanticColors.warning.color
        : Colors.textTertiary;

  return (
    <View style={[styles.row, resolved && styles.rowResolved]}>
      <Ionicons name={iconName} size={20} color={iconColor} />
      <Text
        variant="bodySmall"
        style={[styles.message, resolved && styles.messageResolved]}
        numberOfLines={2}
      >
        {block.message}
        {type === 'warn' && !resolved && (
          <Text style={styles.optional}> (opcional)</Text>
        )}
      </Text>
      {!resolved && onAction && actionLabel && (
        <TouchableOpacity style={styles.actionChip} onPress={onAction} activeOpacity={0.7}>
          {actionIcon && <Ionicons name={actionIcon} size={14} color={Colors.brand} />}
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={Colors.brand} />
        </TouchableOpacity>
      )}
      {resolved && (
        <Ionicons name="checkmark" size={16} color={SemanticColors.success.color} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    backgroundColor: 'transparent',
  },
  rowResolved: {
    backgroundColor: 'rgba(52,211,153,0.06)',
  },
  message: {
    flex: 1,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  messageResolved: {
    color: Colors.textSecondary,
  },
  optional: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand,
  },
});
