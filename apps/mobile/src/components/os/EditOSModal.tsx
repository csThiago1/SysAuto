/**
 * Modal para editar dados gerais da OS.
 * Campos: tipo atendimento, tipo OS, seguradora, nº sinistro, previsão de entrega, observações.
 */
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateServiceOrder } from '@/hooks/useUpdateServiceOrder';
import { toast } from '@/stores/toast.store';

const CUSTOMER_TYPES = [
  { value: 'private', label: 'Particular' },
  { value: 'insurer', label: 'Seguradora' },
];

const OS_TYPES = [
  { value: 'bodywork', label: 'Funilaria' },
  { value: 'warranty', label: 'Garantia' },
  { value: 'rework', label: 'Retrabalho' },
  { value: 'mechanical', label: 'Mecânica' },
  { value: 'aesthetic', label: 'Estética' },
];

interface EditOSModalProps {
  visible: boolean;
  osId: string;
  initialData: {
    customer_type?: string;
    os_type?: string;
    casualty_number?: string;
    deductible_amount?: string;
    estimated_delivery_date?: string;
    observations?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function EditOSModal({
  visible,
  osId,
  initialData,
  onClose,
  onSaved,
}: EditOSModalProps): React.JSX.Element {
  const updateOS = useUpdateServiceOrder(osId);

  const [customerType, setCustomerType] = useState(initialData.customer_type ?? 'private');
  const [osType, setOsType] = useState(initialData.os_type ?? 'bodywork');
  const [casualtyNumber, setCasualtyNumber] = useState(initialData.casualty_number ?? '');
  const [deductible, setDeductible] = useState(initialData.deductible_amount ?? '');
  const [deliveryDate, setDeliveryDate] = useState(initialData.estimated_delivery_date ?? '');
  const [observations, setObservations] = useState(initialData.observations ?? '');

  useEffect(() => {
    if (visible) {
      setCustomerType(initialData.customer_type ?? 'private');
      setOsType(initialData.os_type ?? 'bodywork');
      setCasualtyNumber(initialData.casualty_number ?? '');
      setDeductible(initialData.deductible_amount ?? '');
      setDeliveryDate(initialData.estimated_delivery_date ?? '');
      setObservations(initialData.observations ?? '');
    }
  }, [visible, initialData]);

  const handleSave = async (): Promise<void> => {
    try {
      await updateOS.mutateAsync({
        customer_type: customerType as 'insurer' | 'private',
        os_type: osType,
        casualty_number: customerType === 'insurer' ? casualtyNumber : undefined,
        deductible_amount: customerType === 'insurer' ? deductible : undefined,
        estimated_delivery_date: deliveryDate || undefined,
        observations: observations || undefined,
      });
      toast.success('OS atualizada');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao salvar OS');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">Editar OS</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Tipo de atendimento */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO DE ATENDIMENTO</Text>
            <View style={styles.pillRow}>
              {CUSTOMER_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.pill, customerType === t.value && styles.pillActive]}
                  onPress={() => setCustomerType(t.value)}
                >
                  <Text variant="bodySmall" color={customerType === t.value ? Colors.textPrimary : Colors.textTertiary}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tipo de OS */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO DE OS</Text>
            <View style={styles.pillRow}>
              {OS_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.pill, osType === t.value && styles.pillActive]}
                  onPress={() => setOsType(t.value)}
                >
                  <Text variant="bodySmall" color={osType === t.value ? Colors.textPrimary : Colors.textTertiary}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Campos de seguradora (condicionais) */}
          {customerType === 'insurer' && (
            <>
              <View style={styles.field}>
                <Text variant="mono" style={styles.label}>Nº SINISTRO</Text>
                <TextInput
                  style={styles.input}
                  value={casualtyNumber}
                  onChangeText={setCasualtyNumber}
                  placeholder="Número do sinistro"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <View style={styles.field}>
                <Text variant="mono" style={styles.label}>FRANQUIA (R$)</Text>
                <TextInput
                  style={styles.input}
                  value={deductible}
                  onChangeText={setDeductible}
                  placeholder="0,00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}

          {/* Previsão de entrega */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PREVISÃO DE ENTREGA</Text>
            <TextInput
              style={styles.input}
              value={deliveryDate}
              onChangeText={setDeliveryDate}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Observações */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>OBSERVAÇÕES</Text>
            <TextInput
              style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
              value={observations}
              onChangeText={setObservations}
              placeholder="Observações técnicas..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Salvar Alterações"
            variant="primary"
            fullWidth
            loading={updateOS.isPending}
            onPress={() => void handleSave()}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: { borderColor: Colors.brand, backgroundColor: Colors.brandTint },
  footer: { padding: Spacing.lg },
});
