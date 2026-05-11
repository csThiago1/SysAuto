import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast.store';

interface FieldConfig {
  key: string;
  label: string;
  keyboard?: 'default' | 'numeric' | 'email-address';
  placeholder?: string;
}

interface InlineFieldProps {
  osId: string;
  code: string;
  fields: FieldConfig[];
  onSaved: () => void;
}

export function InlineField({ osId, code, fields, onSaved }: InlineFieldProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const val = values[field.key]?.trim();
      if (val) {
        payload[field.key] = field.keyboard === 'numeric' ? Number(val) : val;
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.warning('Preencha ao menos um campo');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/service-orders/${osId}/`, payload);
      toast.success('Dados salvos');
      setExpanded(false);
      onSaved();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(true)} activeOpacity={0.7}>
        <Ionicons name="pencil" size={14} color={Colors.brand} />
        <Text style={styles.expandText}>Preencher</Text>
        <Ionicons name="chevron-forward" size={12} color={Colors.brand} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.key} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder ?? field.label}
            placeholderTextColor={Colors.textTertiary}
            keyboardType={field.keyboard ?? 'default'}
            autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
            value={values[field.key] ?? ''}
            onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
          />
        </View>
      ))}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setExpanded(false)} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={() => { void handleSave(); }} activeOpacity={0.7} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
    marginLeft: 30,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand,
  },
  container: {
    marginTop: 8,
    marginLeft: 30,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radii.sm,
    backgroundColor: Colors.brand,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
