/**
 * TransitionRequirementsSheet
 *
 * Bottom sheet que exibe os pré-requisitos de negócio para avançar o status
 * de uma OS. Suporta 3 modos:
 *   overview  — lista de hard/soft blocks + warnings + botões de ação
 *   override  — campo de motivo + escolha de canal (presencial/remoto)
 *   manager   — formulário de credenciais para override presencial
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { toast } from '@/stores/toast.store';
import {
  useTransitionWithValidation,
  useRequestOverride,
} from '@/hooks/useTransitionValidation';
import type {
  ServiceOrder,
  ServiceOrderStatus,
  TransitionValidationResult,
  ValidationBlock,
} from '@paddock/types';

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

type SheetMode = 'overview' | 'override' | 'manager';

// ─── ValidationItem ───────────────────────────────────────────────────────────

interface ValidationItemProps {
  block: ValidationBlock;
  type: 'hard' | 'soft' | 'warn';
}

function ValidationItem({ block, type }: ValidationItemProps): React.JSX.Element {
  const config = {
    hard: { icon: 'close-circle'  as const, color: SemanticColors.error.color },
    soft: { icon: 'lock-closed'   as const, color: SemanticColors.warning.color },
    warn: { icon: 'alert-circle'  as const, color: Colors.textTertiary },
  };
  const { icon, color } = config[type];

  return (
    <View style={styles.validationRow}>
      <Ionicons name={icon} size={16} color={color} style={styles.validationIcon} />
      <Text variant="bodySmall" style={[styles.validationText, { color }]}>
        {block.message}
        {type === 'warn' && (
          <Text variant="caption" style={styles.optionalLabel}> (opcional)</Text>
        )}
      </Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  order: ServiceOrder;
  targetStatus: ServiceOrderStatus;
  validation: TransitionValidationResult | undefined;
  /** Called after a successful transition. No-arg signature kept for simplicity. */
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransitionRequirementsSheet({
  visible,
  onClose,
  order,
  targetStatus,
  validation,
  onSuccess,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SheetMode>('overview');
  const [reason, setReason] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');

  const transitionMutation = useTransitionWithValidation(order.id);
  const overrideMutation = useRequestOverride(order.id);

  const canProceed    = validation?.can_proceed ?? true;
  const hasHardBlocks = (validation?.hard_blocks?.length ?? 0) > 0;
  const hasSoftBlocks = (validation?.soft_blocks?.length ?? 0) > 0;
  const hasWarnings   = (validation?.warnings?.length ?? 0) > 0;
  const targetLabel   = STATUS_LABELS[targetStatus] ?? targetStatus;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const resetState = (): void => {
    setMode('overview');
    setReason('');
    setManagerEmail('');
    setManagerPassword('');
  };

  const handleClose = (): void => {
    resetState();
    onClose();
  };

  // ── Transition handlers ──────────────────────────────────────────────────────

  const handleTransition = async (): Promise<void> => {
    try {
      await transitionMutation.mutateAsync({ new_status: targetStatus });
      toast.success(`Status: ${targetLabel}`);
      resetState();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      // Inspeciona o erro para identificar soft blocks e oferecer override
      const apiData = (err as { data?: { transition_blocks?: { type?: string } } })?.data;
      if (apiData?.transition_blocks?.type === 'soft') {
        setMode('override');
      } else if (!hasHardBlocks) {
        toast.error('Erro ao avançar status');
      }
      // Se hard blocks, o usuário já vê os bloqueios listados — não exibe toast extra
    }
  };

  const handleManagerOverride = async (): Promise<void> => {
    if (!managerEmail.trim() || !managerPassword.trim()) return;
    try {
      await transitionMutation.mutateAsync({
        new_status: targetStatus,
        force: true,
        manager_email: managerEmail.trim(),
        manager_password: managerPassword,
        justification: reason.trim() || undefined,
      });
      toast.success(`Liberado pelo gerente: ${targetLabel}`);
      resetState();
      onSuccess();
      onClose();
    } catch {
      toast.error('Credenciais inválidas');
    }
  };

  const handleRemoteOverride = async (): Promise<void> => {
    if (!reason.trim()) {
      toast.warning('Preencha o motivo');
      return;
    }
    try {
      await overrideMutation.mutateAsync({
        target_status: targetStatus,
        reason: reason.trim(),
      });
      resetState();
      onClose();
    } catch {
      // Handled by the hook's onError
    }
  };

  // ── Header title per mode ────────────────────────────────────────────────────

  const headerTitle: Record<SheetMode, string> = {
    overview: `Avançar para "${targetLabel}"`,
    override: 'Solicitar Liberação',
    manager:  'Credenciais do Gerente',
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
        {/* Tap-to-dismiss overlay */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Sheet */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle bar */}
          <View style={styles.handleWrapper}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <Text variant="label" color={Colors.textPrimary} style={styles.sheetTitle}>
              {headerTitle[mode]}
            </Text>
            <Text variant="caption" color={Colors.textTertiary} style={styles.sheetSubtitle}>
              OS #{order.number} · {order.plate.toUpperCase()}
            </Text>

            {/* ── Mode: overview ──────────────────────────────────────────── */}
            {mode === 'overview' && (
              <>
                {/* Hard blocks */}
                {hasHardBlocks && validation?.hard_blocks.map((b) => (
                  <ValidationItem key={b.code} block={b} type="hard" />
                ))}

                {/* Soft blocks */}
                {hasSoftBlocks && validation?.soft_blocks.map((b) => (
                  <ValidationItem key={b.code} block={b} type="soft" />
                ))}

                {/* Warnings */}
                {hasWarnings && validation?.warnings.map((b) => (
                  <ValidationItem key={b.code} block={b} type="warn" />
                ))}

                {/* All clear indicator */}
                {canProceed && !hasHardBlocks && !hasSoftBlocks && (
                  <View style={styles.allClearRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={SemanticColors.success.color}
                    />
                    <Text variant="bodySmall" style={{ color: SemanticColors.success.color }}>
                      Todos os requisitos atendidos
                    </Text>
                  </View>
                )}

                {/* Pending override indicator */}
                {validation?.has_pending_override === true && (
                  <View style={[styles.pendingBanner, { backgroundColor: SemanticColors.info.bg, borderColor: SemanticColors.info.border }]}>
                    <ActivityIndicator size="small" color={SemanticColors.info.color} />
                    <Text variant="caption" style={[styles.pendingText, { color: SemanticColors.info.color }]}>
                      Liberação pendente — aguardando gerente
                    </Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.actionGroup}>
                  {canProceed ? (
                    <Button
                      label="Avançar Status"
                      onPress={() => { void handleTransition(); }}
                      loading={transitionMutation.isPending}
                    />
                  ) : hasHardBlocks ? (
                    <Text variant="caption" color={Colors.textTertiary} style={styles.blockedHint}>
                      Preencha os campos obrigatórios acima para continuar.
                    </Text>
                  ) : hasSoftBlocks ? (
                    <>
                      <Button
                        label="Solicitar Liberação"
                        onPress={() => setMode('override')}
                        variant="secondary"
                      />
                    </>
                  ) : null}
                </View>
              </>
            )}

            {/* ── Mode: override ──────────────────────────────────────────── */}
            {mode === 'override' && (
              <>
                {/* Show soft blocks as context */}
                {validation?.soft_blocks.map((b) => (
                  <ValidationItem key={b.code} block={b} type="soft" />
                ))}

                <Text variant="label" color={Colors.textPrimary} style={styles.fieldLabel}>
                  Motivo da solicitação *
                </Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Explique por que a transição deve ser liberada..."
                  placeholderTextColor={Colors.textTertiary}
                  value={reason}
                  onChangeText={setReason}
                  textAlignVertical="top"
                />

                <View style={styles.actionGroup}>
                  <Button
                    label="Gerente presente (credencial)"
                    onPress={() => {
                      if (!reason.trim()) {
                        toast.warning('Preencha o motivo');
                        return;
                      }
                      setMode('manager');
                    }}
                    variant="secondary"
                  />
                  <Button
                    label="Enviar para aprovacao remota"
                    onPress={() => { void handleRemoteOverride(); }}
                    loading={overrideMutation.isPending}
                    disabled={!reason.trim()}
                    variant="secondary"
                  />
                  <Button
                    label="Voltar"
                    onPress={() => setMode('overview')}
                    variant="ghost"
                  />
                </View>
              </>
            )}

            {/* ── Mode: manager ────────────────────────────────────────────── */}
            {mode === 'manager' && (
              <>
                <Text variant="bodySmall" color={Colors.textSecondary} style={styles.managerHint}>
                  O gerente deve digitar suas credenciais para autorizar a transição.
                </Text>

                <Text variant="label" color={Colors.textPrimary} style={styles.fieldLabel}>
                  Email
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="gerente@dscar.com"
                  placeholderTextColor={Colors.textTertiary}
                  value={managerEmail}
                  onChangeText={setManagerEmail}
                />

                <Text variant="label" color={Colors.textPrimary} style={styles.fieldLabel}>
                  Senha
                </Text>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textTertiary}
                  value={managerPassword}
                  onChangeText={setManagerPassword}
                />

                <View style={styles.actionGroup}>
                  <Button
                    label="Autorizar"
                    onPress={() => { void handleManagerOverride(); }}
                    loading={transitionMutation.isPending}
                    disabled={!managerEmail.trim() || !managerPassword.trim()}
                  />
                  <Button
                    label="Voltar"
                    onPress={() => setMode('override')}
                    variant="ghost"
                  />
                </View>
              </>
            )}
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
    maxHeight: '82%',
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

  // Validation rows
  validationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  validationIcon: {
    marginTop: 1,
  },
  validationText: {
    flex: 1,
    lineHeight: 20,
  },
  optionalLabel: {
    color: Colors.textTertiary,
  },

  // All clear
  allClearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },

  // Pending override banner
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  pendingText: {
    flex: 1,
  },

  // Blocked hint
  blockedHint: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },

  // Action group
  actionGroup: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },

  // Inputs
  fieldLabel: {
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
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
    minHeight: 80,
  },

  // Manager mode
  managerHint: {
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
});
