import React, { useState, useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import {
  useChecklistItemsStore,
  type ItemStatus,
} from '@/stores/checklist-items.store';

// ─── Definições das categorias e itens ────────────────────────────────────────

interface ItemDef {
  key: string;
  label: string;
}

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  items: ItemDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'bodywork',
    label: 'Lataria / Pintura',
    icon: 'car-outline',
    items: [
      { key: 'amassados', label: 'Amassados' },
      { key: 'riscos', label: 'Riscos' },
      { key: 'ferrugem', label: 'Ferrugem' },
      { key: 'pintura_descascando', label: 'Pintura descascando' },
      { key: 'solda_aparente', label: 'Solda aparente' },
    ],
  },
  {
    key: 'glass',
    label: 'Vidros',
    icon: 'expand-outline',
    items: [
      { key: 'parabrisa', label: 'Para-brisa' },
      { key: 'traseiro', label: 'Traseiro' },
      { key: 'lateral_esq', label: 'Lateral esquerdo' },
      { key: 'lateral_dir', label: 'Lateral direito' },
      { key: 'retrovisor_esq', label: 'Retrovisor esquerdo' },
      { key: 'retrovisor_dir', label: 'Retrovisor direito' },
    ],
  },
  {
    key: 'lighting',
    label: 'Iluminação',
    icon: 'flashlight-outline',
    items: [
      { key: 'farol_esq', label: 'Farol esquerdo' },
      { key: 'farol_dir', label: 'Farol direito' },
      { key: 'lanterna_esq', label: 'Lanterna esquerda' },
      { key: 'lanterna_dir', label: 'Lanterna direita' },
      { key: 'seta', label: 'Setas' },
      { key: 'luz_freio', label: 'Luz de freio' },
    ],
  },
  {
    key: 'tires',
    label: 'Pneus',
    icon: 'disc-outline',
    items: [
      { key: 'dianteiro_esq', label: 'Dianteiro esquerdo' },
      { key: 'dianteiro_dir', label: 'Dianteiro direito' },
      { key: 'traseiro_esq', label: 'Traseiro esquerdo' },
      { key: 'traseiro_dir', label: 'Traseiro direito' },
      { key: 'estepe', label: 'Estepe' },
    ],
  },
  {
    key: 'interior',
    label: 'Interior',
    icon: 'cube-outline',
    items: [
      { key: 'bancos', label: 'Bancos' },
      { key: 'painel', label: 'Painel / Console' },
      { key: 'tapetes', label: 'Tapetes' },
      { key: 'ar_condicionado', label: 'Ar-condicionado' },
      { key: 'multimidia', label: 'Rádio / Multimídia' },
      { key: 'cinto', label: 'Cintos de segurança' },
    ],
  },
  {
    key: 'accessories',
    label: 'Acessórios',
    icon: 'briefcase-outline',
    items: [
      { key: 'macaco', label: 'Macaco' },
      { key: 'chave_roda', label: 'Chave de roda' },
      { key: 'triangulo', label: 'Triângulo' },
      { key: 'extintor', label: 'Extintor' },
      { key: 'documentos', label: 'Documentos no porta-luvas' },
    ],
  },
  {
    key: 'mechanical',
    label: 'Mecânico Visual',
    icon: 'construct-outline',
    items: [
      { key: 'vazamentos', label: 'Vazamentos visíveis' },
      { key: 'correias', label: 'Correias aparentes' },
      { key: 'nivel_oleo', label: 'Nível de óleo' },
      { key: 'bateria', label: 'Bateria' },
      { key: 'nivel_agua', label: 'Nível de água' },
    ],
  },
];

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const STATUS_CONFIG: Record<ItemStatus, StatusConfig> = {
  pending:   { label: 'Pendente',  color: Colors.textSecondary, bg: Colors.inputBg,              icon: 'ellipse-outline' },
  ok:        { label: 'OK',        color: Colors.success,       bg: 'rgba(22, 163, 74, 0.15)',   icon: 'checkmark-circle' },
  attention: { label: 'Atenção',   color: Colors.warning,       bg: 'rgba(245, 158, 11, 0.15)',  icon: 'warning' },
  critical:  { label: 'Crítico',   color: Colors.error,         bg: 'rgba(239, 68, 68, 0.15)',   icon: 'alert-circle' },
};

// ─── ItemRow ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  osId: string;
  checklistType: string;
  category: string;
  itemDef: ItemDef;
}

