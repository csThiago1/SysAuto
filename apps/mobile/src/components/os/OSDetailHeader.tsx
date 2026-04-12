import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';

export interface OSDetailHeaderProps {
  number: number;
  status: string;
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  onBack: () => void;
}

export function OSDetailHeader({
  number,
  status,
  plate,
  make,
  model,
  year,
  color,
  onBack,
}: OSDetailHeaderProps): React.JSX.Element {
  const vehicleLine = [make, model, year ? String(year) : undefined, color]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      {/* Barra superior: botao voltar + numero da OS */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text variant="body" color="#e31b1b">
            {'← Ordens de Serviço'}
          </Text>
        </TouchableOpacity>
        <Text variant="label" color="#374151">
          OS #{number}
        </Text>
      </View>

      {/* Placa + badge de status */}
      <View style={styles.plateRow}>
        <Text variant="heading3" style={styles.plate}>
          {plate.toUpperCase()}
        </Text>
        <OSStatusBadge status={status} />
      </View>

      {/* Veiculo */}
      {vehicleLine.length > 0 && (
        <Text variant="bodySmall" color="#6b7280" numberOfLines={1}>
          {vehicleLine}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plate: {
    letterSpacing: 1,
    color: '#111827',
  },
});
