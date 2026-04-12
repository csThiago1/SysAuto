import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  onBack: () => void; // kept for API compat but no longer renders a button
}

export function OSDetailHeader({
  number,
  status,
  plate,
  make,
  model,
  year,
  color,
}: OSDetailHeaderProps): React.JSX.Element {
  const vehicleLine = [make, model, year ? String(year) : undefined, color]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      {/* Número da OS + badge de status */}
      <View style={styles.topBar}>
        <Text variant="label" color="#374151">
          OS #{number}
        </Text>
        <OSStatusBadge status={status} />
      </View>

      {/* Placa */}
      <Text variant="heading3" style={styles.plate}>
        {plate.toUpperCase()}
      </Text>

      {/* Veículo */}
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
  plate: {
    letterSpacing: 1,
    color: '#111827',
  },
});
