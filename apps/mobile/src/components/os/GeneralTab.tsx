import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { InfoRow } from '@/components/ui/InfoRow';
import { Colors } from '@/constants/theme';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus } from '@paddock/types';
import { ChecklistProgressRow } from './ChecklistProgressRow';
import { VistoriaCTACard } from './VistoriaCTACard';
import { FinancialSummary } from './FinancialSummary';
import { OS_TYPE_LABELS, formatDateTime } from './os-detail-utils';
import type { ServiceOrderDetail } from './os-detail-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  insurer: 'Seguradora',
  private: 'Particular',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface GeneralTabProps {
  order: ServiceOrderDetail;
  osId: string;
  photoCount: number;
  itemsOk: number;
  itemsAttention: number;
  itemsCritical: number;
  partsTotal: number;
  laborTotal: number;
  onOpenStatusModal: () => void;
  onOpenChecklist: () => void;
  onOpenEditOS: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneralTab({
  order,
  osId,
  photoCount,
  itemsOk,
  itemsAttention,
  itemsCritical,
  partsTotal,
  laborTotal,
  onOpenStatusModal,
  onOpenChecklist,
  onOpenEditOS,
}: GeneralTabProps): React.JSX.Element {
  const discountPercent = 0; // TODO: extract from OS data if available

  return (
    <>
      {/* Action buttons */}
      <View style={styles.actionRow}>
        {(VALID_TRANSITIONS[order.status as ServiceOrderStatus] ?? []).length > 0 && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={onOpenStatusModal}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.brand} />
            <Text variant="label" color={Colors.brand}>
              Avançar Status
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.actionBtnPrimary,
            (VALID_TRANSITIONS[order.status as ServiceOrderStatus] ?? []).length > 0 && styles.actionBtnFlex,
          ]}
          onPress={onOpenChecklist}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={16} color={Colors.textPrimary} />
          <Text variant="label" color={Colors.textPrimary}>
            Checklist
          </Text>
        </TouchableOpacity>
      </View>

      <ChecklistProgressRow
        photoCount={photoCount}
        ok={itemsOk}
        attention={itemsAttention}
        critical={itemsCritical}
      />

      {/* Vistoria CTAs */}
      {order.status === 'initial_survey' && (
        <View style={styles.vstCardWrapper}>
          <VistoriaCTACard type="entrada" osId={osId} />
        </View>
      )}
      {order.status === 'final_survey' && (
        <View style={styles.vstCardWrapper}>
          <VistoriaCTACard type="saida" osId={osId} />
        </View>
      )}

      {/* Dados Gerais */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionDivider label="DADOS GERAIS" />
        <TouchableOpacity onPress={onOpenEditOS} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="create-outline" size={20} color={Colors.brand} />
        </TouchableOpacity>
      </View>
      <Card style={styles.card}>
        <InfoRow
          label="CLIENTE"
          value={
            <Text variant="bodySmall" style={{ fontWeight: '700', color: Colors.textPrimary }}>
              {order.customer_name}
            </Text>
          }
          noDivider={false}
        />
        <InfoRow
          label="TIPO CLIENTE"
          value={CUSTOMER_TYPE_LABELS[order.customer_type] ?? order.customer_type}
          noDivider={false}
        />
        <InfoRow
          label="TIPO OS"
          value={OS_TYPE_LABELS[order.os_type] ?? order.os_type}
          noDivider={false}
        />
        {order.consultant != null && (
          <InfoRow label="CONSULTOR" value={order.consultant.full_name} noDivider={false} />
        )}
        <InfoRow label="ABERTURA" value={formatDateTime(order.opened_at)} noDivider />
      </Card>

      {/* Resumo Financeiro */}
      <FinancialSummary
        partsTotal={partsTotal}
        laborTotal={laborTotal}
        discountPercent={discountPercent}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.brand,
    flex: 1,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: Colors.brandTint,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  actionBtnFlex: {
    flex: 1,
  },
  vstCardWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
