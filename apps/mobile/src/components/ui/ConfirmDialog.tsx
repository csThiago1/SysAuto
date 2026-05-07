import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Colors, Radii, Spacing } from '@/constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Fechar diálogo"
      >
        <View
          style={styles.card}
          onStartShouldSetResponder={() => true}
          accessibilityRole="alert"
        >
          <Text variant="heading3" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" style={styles.message}>
            {message}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text variant="body" style={styles.cancelText}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <Button
              label={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
              style={styles.confirmButton}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelText: {
    color: Colors.textSecondary,
  },
  confirmButton: {
    minWidth: 120,
  },
});
