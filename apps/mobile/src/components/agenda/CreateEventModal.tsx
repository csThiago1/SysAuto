import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EVENT_TYPES = [
  { value: 'entry', label: 'Entrada' },
  { value: 'delivery', label: 'Entrega' },
  { value: 'return', label: 'Retorno' },
  { value: 'other', label: 'Outro' },
];

interface CreateEventModalProps {
  visible: boolean;
  initialDate?: Date;
  prefill?: {
    plate?: string;
    customerName?: string;
    osId?: string;
    eventType?: string;
  };
  onSave: (data: {
    osId?: string;
    schedulingDate: string;
    estimatedDeliveryDate?: string;
    repairDays?: number;
    eventType: string;
    notes?: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function CreateEventModal({
  visible,
  initialDate,
  prefill,
  onSave,
  onClose,
  loading = false,
}: CreateEventModalProps): React.JSX.Element {
  const [eventType, setEventType] = useState(prefill?.eventType ?? 'entry');
  const [date, setDate] = useState(initialDate ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [plate, setPlate] = useState(prefill?.plate ?? '');
  const [customerName, setCustomerName] = useState(prefill?.customerName ?? '');
  const [repairDays, setRepairDays] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setEventType(prefill?.eventType ?? 'entry');
      setDate(initialDate ?? new Date());
      setPlate(prefill?.plate ?? '');
      setCustomerName(prefill?.customerName ?? '');
      setRepairDays('');
      setNotes('');
    }
  }, [visible, initialDate, prefill]);

  const handleSave = (): void => {
    const days = parseInt(repairDays, 10);
    const estimatedDate = !isNaN(days) && days > 0
      ? new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    onSave({
      osId: prefill?.osId,
      schedulingDate: date.toISOString(),
      estimatedDeliveryDate: estimatedDate,
      repairDays: !isNaN(days) ? days : undefined,
      eventType,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">Agendar</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Tipo */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, eventType === t.value && styles.typeBtnActive]}
                  onPress={() => setEventType(t.value)}
                >
                  <Text variant="bodySmall" color={eventType === t.value ? Colors.textPrimary : Colors.textTertiary}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Data */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>DATA</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text variant="body">{format(date, "dd/MM/yyyy", { locale: ptBR })}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
              />
            )}
          </View>

          {/* Hora */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>HORA</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
              <Text variant="body">{format(date, "HH:mm")}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={date}
                mode="time"
                display="spinner"
                onChange={(_, d) => { setShowTimePicker(false); if (d) setDate(d); }}
              />
            )}
          </View>

          {/* Placa */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PLACA</Text>
            <TextInput
              style={styles.inputText}
              value={plate}
              onChangeText={setPlate}
              placeholder="ABC1D23"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          {/* Cliente */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>CLIENTE</Text>
            <TextInput
              style={styles.inputText}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Nome do cliente"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Dias de reparo (so para entrada) */}
          {eventType === 'entry' && (
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>DIAS DE REPARO (PREVISAO)</Text>
              <TextInput
                style={styles.inputText}
                value={repairDays}
                onChangeText={setRepairDays}
                keyboardType="numeric"
                placeholder="Ex: 15"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          )}

          {/* Observacao */}
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>OBSERVACAO</Text>
            <TextInput
              style={[styles.inputText, { minHeight: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observacao opcional..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Salvar" variant="primary" fullWidth loading={loading} onPress={handleSave} />
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
  },
  inputText: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: { borderColor: Colors.brand, backgroundColor: Colors.brandTint },
  footer: { padding: Spacing.lg },
});
