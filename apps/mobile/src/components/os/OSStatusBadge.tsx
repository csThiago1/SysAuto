import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';

// Status alinhados com os valores do backend (lowercase snake_case)
const STATUS_CONFIG: Record<string, { label: string; color: string; backgroundColor: string }> = {
  reception: { label: 'Recepcao', color: '#1d4ed8', backgroundColor: '#dbeafe' },
  initial_survey: { label: 'Vistoria Inicial', color: '#6d28d9', backgroundColor: '#ede9fe' },
  budget: { label: 'Orcamento', color: '#b45309', backgroundColor: '#fef3c7' },
  waiting_approval: { label: 'Aguard. Aprovacao', color: '#c2410c', backgroundColor: '#ffedd5' },
  approved: { label: 'Aprovado', color: '#065f46', backgroundColor: '#d1fae5' },
  in_progress: { label: 'Em Andamento', color: '#0e7490', backgroundColor: '#cffafe' },
  waiting_parts: { label: 'Aguard. Pecas', color: '#475569', backgroundColor: '#f1f5f9' },
  final_survey: { label: 'Vistoria Final', color: '#6d28d9', backgroundColor: '#ede9fe' },
  ready: { label: 'Pronto', color: '#166534', backgroundColor: '#dcfce7' },
  delivered: { label: 'Entregue', color: '#374151', backgroundColor: '#f3f4f6' },
  cancelled: { label: 'Cancelado', color: '#991b1b', backgroundColor: '#fee2e2' },
};

const FALLBACK_CONFIG = { label: 'Desconhecido', color: '#374151', backgroundColor: '#f3f4f6' };

interface OSStatusBadgeProps {
  status: string;
}

export function OSStatusBadge({ status }: OSStatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status] ?? FALLBACK_CONFIG;

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text variant="caption" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

// Utilitario para obter a cor primaria de um status (usado pelos chips de filtro)
export function getStatusColor(status: string): string {
  return STATUS_CONFIG[status]?.color ?? FALLBACK_CONFIG.color;
}

// Utilitario para obter o background de um status (usado pelos chips selecionados)
export function getStatusBackgroundColor(status: string): string {
  return STATUS_CONFIG[status]?.backgroundColor ?? FALLBACK_CONFIG.backgroundColor;
}

// Utilitario para obter o label de um status
export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? FALLBACK_CONFIG.label;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