function ItemRow({ osId, checklistType, category, itemDef }: ItemRowProps): React.ReactElement {
  const entry = useChecklistItemsStore(
    useShallow((s) => s.getItem(osId, checklistType, category, itemDef.key)),
  );
  const setItemStatus = useChecklistItemsStore((s) => s.setItemStatus);
  const setItemNotes = useChecklistItemsStore((s) => s.setItemNotes);

  const [notesOpen, setNotesOpen] = useState(false);

  const STATUS_CYCLE: ItemStatus[] = ['pending', 'ok', 'attention', 'critical'];

  const handleStatusToggle = useCallback(() => {
    const currentIdx = STATUS_CYCLE.indexOf(entry.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    setItemStatus(osId, checklistType, category, itemDef.key, nextStatus);
    if (nextStatus === 'attention' || nextStatus === 'critical') {
      setNotesOpen(true);
    }
  }, [entry.status, osId, checklistType, category, itemDef.key, setItemStatus]);

  const cfg = STATUS_CONFIG[entry.status];

  return (
    <View style={styles.itemRow}>
      <TouchableOpacity
        style={styles.itemMain}
        onPress={handleStatusToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <Text variant="bodySmall" style={styles.itemLabel} numberOfLines={1}>
          {itemDef.label}
        </Text>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setNotesOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={notesOpen ? 'chevron-up' : 'create-outline'}
            size={16}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {notesOpen && (
        <TextInput
          style={styles.notesInput}
          value={entry.notes}
          onChangeText={(t) => setItemNotes(osId, checklistType, category, itemDef.key, t)}
          placeholder="Observação..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={2}
          returnKeyType="done"
          blurOnSubmit
        />
      )}
    </View>
  );
}

// ─── CategorySection ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  osId: string;
  checklistType: string;
  category: CategoryDef;
}

function CategorySection({ osId, checklistType, category }: CategorySectionProps): React.ReactElement {
  const [expanded, setExpanded] = useState(true);

  const counts = useChecklistItemsStore(
    useShallow((s) => {
      const result: Partial<Record<ItemStatus, number>> = {};
      for (const item of category.items) {
        const key = `${osId}:${checklistType}:${category.key}:${item.key}`;
        const status = s.items[key]?.status ?? 'pending';
        result[status] = (result[status] ?? 0) + 1;
      }
      return result;
    }),
  );

  const okCount = counts.ok ?? 0;
  const attentionCount = counts.attention ?? 0;
  const criticalCount = counts.critical ?? 0;
  const pendingCount = counts.pending ?? 0;
  const totalCount = category.items.length;
  const resolvedCount = totalCount - pendingCount;

  return (
    <View style={styles.category}>
      <TouchableOpacity
        style={styles.categoryHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View style={styles.categoryLeft}>
          <Ionicons name={category.icon} size={18} color={Colors.textSecondary} />
          <Text variant="label" style={styles.categoryLabel}>
            {category.label}
          </Text>
        </View>
        <View style={styles.categoryRight}>
          {criticalCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Text variant="caption" style={{ color: Colors.error, fontWeight: '700' }}>
                {criticalCount}
              </Text>
            </View>
          )}
          {attentionCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Text variant="caption" style={{ color: Colors.warning, fontWeight: '700' }}>
                {attentionCount}
              </Text>
            </View>
          )}
          {okCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
              <Text variant="caption" style={{ color: Colors.success, fontWeight: '700' }}>
                {okCount}
              </Text>
            </View>
          )}
          <Text variant="caption" color={Colors.textSecondary}>
            {resolvedCount}/{totalCount}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.categoryItems}>
          {category.items.map((item) => (
            <ItemRow
              key={item.key}
              osId={osId}
              checklistType={checklistType}
              category={category.key}
              itemDef={item}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

interface SummaryBarProps {
  osId: string;
  checklistType: string;
}

export function ChecklistSummaryBar({ osId, checklistType }: SummaryBarProps): React.ReactElement {
  const { ok, attention, critical, pending, total } = useChecklistItemsStore(
    useShallow((s) => s.getSummary(osId, checklistType)),
  );
  const resolved = total - pending;

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryProgress}>
        <Text variant="caption" color={Colors.textTertiary}>
          {resolved}/{total} itens avaliados
        </Text>
      </View>
      <View style={styles.summaryBadges}>
        {ok > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
            <Text variant="caption" style={{ color: Colors.success, fontWeight: '700' }}>{ok}</Text>
          </View>
        )}
        {attention > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name="warning" size={13} color={Colors.warning} />
            <Text variant="caption" style={{ color: Colors.warning, fontWeight: '700' }}>{attention}</Text>
          </View>
        )}
        {critical > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="alert-circle" size={13} color={Colors.error} />
            <Text variant="caption" style={{ color: Colors.error, fontWeight: '700' }}>{critical}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ItemChecklistGridProps {
  osId: string;
  checklistType: string;
}

export function ItemChecklistGrid({ osId, checklistType }: ItemChecklistGridProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <ChecklistSummaryBar osId={osId} checklistType={checklistType} />
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          osId={osId}
          checklistType={checklistType}
          category={cat}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryProgress: {},
  summaryBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },

  // Category
  category: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  categoryLabel: {
    color: Colors.textPrimary,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  categoryItems: {
    paddingVertical: 4,
  },

  // Item row
  itemRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 2,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.sm,
  },
  statusBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    color: Colors.textPrimary,
  },
  notesInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 6,
    minHeight: 52,
    textAlignVertical: 'top',
  },
});
