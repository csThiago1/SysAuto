import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AddPartModal } from './AddPartModal';
import { useOSParts, useAddOSPart, useUpdateOSPart, useDeleteOSPart } from '@/hooks/useOSParts';
import type { OSPart } from '@/hooks/useOSParts';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

interface PartsTabProps {
  osId: string;
}

export function PartsTab({ osId }: PartsTabProps): React.JSX.Element {
  const { data: parts, isLoading } = useOSParts(osId);
  const addPart = useAddOSPart(osId);
  const updatePart = useUpdateOSPart(osId);
  const deletePart = useDeleteOSPart(osId);

  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<OSPart | null>(null);
  const [deletingPart, setDeletingPart] = useState<OSPart | null>(null);

  if (isLoading) return <ShimmerBlock height={120} />;

  const handleSave = async (data: {
    description: string;
    panel: string;
    quantity: number;
    unit_price: string;
    tipo_qualidade: string;
  }): Promise<void> => {
    try {
      if (editingPart) {
        await updatePart.mutateAsync({ partId: editingPart.id, payload: data });
        toast.success('Peça atualizada');
      } else {
        await addPart.mutateAsync(data);
        toast.success('Peça adicionada');
      }
      setShowModal(false);
      setEditingPart(null);
    } catch {
      toast.error('Erro ao salvar peça');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingPart) return;
    try {
      await deletePart.mutateAsync(deletingPart.id);
      toast.success('Peça removida');
      setDeletingPart(null);
    } catch {
      toast.error('Erro ao remover peça');
    }
  };

  return (
    <View style={styles.container}>
      {!parts || parts.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={32} color={Colors.textTertiary} />
            <Text variant="body" color={Colors.textTertiary}>Nenhuma peça adicionada</Text>
          </View>
        </Card>
      ) : (
        parts.map((part) => (
          <TouchableOpacity
            key={part.id}
            onPress={() => { setEditingPart(part); setShowModal(true); }}
            onLongPress={() => setDeletingPart(part)}
            activeOpacity={0.7}
          >
            <Card>
              <View style={styles.partRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{part.description}</Text>
                  {part.panel ? <Text variant="bodySmall" color={Colors.textTertiary}>{part.panel}</Text> : null}
                  <Text variant="caption" color={Colors.textTertiary}>
                    {part.quantity}x {formatBRL(part.unit_price)} · {part.source_type_display || part.tipo_qualidade || ''}
                  </Text>
                </View>
                <Text variant="mono">{formatBRL(part.subtotal)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <Button
        label="Adicionar Peça"
        variant="secondary"
        fullWidth
        onPress={() => { setEditingPart(null); setShowModal(true); }}
      />

      <AddPartModal
        visible={showModal}
        editingPart={editingPart}
        onSave={(data) => void handleSave(data)}
        onClose={() => { setShowModal(false); setEditingPart(null); }}
        loading={addPart.isPending || updatePart.isPending}
      />

      <ConfirmDialog
        visible={!!deletingPart}
        title="Remover Peça"
        message={`Deseja remover "${deletingPart?.description}"?`}
        confirmLabel="Remover"
        variant="danger"
        loading={deletePart.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingPart(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  partRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
