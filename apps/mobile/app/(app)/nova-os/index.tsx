import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useConnectivity } from '@/hooks/useConnectivity';
import { useCreateServiceOrder, type CreateOSPayload } from '@/hooks/useCreateServiceOrder';
import { useNewOSStore } from '@/stores/new-os.store';
import { Step1Vehicle } from '@/components/nova-os/Step1Vehicle';
import { Step2Customer } from '@/components/nova-os/Step2Customer';
import { Step3OSType } from '@/components/nova-os/Step3OSType';
import { Step4Review } from '@/components/nova-os/Step4Review';
import { Text } from '@/components/ui/Text';

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }): React.JSX.Element {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NovaOSScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useConnectivity();
  const [activeStep, setActiveStep] = useState<number>(0);
  const { create, isCreating, error } = useCreateServiceOrder();

  const handleBack = useCallback((): void => {
    setActiveStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleConfirm = useCallback(
    async (startChecklist: boolean): Promise<void> => {
      const store = useNewOSStore.getState();
      const payload: CreateOSPayload = {
        customerName: store.customer?.name ?? store.customerManualName,
        customerId: store.customer?.id,
        vehiclePlate: store.vehiclePlate,
        vehicleBrand: store.vehicleInfo?.brand ?? store.vehicleManualBrand,
        vehicleModel: store.vehicleInfo?.model ?? store.vehicleManualModel,
        vehicleYear: store.vehicleInfo
          ? store.vehicleInfo.year
          : store.vehicleManualYear
          ? parseInt(store.vehicleManualYear, 10)
          : undefined,
        vehicleColor: (store.vehicleInfo?.color ?? store.vehicleManualColor) || undefined,
        customerType: store.customerType,
        osType: store.osType,
        insurerName: store.customerType === 'insurer' ? store.insurerName : undefined,
        claimNumber: store.customerType === 'insurer' ? store.claimNumber : undefined,
        deductible:
          store.customerType === 'insurer' && store.deductible
            ? parseFloat(store.deductible)
            : undefined,
      };
      const result = await create(payload);
      if (result !== null) {
        store.reset();
        if (startChecklist) {
          router.push(`/checklist/${result.localId}` as never);
        } else {
          router.replace('/(app)' as never);
        }
      }
    },
    [create],
  );

  return (
    <View style={styles.safe}>
      {/* Header */}
      <LinearGradient
        colors={['#1c1c1e', '#141414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          {activeStep > 0 ? (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle}>Nova OS</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ProgressBar step={activeStep} total={4} />
      </LinearGradient>

      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#92400e" />
          <Text variant="caption" color="#92400e">
            {' '}Modo offline — OS será sincronizada ao reconectar
          </Text>
        </View>
      )}

      {/* Steps */}
      <View style={styles.stepContainer}>
        {activeStep === 0 && <Step1Vehicle onNext={() => setActiveStep(1)} />}
        {activeStep === 1 && (
          <Step2Customer onNext={() => setActiveStep(2)} onBack={() => setActiveStep(0)} />
        )}
        {activeStep === 2 && (
          <Step3OSType onNext={() => setActiveStep(3)} onBack={() => setActiveStep(1)} />
        )}
        {activeStep === 3 && (
          <Step4Review
            onConfirm={handleConfirm}
            onBack={() => setActiveStep(2)}
            isCreating={isCreating}
            error={error}
          />
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3a3a3c',
  },
  progressSegmentActive: {
    backgroundColor: '#e31b1b',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fef3c7',
  },
  stepContainer: {
    flex: 1,
  },
});
