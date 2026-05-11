import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, SemanticColors, Spacing } from '@/constants/theme';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus, TransitionRequirements } from '@paddock/types';

const STATUS_LABELS: Record<string, string> = {
  reception: 'Recepcao', initial_survey: 'Vistoria Inicial', budget: 'Orcamento',
  waiting_auth: 'Ag. Autorizacao', authorized: 'Autorizada', waiting_parts: 'Ag. Pecas',
  repair: 'Reparo', mechanic: 'Mecanica', bodywork: 'Funilaria', painting: 'Pintura',
  assembly: 'Montagem', polishing: 'Polimento', washing: 'Lavagem',
  final_survey: 'Vistoria Final', ready: 'Pronto', delivered: 'Entregue',
};

interface Props {
  currentStatus: string;
  transitionRequirements?: TransitionRequirements;
  onPress: (targetStatus: ServiceOrderStatus) => void;
}

export function PendingRequirements({ currentStatus, transitionRequirements, onPress }: Props): React.JSX.Element | null {
  if (!transitionRequirements) return null;

  const nextStatuses = VALID_TRANSITIONS[currentStatus as ServiceOrderStatus] ?? [];
  const firstTarget = nextStatuses[0];
  if (!firstTarget) return null;

  const validation = transitionRequirements[firstTarget];
  if (!validation) return null;

  const hardCount = validation.hard_blocks?.length ?? 0;
  const softCount = validation.soft_blocks?.length ?? 0;
  const totalPending = hardCount + softCount;

  if (totalPending === 0) return null;

  const targetLabel = STATUS_LABELS[firstTarget] ?? firstTarget;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="alert-circle" size={20} color={SemanticColors.warning.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Para avancar</Text>
          <Text style={styles.subtitle}>
            {totalPending} pendencia{totalPending > 1 ? 's' : ''} para {targetLabel}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => onPress(firstTarget)}
          activeOpacity={0.7}
        >
          <Text style={styles.resolveBtnText}>Resolver</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: SemanticColors.warning.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  title: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.brandTint, borderWidth: 1, borderColor: Colors.brand,
  },
  resolveBtnText: { fontSize: 13, fontWeight: '600', color: Colors.brand },
});
