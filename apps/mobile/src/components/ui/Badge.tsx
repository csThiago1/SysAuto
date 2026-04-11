import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

// Status de OS espelhando VALID_TRANSITIONS do backend
type OSStatus =
  | 'OPEN'
  | 'WAITING_PARTS'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

interface BadgeProps {
  status: OSStatus;
}

const STATUS_CONFIG: Record<
  OSStatus,
  { label: string; backgroundColor: string; color: string }
> = {
  OPEN: { label: 'Aberta', backgroundColor: '#dbeafe', color: '#1d4ed8' },
  WAITING_PARTS: { label: 'Aguard. Peças', backgroundColor: '#fef3c7', color: '#b45309' },
  IN_PROGRESS: { label: 'Em Andamento', backgroundColor: '#dcfce7', color: '#15803d' },
  WAITING_APPROVAL: { label: 'Aguard. Aprovação', backgroundColor: '#f3e8ff', color: '#7e22ce' },
  APPROVED: { label: 'Aprovada', backgroundColor: '#d1fae5', color: '#065f46' },
  READY: { label: 'Pronta', backgroundColor: '#e0f2fe', color: '#0369a1' },
  DELIVERED: { label: 'Entregue', backgroundColor: '#f0fdf4', color: '#166534' },
  CANCELLED: { label: 'Cancelada', backgroundColor: '#fee2e2', color: '#991b1b' },
};

export function Badge({ status }: BadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text variant="caption" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
