import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { OSPart } from '@/hooks/useOSParts';

interface AddPartModalProps {
  visible: boolean;
  editingPart?: OSPart | null;
  onSave: (data: { description: string; panel: string; quantity: number; unit_price: string; tipo_qualidade: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function AddPartModal({
  visible,
  editingPart,
  onSave,
  onClose,
  loading = false,
}: AddPartModalProps): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [panel, setPanel] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [tipoQualidade, setTipoQualidade] = useState<'replacement' | 'other'>('replacement');

  useEffect(() => {
    if (editingPart) {
      setDescription(editingPart.description);
      setPanel(editingPart.panel ?? '');
      setQuantity(String(editingPart.quantity));
      setUnitPrice(editingPart.unit_price);
      setTipoQualidade(editingPart.tipo_qualidade);
    } else {
      setDescription('');
      setPanel('');
      setQuantity('1');
      setUnitPrice('');
      setTipoQualidade('replacement');
    }
  }, [editingPart, visible]);

  const canSave = description.trim().length > 0 && Number(unitPrice) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">{editingPart ? 'Editar Peça' : 'Adicionar Peça'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>NOME DA PEÇA</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Parabrisa dianteiro"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PAINEL</Text>
            <TextInput
              style={styles.input}
              value={panel}
              onChangeText={setPanel}
              placeholder="Ex: Para-brisa, Porta LE"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text variant="mono" style={styles.label}>QTD</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text variant="mono" style={styles.label}>PREÇO UNIT. (R$)</Text>
              <TextInput
                style={styles.input}
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, tipoQualidade === 'replacement' && styles.typeBtnActive]}
                onPress={() => setTipoQualidade('replacement')}
              >
                <Text variant="body" color={tipoQualidade === 'replacement' ? Colors.textPrimary : Colors.textTertiary}>
                  Troca
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, tipoQualidade === 'other' && styles.typeBtnActive]}
                onPress={() => setTipoQualidade('other')}
              >
                <Text variant="body" color={tipoQualidade === 'other' ? Colors.textPrimary : Colors.textTertiary}>
                  Outros
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={editingPart ? 'Salvar Alterações' : 'Adicionar Peça'}
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              if (!canSave) return;
              onSave({
                description: description.trim(),
                panel: panel.trim(),
                quantity: Number(quantity) || 1,
                unit_price: unitPrice,
                tipo_qualidade: tipoQualidade,
              });
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  footer: { padding: Spacing.lg },
});
