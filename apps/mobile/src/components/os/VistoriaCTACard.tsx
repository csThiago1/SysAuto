import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, SemanticColors } from '@/constants/theme';

// ─── VistoriaCTACard ───────────────────────────────────────────────────────

export interface VistoriaCTACardProps {
  type: 'entrada' | 'saida';
  osId: string;
}

export function VistoriaCTACard({ type, osId }: VistoriaCTACardProps): React.JSX.Element {
  const router = useRouter();
  const isEntrada = type === 'entrada';
  const semantic = isEntrada ? SemanticColors.info : SemanticColors.success;
  const bg = semantic.bg;
  const borderColor = semantic.border;
  const color = isEntrada ? Colors.info : Colors.success;
  const icon: React.ComponentProps<typeof Ionicons>['name'] = isEntrada ? 'search-outline' : 'checkmark-done-outline';
  const title = isEntrada ? 'Iniciar Vistoria de Entrada' : 'Iniciar Vistoria de Saída';
  const description = isEntrada
    ? 'Registre o estado do veículo na entrada: fotos e checklist completo.'
    : 'Confirme os reparos realizados com comparativo antes/depois.';

  const handlePress = (): void => {
    const path = isEntrada
      ? `/(app)/vistoria/entrada/${osId}`
      : `/(app)/vistoria/saida/${osId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(path as any);
  };

  return (
    <TouchableOpacity
      style={[styles.vstCard, { backgroundColor: bg, borderColor }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.vstCardIcon}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.vstCardBody}>
        <Text variant="label" style={[styles.vstCardTitle, { color }]}>
          {title}
        </Text>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.vstCardDesc}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  vstCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  vstCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vstCardBody: {
    flex: 1,
    gap: 2,
  },
  vstCardTitle: {
    fontWeight: '700',
  },
  vstCardDesc: {
    lineHeight: 18,
  },
});
