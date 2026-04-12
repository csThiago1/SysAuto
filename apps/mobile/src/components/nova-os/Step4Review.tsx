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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step4ReviewProps {
  onConfirm: (startChecklist: boolean) => void;
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
  const insurerName = useNewOSStore((s) => s.insurerName);
  const claimNumber = useNewOSStore((s) => s.claimNumber);

  // Derived vehicle display values
  const displayBrand = vehicleInfo?.brand ?? vehicleManualBrand;
  const displayModel = vehicleInfo?.model ?? vehicleManualModel;
  const displayYear = vehicleInfo?.year !== undefined ? String(vehicleInfo.year) : vehicleManualYear;
  const displayColor = vehicleInfo?.color ?? vehicleManualColor;
  const plateBadgeLabel = plateSource === 'api' ? 'Consultado' : 'Manual';

  // Derived customer display values
  const displayCustomerName = customer?.name ?? customerManualName;
  const customerBadgeLabel = customerSource === 'search' ? 'Cadastrado' : 'Novo';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Step label */}
      <Text variant="bodySmall" color="#6b7280">
        Passo 4 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Revisão
      </Text>

      {/* Vehicle card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color="#6b7280">
          VEÍCULO
        </Text>
        <Text style={styles.plateText}>
          {vehiclePlate.toUpperCase()}
        </Text>
        {(displayBrand || displayModel) ? (
          <Text variant="body" color="#374151">
            {[displayBrand, displayModel].filter(Boolean).join(' ')}
            {displayYear ? ` · ${displayYear}` : ''}
          </Text>
        ) : null}
        {displayColor ? (
          <Text variant="bodySmall" color="#6b7280">
            {displayColor}
          </Text>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plateBadgeLabel}</Text>
        </View>
      </View>

      {/* Customer card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color="#6b7280">
          CLIENTE
        </Text>
        <Text variant="body" color="#374151" style={styles.customerName}>
          {displayCustomerName}
        </Text>
        {customer?.cpf_masked ? (
          <Text variant="bodySmall" color="#6b7280">
            {customer.cpf_masked}
          </Text>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{customerBadgeLabel}</Text>
        </View>
      </View>

      {/* Service card */}
      <View style={styles.summaryCard}>
        <Text variant="label" color="#6b7280">
          SERVIÇO
        </Text>
        <Text variant="body" color="#374151">
          {CUSTOMER_TYPE_LABELS[customerType]}
        </Text>
        <Text variant="body" color="#374151">
          {OS_TYPE_LABELS[osType]}
        </Text>
        {insurerName.length > 0 && (
          <Text variant="bodySmall" color="#6b7280">
            {insurerName}
          </Text>
        )}
        {claimNumber.length > 0 && (
          <Text variant="bodySmall" color="#6b7280">
            Sinistro: {claimNumber}
          </Text>
        )}
      </View>

      {/* Error */}
      {error !== null && (
        <Text variant="bodySmall" color="#e31b1b" style={styles.errorText}>
          {error}
        </Text>
      )}

      {/* Loading indicator */}
      {isCreating && (
        <ActivityIndicator color="#e31b1b" style={styles.spinner} />
      )}

      {/* Primary: Criar OS e Iniciar Checklist */}
      <TouchableOpacity
        style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
        onPress={() => onConfirm(true)}
        disabled={isCreating}
        activeOpacity={0.8}
      >
        <Text variant="label" color="#ffffff">
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
        <Text variant="label" color="#e31b1b">
          Criar OS
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
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  plateText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#1a1a1a',
  },
  customerName: {
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
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
