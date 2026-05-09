import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { getStatusLabel, getStatusColor, getStatusBackgroundColor } from '@/components/os/OSStatusBadge';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus } from '@paddock/types';

// ─── StatusUpdateModal ─────────────────────────────────────────────────────

export interface StatusUpdateModalProps {
  visible: boolean;
  currentStatus: ServiceOrderStatus;
  onSelect: (status: ServiceOrderStatus) => void;
  onClose: () => void;
  isUpdating: boolean;
}

export function StatusUpdateModal({
  visible,
  currentStatus,
  onSelect,
  onClose,
  isUpdating,
}: StatusUpdateModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const nextStatuses = VALID_TRANSITIONS[currentStatus] ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text variant="label" color={Colors.textPrimary}>
            Avançar Status
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.modalSubtitle}>
          Status atual: <Text variant="bodySmall" color={Colors.textPrimary}>{getStatusLabel(currentStatus)}</Text>
        </Text>
        {nextStatuses.length === 0 ? (
          <Text variant="bodySmall" color={Colors.textSecondary} style={styles.modalEmpty}>
            Nenhuma transição disponível para este status.
          </Text>
        ) : (
          nextStatuses.map((s) => {
            const color = getStatusColor(s);
            const bg = getStatusBackgroundColor(s);
            return (
              <TouchableOpacity
                key={s}
                activeOpacity={0.75}
                disabled={isUpdating}
                onPress={() => onSelect(s)}
                style={[styles.statusRow, { backgroundColor: bg }]}
              >
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text variant="body" style={[styles.statusRowLabel, { color }]}>
                  {getStatusLabel(s)}
                </Text>
                {isUpdating ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Ionicons name="arrow-forward" size={16} color={color} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayLight,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalClose: {
    padding: 4,
  },
  modalSubtitle: {
    marginBottom: 12,
  },
  modalEmpty: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
