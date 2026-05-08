import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { OSLaborItem } from '@/hooks/useOSLabor';

const CATEGORIES = [
  { value: 'bodywork', label: 'Funilaria' },
  { value: 'painting', label: 'Pintura' },
  { value: 'mechanics', label: 'Mecânica' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'polishing', label: 'Polimento' },
  { value: 'washing', label: 'Lavagem' },
  { value: 'other', label: 'Outros' },
];

interface AddLaborModalProps {
  visible: boolean;
  editingItem?: OSLaborItem | null;
  onSave: (data: { description: string; unit_price: string; quantity?: number }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function AddLaborModal({
  visible,
  editingItem,
  onSave,
  onClose,
  loading = false,
}: AddLaborModalProps): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('bodywork');
  const [unitPrice, setUnitPrice] = useState('');

  useEffect(() => {
    if (editingItem) {
      setDescription(editingItem.description);
      setCategory(editingItem.category ?? 'bodywork');
      setUnitPrice(editingItem.value);
    } else {
      setDescription('');
      setCategory('bodywork');
      setUnitPrice('');
    }
  }, [editingItem, visible]);

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
          <Text variant="heading3">{editingItem ? 'Editar Serviço' : 'Adicionar Serviço'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>DESCRIÇÃO</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o serviço..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>CATEGORIA</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryBtn, category === cat.value && styles.categoryBtnActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    variant="bodySmall"
                    color={category === cat.value ? Colors.textPrimary : Colors.textTertiary}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>VALOR (R$)</Text>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={editingItem ? 'Salvar Alterações' : 'Adicionar Serviço'}
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              if (!canSave) return;
              onSave({
                description: description.trim(),
                unit_price: unitPrice,
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
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBtnActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  footer: { padding: Spacing.lg },
});
