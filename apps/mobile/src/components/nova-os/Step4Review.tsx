import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useNewOSStore, type CustomerType, type OSType } from '@/stores/new-os.store';
import { Colors, Radii } from '@/constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step4ReviewProps {
  onConfirm: (startChecklist: boolean) => Promise<void>;
  onBack: () => void;
  isCreating: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  insurer: 'Seguradora',
  private: 'Particular',
};

const OS_TYPE_LABELS: Record<OSType, string> = {
  bodywork: 'Lataria/Pintura',
  warranty: 'Garantia',
  rework: 'Retrabalho',
  mechanical: 'Mecânica',
  aesthetic: 'Estética',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Step4Review({ onConfirm, onBack, isCreating, error }: Step4ReviewProps): React.JSX.Element {
  const vehiclePlate = useNewOSStore((s) => s.vehiclePlate);
  const vehicleInfo = useNewOSStore((s) => s.vehicleInfo);
  const vehicleManualBrand = useNewOSStore((s) => s.vehicleManualBrand);
  const vehicleManualModel = useNewOSStore((s) => s.vehicleManualModel);
  const vehicleManualYear = useNewOSStore((s) => s.vehicleManualYear);
  const vehicleManualColor = useNewOSStore((s) => s.vehicleManualColor);
  const plateSource = useNewOSStore((s) => s.plateSource);
  const customer = useNewOSStore((s) => s.customer);
  const customerManualName = useNewOSStore((s) => s.customerManualName);
  const customerSource = useNewOSStore((s) => s.customerSource);
  const customerType = useNewOSStore((s) => s.customerType);
  const osType = useNewOSStore((s) => s.osType);
  const insurer = useNewOSStore((s) => s.insurer);
  const insuredType = useNewOSStore((s) => s.insuredType);
  const claimNumber = useNewOSStore((s) => s.claimNumber);
  const deductible = useNewOSStore((s) => s.deductible);

  // Derived vehicle display values
  const displayBrand = vehicleInfo?.brand ?? vehicleManualBrand;
  const displayModel = vehicleInfo?.model ?? vehicleManualModel;
  const displayYear = vehicleInfo?.year != null && vehicleInfo.year > 0 ? String(vehicleInfo.year) : vehicleManualYear;
  const displayColor = vehicleInfo?.color ?? vehicleManualColor;
  const plateBadgeLabel = plateSource === 'api' ? 'API' : 'Manual';

  // Derived customer display values
  const displayCustomerName = customer?.name ?? customerManualName;
  const customerBadgeLabel = customerSource === 'search' ? 'Cadastro' : 'Novo';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Step label */}
      <Text variant="bodySmall" color={Colors.textTertiary}>
        Passo 4 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Revisão
      </Text>

      {/* Vehicle card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color={Colors.textTertiary}>
          VEÍCULO
        </Text>
        <Text style={styles.plateText}>
          {vehiclePlate.toUpperCase()}
        </Text>
        {(displayBrand || displayModel) ? (
          <Text variant="body" color={Colors.textPrimary}>
            {[displayBrand, displayModel].filter(Boolean).join(' ')}
            {displayYear ? ` · ${displayYear}` : ''}
          </Text>
        ) : null}
        {displayColor ? (
          <Text variant="bodySmall" color={Colors.textTertiary}>
            {displayColor}
          </Text>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plateBadgeLabel}</Text>
        </View>
      </View>

      {/* Customer card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color={Colors.textTertiary}>
          CLIENTE
        </Text>
        <Text variant="body" color={Colors.textPrimary} style={styles.customerName}>
          {displayCustomerName}
        </Text>
        {customer?.cpf_masked ? (
          <Text variant="bodySmall" color={Colors.textTertiary}>
            {customer.cpf_masked}
          </Text>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{customerBadgeLabel}</Text>
        </View>
      </View>

      {/* Service card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color={Colors.textTertiary}>
          SERVIÇO
        </Text>
        <Text variant="body" color={Colors.textPrimary}>
          {CUSTOMER_TYPE_LABELS[customerType]}
        </Text>
        <Text variant="body" color={Colors.textPrimary}>
          {OS_TYPE_LABELS[osType]}
        </Text>
        {insurer !== null && (
          <Text variant="bodySmall" color={Colors.textTertiary}>{insurer.displayName}</Text>
        )}
        {insuredType !== null && (
          <Text variant="bodySmall" color={Colors.textTertiary}>
            {insuredType === 'insured' ? 'Segurado' : 'Terceiro'}
          </Text>
        )}
        {claimNumber.length > 0 && (
          <Text variant="bodySmall" color={Colors.textTertiary}>
            Sinistro: {claimNumber}
          </Text>
        )}
        {customerType === 'insurer' && deductible.length > 0 ? (
          <Text variant="bodySmall" color={Colors.textTertiary}>Franquia: R$ {deductible}</Text>
        ) : null}
      </View>

      {/* Error */}
      {error !== null && (
        <Text variant="bodySmall" color={Colors.brand} style={styles.errorText}>
          {error}
        </Text>
      )}

      {/* Loading indicator */}
      {isCreating && (
        <ActivityIndicator color={Colors.brand} style={styles.spinner} />
      )}

      {/* Primary: Criar OS e Iniciar Checklist */}
      <TouchableOpacity
        style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
        onPress={() => onConfirm(true)}
        disabled={isCreating}
        activeOpacity={0.8}
      >
        <Text variant="label" color={Colors.textPrimary}>
          Criar OS e Iniciar Checklist
        </Text>
      </TouchableOpacity>

      {/* Secondary: Criar OS */}
      <TouchableOpacity
        style={[styles.secondaryButton, isCreating && styles.buttonDisabled]}
        onPress={() => onConfirm(false)}
        disabled={isCreating}
        activeOpacity={0.8}
      >
        <Text variant="label" color={Colors.brand}>
          Criar OS
        </Text>
      </TouchableOpacity>

      {/* Back link */}
      <TouchableOpacity
        onPress={onBack}
        disabled={isCreating}
        style={[styles.backLink, isCreating && { opacity: 0.4 }]}
        activeOpacity={0.7}
      >
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  plateText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  customerName: {
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  errorText: {
    textAlign: 'center',
  },
  spinner: {
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e31b1b',
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
