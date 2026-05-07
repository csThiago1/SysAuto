import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radii, Spacing, SemanticColors } from '@/constants/theme';

import { useConnectivity } from '@/hooks/useConnectivity';
import { useCreateServiceOrder, type CreateOSPayload } from '@/hooks/useCreateServiceOrder';
import { useNewOSStore } from '@/stores/new-os.store';
import { Step1Vehicle } from '@/components/nova-os/Step1Vehicle';
import { Step2Customer } from '@/components/nova-os/Step2Customer';
import { Step3OSType } from '@/components/nova-os/Step3OSType';
import { Step4Review } from '@/components/nova-os/Step4Review';
import { Text } from '@/components/ui/Text';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast.store';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NovaOSScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useConnectivity();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const { create, isCreating, error } = useCreateServiceOrder();

  const handleBack = useCallback((): void => {
    if (activeStep === 0) {
      setShowBackConfirm(true);
    } else {
      setActiveStep((prev) => prev - 1);
    }
  }, [activeStep]);

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
        insurerId: store.customerType === 'insurer' ? (store.insurer?.id ?? undefined) : undefined,
        insuredType: store.customerType === 'insurer' ? (store.insuredType ?? undefined) : undefined,
        casualtyNumber: store.customerType === 'insurer' ? (store.claimNumber || undefined) : undefined,
        deductibleAmount:
          store.customerType === 'insurer' && store.deductible
            ? parseFloat(store.deductible)
            : undefined,
      };
      try {
        const result = await create(payload);
        if (result !== null) {
          toast.success('OS criada com sucesso');
          store.reset();
          if (startChecklist) {
            router.push(`/checklist/${result.localId}` as never);
          } else {
            router.replace('/(app)' as never);
          }
        }
      } catch {
        toast.error('Erro ao criar OS. Tente novamente.');
      }
    },
    [create, router],
  );

  return (
    <View style={styles.safe}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.bgHeader, Colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova OS</Text>
          <View style={styles.headerSpacer} />
        </View>
        <StepIndicator
          current={activeStep}
          total={4}
          labels={['Veículo', 'Cliente', 'Tipo da OS', 'Revisão']}
        />
      </LinearGradient>

      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.warning} />
          <Text variant="caption" color={Colors.warning}>
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

      <ConfirmDialog
        visible={showBackConfirm}
        title="Descartar OS?"
        message="Os dados preenchidos serão perdidos. Deseja sair?"
        confirmLabel="Sair"
        cancelLabel="Continuar"
        variant="danger"
        onConfirm={() => {
          setShowBackConfirm(false);
          useNewOSStore.getState().reset();
          router.back();
        }}
        onCancel={() => setShowBackConfirm(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.warning.bg,
  },
  stepContainer: {
    flex: 1,
  },
});
