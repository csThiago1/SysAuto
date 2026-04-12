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
  pending:   { label: 'Pendente',  color: '#9ca3af', bg: '#f3f4f6', icon: 'ellipse-outline' },
  ok:        { label: 'OK',        color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle' },
  attention: { label: 'Atenção',   color: '#d97706', bg: '#fef3c7', icon: 'warning' },
  critical:  { label: 'Crítico',   color: '#dc2626', bg: '#fee2e2', icon: 'alert-circle' },
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
            color="#9ca3af"
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {notesOpen && (
        <TextInput
          style={styles.notesInput}
          value={entry.notes}
          onChangeText={(t) => setItemNotes(osId, checklistType, category, itemDef.key, t)}
          placeholder="Observação..."
          placeholderTextColor="#9ca3af"
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
          <Ionicons name={category.icon} size={18} color="#374151" />
          <Text variant="label" style={styles.categoryLabel}>
            {category.label}
          </Text>
        </View>
        <View style={styles.categoryRight}>
          {criticalCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: '#fee2e2' }]}>
              <Text variant="caption" style={{ color: '#dc2626', fontWeight: '700' }}>
                {criticalCount}
              </Text>
            </View>
          )}
          {attentionCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: '#fef3c7' }]}>
              <Text variant="caption" style={{ color: '#d97706', fontWeight: '700' }}>
                {attentionCount}
              </Text>
            </View>
          )}
          {okCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: '#dcfce7' }]}>
              <Text variant="caption" style={{ color: '#16a34a', fontWeight: '700' }}>
                {okCount}
              </Text>
            </View>
          )}
          <Text variant="caption" color="#9ca3af">
            {resolvedCount}/{totalCount}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#9ca3af"
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
        <Text variant="caption" color="#6b7280">
          {resolved}/{total} itens avaliados
        </Text>
      </View>
      <View style={styles.summaryBadges}>
        {ok > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
            <Text variant="caption" style={{ color: '#16a34a', fontWeight: '700' }}>{ok}</Text>
          </View>
        )}
        {attention > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="warning" size={13} color="#d97706" />
            <Text variant="caption" style={{ color: '#d97706', fontWeight: '700' }}>{attention}</Text>
          </View>
        )}
        {critical > 0 && (
          <View style={[styles.summaryBadge, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="alert-circle" size={13} color="#dc2626" />
            <Text variant="caption" style={{ color: '#dc2626', fontWeight: '700' }}>{critical}</Text>
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
    gap: 8,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    borderRadius: 20,
  },

  // Category
  category: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryLabel: {
    color: '#111827',
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
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
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
    color: '#374151',
  },
  notesInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 6,
    minHeight: 52,
    textAlignVertical: 'top',
  },
});
