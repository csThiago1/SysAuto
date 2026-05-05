import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useVehicleByPlate } from '@/hooks/useVehicleByPlate';
import { useNewOSStore } from '@/stores/new-os.store';
import { Colors, Radii, SemanticColors, Typography } from '@/constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step1VehicleProps {
  onNext: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step1Vehicle({ onNext }: Step1VehicleProps): React.JSX.Element {
  const isOnline = useConnectivity();
  const { lookup, isLoading, error } = useVehicleByPlate();

  const vehiclePlate = useNewOSStore((s) => s.vehiclePlate);
  const vehicleInfo = useNewOSStore((s) => s.vehicleInfo);
  const vehicleManualBrand = useNewOSStore((s) => s.vehicleManualBrand);
  const vehicleManualModel = useNewOSStore((s) => s.vehicleManualModel);
  const vehicleManualYear = useNewOSStore((s) => s.vehicleManualYear);
  const vehicleManualColor = useNewOSStore((s) => s.vehicleManualColor);
  const plateSource = useNewOSStore((s) => s.plateSource);
  const setVehiclePlate = useNewOSStore((s) => s.setVehiclePlate);
  const setVehicleInfo = useNewOSStore((s) => s.setVehicleInfo);
  const setVehicleManualField = useNewOSStore((s) => s.setVehicleManualField);

  const [lookupAttempted, setLookupAttempted] = useState<boolean>(false);

  const handleLookup = async (): Promise<void> => {
    setLookupAttempted(true);
    try {
      const result = await lookup(vehiclePlate);
      if (result !== null) {
        setVehicleInfo(result, 'api');
      } else {
        // Not found — switch to manual mode
        setVehicleInfo(null, 'manual');
      }
    } catch {
      setVehicleInfo(null, 'manual');
    }
  };

  const handleManualFill = (): void => {
    setVehicleInfo(null, 'manual');
  };

  const showManualFields =
    plateSource === 'manual' || (lookupAttempted && plateSource === null && vehicleInfo === null);

  const isNextDisabled = (): boolean => {
    if (vehiclePlate.trim().length < 7) return true;
    if (showManualFields) {
      return vehicleManualBrand.trim() === '' || vehicleManualModel.trim() === '';
    }
    return false;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text variant="bodySmall" color={SemanticColors.warning.color}>
            Modo offline — preencha manualmente
          </Text>
        </View>
      )}

      {/* Step label */}
      <Text variant="bodySmall" color={Colors.textTertiary}>
        Passo 1 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Veículo
      </Text>

      {/* Plate input */}
      <TextInput
        style={styles.input}
        placeholder="ABC-1234"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="characters"
        maxLength={8}
        value={vehiclePlate}
        onChangeText={setVehiclePlate}
      />

      {/* Lookup button */}
      <TouchableOpacity
        style={[styles.primaryButton, (isLoading || vehiclePlate.trim().length < 7) && styles.buttonDisabled]}
        onPress={handleLookup}
        disabled={isLoading || vehiclePlate.trim().length < 7}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <Text variant="label" color={Colors.textPrimary}>
            Buscar Placa
          </Text>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error !== null && (
        <Text variant="bodySmall" color={Colors.brand} style={styles.errorText}>
          {error}
        </Text>
      )}

      {/* Vehicle info card (API result) */}
      {plateSource === 'api' && vehicleInfo !== null && (
        <View style={styles.vehicleCard}>
          <Text style={Typography.labelMono}>
            Dados encontrados
          </Text>
          <Text variant="body" style={styles.vehicleName}>
            {vehicleInfo.brand} {vehicleInfo.model}
          </Text>
          <Text variant="bodySmall" color={Colors.textTertiary}>
            {vehicleInfo.year} · {vehicleInfo.color}
          </Text>
          <TouchableOpacity onPress={handleManualFill} style={styles.manualLink}>
            <Text variant="bodySmall" color={Colors.brand}>
              Preencher manualmente
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual fields */}
      {showManualFields && (
        <View style={styles.manualSection}>
          <TextInput
            style={styles.input}
            placeholder="Marca"
            placeholderTextColor={Colors.textSecondary}
            value={vehicleManualBrand}
            onChangeText={(v) => setVehicleManualField('brand', v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Modelo"
            placeholderTextColor={Colors.textSecondary}
            value={vehicleManualModel}
            onChangeText={(v) => setVehicleManualField('model', v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Ano"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="numeric"
            maxLength={4}
            value={vehicleManualYear}
            onChangeText={(v) => setVehicleManualField('year', v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Cor"
            placeholderTextColor={Colors.textSecondary}
            value={vehicleManualColor}
            onChangeText={(v) => setVehicleManualField('color', v)}
          />
        </View>
      )}

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.primaryButton, styles.continueButton, isNextDisabled() && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isNextDisabled()}
        activeOpacity={0.8}
      >
        <Text variant="label" color={Colors.textPrimary}>
          Continuar
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
  offlineBanner: {
    backgroundColor: SemanticColors.warning.bg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.warning.border,
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
  primaryButton: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.md,
    padding: 14,
    alignItems: 'center',
  },
  continueButton: {
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    marginTop: 4,
  },
  vehicleCard: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderTopColor: Colors.borderGlintTop,
    borderRightColor: Colors.borderGlintSide,
    borderBottomColor: Colors.borderGlintBottom,
    borderLeftColor: Colors.brand,
    borderLeftWidth: 3,
    borderRadius: Radii.md,
    padding: 14,
    gap: 4,
  },
  vehicleName: {
    fontWeight: '600',
  },
  manualLink: {
    marginTop: 8,
  },
  manualSection: {
    gap: 12,
  },
});
