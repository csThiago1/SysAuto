import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useNewOSStore, type CustomerType, type OSType } from '@/stores/new-os.store';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step3OSTypeProps {
  onNext: () => void;
  onBack: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CUSTOMER_TYPES: { key: CustomerType; label: string }[] = [
  { key: 'insurer', label: 'Seguradora' },
  { key: 'private', label: 'Particular' },
];

const OS_TYPES: { key: OSType; label: string }[] = [
  { key: 'bodywork', label: 'Lataria/Pintura' },
  { key: 'warranty', label: 'Garantia' },
  { key: 'rework', label: 'Retrabalho' },
  { key: 'mechanical', label: 'Mecânica' },
  { key: 'aesthetic', label: 'Estética' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Step3OSType({ onNext, onBack }: Step3OSTypeProps): React.JSX.Element {
  const customerType = useNewOSStore((s) => s.customerType);
  const osType = useNewOSStore((s) => s.osType);
  const insurerName = useNewOSStore((s) => s.insurerName);
  const claimNumber = useNewOSStore((s) => s.claimNumber);
  const deductible = useNewOSStore((s) => s.deductible);
  const setCustomerType = useNewOSStore((s) => s.setCustomerType);
  const setOSType = useNewOSStore((s) => s.setOSType);
  const setInsurer = useNewOSStore((s) => s.setInsurer);
  const setClaimNumber = useNewOSStore((s) => s.setClaimNumber);
  const setDeductible = useNewOSStore((s) => s.setDeductible);

  const isContinueDisabled = (): boolean => {
    if (customerType === 'insurer' && insurerName.trim() === '') return true;
    return false;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step label */}
      <Text variant="bodySmall" color="#6b7280">
        Passo 3 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Tipo de OS
      </Text>

      {/* Customer type label */}
      <Text variant="label" color="#374151">
        Tipo de Cliente
      </Text>

      {/* Customer type toggle */}
      <View style={styles.toggleRow}>
        {CUSTOMER_TYPES.map((ct) => {
          const isActive = customerType === ct.key;
          return (
            <TouchableOpacity
              key={ct.key}
              style={[styles.toggleButton, isActive ? styles.toggleActive : styles.toggleInactive]}
              onPress={() => setCustomerType(ct.key)}
              activeOpacity={0.8}
            >
              <Text
                variant="label"
                color={isActive ? '#ffffff' : '#374151'}
              >
                {ct.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* OS type label */}
      <Text variant="label" color="#374151" style={styles.serviceLabel}>
        Tipo de Serviço
      </Text>

      {/* OS type grid */}
      <View style={styles.typeGrid}>
        {OS_TYPES.map((ot) => {
          const isActive = osType === ot.key;
          return (
            <TouchableOpacity
              key={ot.key}
              style={[styles.typeChip, isActive ? styles.typeChipActive : styles.typeChipInactive]}
              onPress={() => setOSType(ot.key)}
              activeOpacity={0.8}
            >
              <Text
                variant="bodySmall"
                color={isActive ? '#e31b1b' : '#6b7280'}
                style={styles.typeChipText}
              >
                {ot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Insurer fields — only when customerType === 'insurer' */}
      {customerType === 'insurer' && (
        <View style={styles.insurerSection}>
          <TextInput
            style={styles.input}
            placeholder="Seguradora"
            placeholderTextColor="#9ca3af"
            value={insurerName}
            onChangeText={setInsurer}
          />
          <TextInput
            style={styles.input}
            placeholder="Nº Sinistro"
            placeholderTextColor="#9ca3af"
            value={claimNumber}
            onChangeText={setClaimNumber}
          />
          <TextInput
            style={styles.input}
            placeholder="Franquia (R$)"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={deductible}
            onChangeText={setDeductible}
          />
        </View>
      )}

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.primaryButton, isContinueDisabled() && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isContinueDisabled()}
        activeOpacity={0.8}
      >
        <Text variant="label" color="#ffffff">
          Continuar
        </Text>
      </TouchableOpacity>

      {/* Back link */}
      <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
        <Text variant="bodySmall" color="#6b7280" style={styles.backText}>
          Voltar
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    marginTop: 4,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#e31b1b',
    borderWidth: 0,
  },
  toggleInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceLabel: {
    marginTop: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  typeChipActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#e31b1b',
  },
  typeChipInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  typeChipText: {
    fontWeight: '500',
  },
  insurerSection: {
    gap: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  primaryButton: {
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backText: {
    textAlign: 'center',
  },
});
