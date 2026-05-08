import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AddLaborModal } from './AddLaborModal';
import { useOSLabor, useAddOSLabor, useUpdateOSLabor, useDeleteOSLabor } from '@/hooks/useOSLabor';
import type { OSLaborItem } from '@/hooks/useOSLabor';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

interface LaborTabProps {
  osId: string;
}

export function LaborTab({ osId }: LaborTabProps): React.JSX.Element {
  const { data: items, isLoading } = useOSLabor(osId);
  const addLabor = useAddOSLabor(osId);
  const updateLabor = useUpdateOSLabor(osId);
  const deleteLabor = useDeleteOSLabor(osId);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OSLaborItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<OSLaborItem | null>(null);

  if (isLoading) return <ShimmerBlock height={120} />;

  const handleSave = async (data: { description: string; unit_price: string; quantity?: number }): Promise<void> => {
    try {
      if (editingItem) {
        await updateLabor.mutateAsync({ itemId: editingItem.id, payload: data });
        toast.success('Serviço atualizado');
      } else {
        await addLabor.mutateAsync(data);
        toast.success('Serviço adicionado');
      }
      setShowModal(false);
      setEditingItem(null);
    } catch {
      toast.error('Erro ao salvar serviço');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingItem) return;
    try {
      await deleteLabor.mutateAsync(deletingItem.id);
      toast.success('Serviço removido');
      setDeletingItem(null);
    } catch {
      toast.error('Erro ao remover serviço');
    }
  };

  return (
    <View style={styles.container}>
      {!items || items.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="hammer-outline" size={32} color={Colors.textTertiary} />
            <Text variant="body" color={Colors.textTertiary}>Nenhum serviço adicionado</Text>
          </View>
        </Card>
      ) : (
        items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => { setEditingItem(item); setShowModal(true); }}
            onLongPress={() => setDeletingItem(item)}
            activeOpacity={0.7}
          >
            <Card>
              <View style={styles.itemRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{item.description}</Text>
                  <Text variant="caption" color={Colors.textTertiary}>
                    {item.quantity}x {formatBRL(item.unit_price)}
                  </Text>
                </View>
                <Text variant="mono">{formatBRL(item.total)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <Button label="Adicionar Serviço" variant="secondary" fullWidth onPress={() => { setEditingItem(null); setShowModal(true); }} />

      <AddLaborModal
        visible={showModal}
        editingItem={editingItem}
        onSave={(data) => void handleSave(data)}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        loading={addLabor.isPending || updateLabor.isPending}
      />

      <ConfirmDialog
        visible={!!deletingItem}
        title="Remover Serviço"
        message={`Deseja remover "${deletingItem?.description}"?`}
        confirmLabel="Remover"
        variant="danger"
        loading={deleteLabor.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
