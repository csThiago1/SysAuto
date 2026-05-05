import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useInsurers, type InsurerOption } from '@/hooks/useInsurers';
import { useNewOSStore, type CustomerType, type OSType } from '@/stores/new-os.store';
import { Colors, Radii, Typography } from '@/constants/theme';

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

const INSURED_TYPES: { key: 'insured' | 'third'; label: string }[] = [
  { key: 'insured', label: 'Segurado' },
  { key: 'third', label: 'Terceiro' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Step3OSType({ onNext, onBack }: Step3OSTypeProps): React.JSX.Element {
  const customerType = useNewOSStore((s) => s.customerType);
  const osType = useNewOSStore((s) => s.osType);
  const insurer = useNewOSStore((s) => s.insurer);
  const insuredType = useNewOSStore((s) => s.insuredType);
  const claimNumber = useNewOSStore((s) => s.claimNumber);
  const deductible = useNewOSStore((s) => s.deductible);
  const setCustomerType = useNewOSStore((s) => s.setCustomerType);
  const setOSType = useNewOSStore((s) => s.setOSType);
  const setInsurer = useNewOSStore((s) => s.setInsurer);
  const setInsuredType = useNewOSStore((s) => s.setInsuredType);
  const setClaimNumber = useNewOSStore((s) => s.setClaimNumber);
  const setDeductible = useNewOSStore((s) => s.setDeductible);

  const { filteredInsurers, isLoading: isLoadingInsurers, filterQuery, setFilterQuery } =
    useInsurers();

  const selectedInsurer: InsurerOption | null = insurer;

  const isContinueDisabled = (): boolean => {
    if (customerType === 'insurer') {
      if (!insurer) return true;
      if (!insuredType) return true;
    }
    return false;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step label */}
      <Text variant="bodySmall" color={Colors.textTertiary}>
        Passo 3 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Tipo de OS
      </Text>

      {/* Customer type label */}
      <Text style={Typography.labelMono}>
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
                color={isActive ? Colors.textPrimary : Colors.textPrimary}
              >
                {ct.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* OS type label */}
      <Text style={[Typography.labelMono, styles.serviceLabel]}>
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
                color={isActive ? Colors.brand : Colors.textTertiary}
                style={styles.typeChipText}
              >
                {ot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Insurer section — only when customerType === 'insurer' */}
      {customerType === 'insurer' && (
        <View style={styles.insurerSection}>
          {/* Search input */}
          <TextInput
            style={styles.input}
            placeholder="Buscar seguradora..."
            placeholderTextColor={Colors.textSecondary}
            value={filterQuery}
            onChangeText={setFilterQuery}
          />

          {/* Loading indicator */}
          {isLoadingInsurers && <ActivityIndicator size="small" color={Colors.brand} />}

          {/* Suggestions list */}
          {filteredInsurers.length > 0 && selectedInsurer === null && (
            <View style={styles.insurerList}>
              {filteredInsurers.slice(0, 6).map((ins) => (
                <TouchableOpacity
                  key={ins.id}
                  style={styles.insurerRow}
                  onPress={(): void => {
                    setInsurer(ins);
                    setFilterQuery('');
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.insurerDot, { backgroundColor: ins.brandColor }]} />
                  <Text variant="body" color={Colors.textPrimary}>{ins.displayName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected insurer card */}
          {selectedInsurer !== null && (
            <View style={styles.selectedInsurerCard}>
              <View style={[styles.insurerDot, { backgroundColor: selectedInsurer.brandColor }]} />
              <Text variant="body" color={Colors.textPrimary} style={styles.selectedInsurerName}>
                {selectedInsurer.displayName}
              </Text>
              <TouchableOpacity onPress={(): void => setInsurer(null)} activeOpacity={0.7}>
                <Text variant="bodySmall" color={Colors.brand}>Trocar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* insured_type toggle */}
          {selectedInsurer !== null && (
            <>
              <Text style={Typography.labelMono}>Tipo de segurado</Text>
              <View style={styles.toggleRow}>
                {INSURED_TYPES.map((it) => {
                  const isActive = insuredType === it.key;
                  return (
                    <TouchableOpacity
                      key={it.key}
                      style={[
                        styles.toggleButton,
                        isActive ? styles.toggleActive : styles.toggleInactive,
                      ]}
                      onPress={(): void => setInsuredType(it.key)}
                      activeOpacity={0.8}
                    >
                      <Text variant="label" color={isActive ? Colors.textPrimary : Colors.textPrimary}>
                        {it.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Casualty + deductible */}
          {selectedInsurer !== null && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nº Sinistro (opcional)"
                placeholderTextColor={Colors.textSecondary}
                value={claimNumber}
                onChangeText={setClaimNumber}
              />
              {insuredType === 'insured' && (
                <TextInput
                  style={styles.input}
                  placeholder="Franquia R$ (opcional)"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={deductible}
                  onChangeText={setDeductible}
                />
              )}
            </>
          )}
        </View>
      )}

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.primaryButton, isContinueDisabled() && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isContinueDisabled()}
        activeOpacity={0.8}
      >
        <Text variant="label" color={Colors.textPrimary}>
          Continuar
        </Text>
      </TouchableOpacity>

      {/* Back link */}
      <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.backText}>
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
    backgroundColor: Colors.bg,
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
    borderRadius: Radii.md,
    padding: 14,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.brand,
    borderWidth: 0,
  },
  toggleInactive: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.brandTint,
    borderColor: Colors.brand,
  },
  typeChipInactive: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.border,
  },
  typeChipText: {
    fontWeight: '500',
  },
  insurerSection: {
    gap: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  insurerList: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderTopColor: Colors.borderGlintTop,
    borderRightColor: Colors.borderGlintSide,
    borderBottomColor: Colors.borderGlintBottom,
    borderLeftColor: Colors.borderGlintSide,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  insurerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  selectedInsurerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radii.md,
    padding: 14,
    borderWidth: 1,
    borderTopColor: Colors.borderGlintTop,
    borderRightColor: Colors.borderGlintSide,
    borderBottomColor: Colors.borderGlintBottom,
    borderLeftColor: Colors.brand,
    borderLeftWidth: 3,
  },
  selectedInsurerName: {
    flex: 1,
  },
  insurerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  primaryButton: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.md,
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
