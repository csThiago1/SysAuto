/**
 * OverrideApprovalSheet
 *
 * Bottom sheet para que o MANAGER+ aprove ou rejeite uma solicitação de
 * liberação de transição pendente. Exibe detalhes da OS, bloqueios ativos
 * e campo de justificativa obrigatório.
 *
 * O campo `osId` deve ser o UUID da OS (não o número), pois é o identificador
 * usado pela API. O componente pai (ex.: tela de overrides pendentes) é
 * responsável por resolver o UUID a partir da lista retornada pelo backend.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import { useResolveOverride } from '@/hooks/useTransitionValidation';
import type { TransitionOverrideRequest } from '@paddock/types';

// ─── Status labels (PT-BR) ────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  reception:      'Recepção',
  initial_survey: 'Vistoria Inicial',
  budget:         'Orçamento',
  waiting_auth:   'Ag. Autorização',
  authorized:     'Autorizada',
  waiting_parts:  'Ag. Peças',
  repair:         'Reparo',
  mechanic:       'Mecânica',
  bodywork:       'Funilaria',
  painting:       'Pintura',
  assembly:       'Montagem',
  polishing:      'Polimento',
  washing:        'Lavagem',
  final_survey:   'Vistoria Final',
  ready:          'Pronto',
  delivered:      'Entregue',
  cancelled:      'Cancelada',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  /** UUID da OS (não o número inteiro). Necessário para o endpoint de resolve. */
  osId: string;
  override: TransitionOverrideRequest | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverrideApprovalSheet({
  visible,
  onClose,
  osId,
  override,
}: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const [justification, setJustification] = useState('');

  const resolveMutation = useResolveOverride(osId);

  if (!override) return null;

  const fromLabel = STATUS_LABELS[override.from_status] ?? override.from_status;
  const toLabel   = STATUS_LABELS[override.to_status]   ?? override.to_status;

  const handleResolve = async (action: 'approved' | 'rejected'): Promise<void> => {
    if (!justification.trim()) return;
    try {
      await resolveMutation.mutateAsync({
        overrideId: override.id,
        payload: { action, justification: justification.trim() },
      });
      setJustification('');
      onClose();
    } catch {
      // Handled by the hook's onError
    }
  };

  const handleClose = (): void => {
    setJustification('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Tap-to-dismiss */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Sheet */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={styles.handleWrapper}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <Text variant="label" color={Colors.textPrimary} style={styles.sheetTitle}>
              Solicitacao de Liberacao
            </Text>
            <Text variant="caption" color={Colors.textTertiary} style={styles.sheetSubtitle}>
              OS #{override.os_number} · {override.os_plate?.toUpperCase()} · {override.os_customer_name}
            </Text>

            {/* ── Transition ────────────────────────────────────────────── */}
            <View style={[styles.infoCard, { backgroundColor: Colors.surfaceLight }]}>
              <Text variant="caption" color={Colors.textTertiary} style={styles.infoCardLabel}>
                Transicao solicitada
              </Text>
              <Text variant="body" color={Colors.textPrimary}>
                {fromLabel} → {toLabel}
              </Text>
            </View>

            {/* ── Requester + reason ─────────────────────────────────────── */}
            <View style={[styles.infoCard, { backgroundColor: Colors.surfaceLight }]}>
              <Text variant="caption" color={Colors.textTertiary} style={styles.infoCardLabel}>
                Solicitado por: {override.requested_by_name}
              </Text>
              <Text variant="bodySmall" color={Colors.textPrimary}>
                {override.request_reason}
              </Text>
            </View>

            {/* ── Blocks snapshot ────────────────────────────────────────── */}
            {override.blocks_snapshot.length > 0 && (
              <>
                <Text variant="label" style={[styles.blocksHeader, { color: SemanticColors.warning.color }]}>
                  Bloqueios:
                </Text>
                {override.blocks_snapshot.map((b, idx) => (
                  <View key={idx} style={styles.blockRow}>
                    <Ionicons
                      name="lock-closed"
                      size={14}
                      color={SemanticColors.warning.color}
                    />
                    <Text variant="bodySmall" style={{ color: SemanticColors.warning.color, flex: 1 }}>
                      {b.message}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* ── Justification ──────────────────────────────────────────── */}
            <Text variant="label" color={Colors.textPrimary} style={styles.fieldLabel}>
              Justificativa *
            </Text>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Motivo da aprovacao/rejeicao..."
              placeholderTextColor={Colors.textTertiary}
              value={justification}
              onChangeText={setJustification}
              textAlignVertical="top"
            />

            {/* ── Actions ────────────────────────────────────────────────── */}
            <View style={styles.actionRow}>
              <View style={styles.actionFlex}>
                <Button
                  label="Rejeitar"
                  onPress={() => { void handleResolve('rejected'); }}
                  variant="danger"
                  loading={resolveMutation.isPending}
                  disabled={!justification.trim()}
                />
              </View>
              <View style={styles.actionFlex}>
                <Button
                  label="Aprovar"
                  onPress={() => { void handleResolve('approved'); }}
                  loading={resolveMutation.isPending}
                  disabled={!justification.trim()}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
  },
  handleWrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  scrollArea: {
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  sheetTitle: {
    marginBottom: 4,
  },
  sheetSubtitle: {
    marginBottom: Spacing.md,
  },

  // Info cards
  infoCard: {
    borderRadius: Radii.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  infoCardLabel: {
    marginBottom: 2,
  },

  // Blocks
  blocksHeader: {
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },

  // Inputs
  fieldLabel: {
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 70,
    marginBottom: Spacing.md,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
});
