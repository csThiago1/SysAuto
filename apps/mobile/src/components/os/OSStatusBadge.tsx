import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/theme';

// Status alinhados com os valores do backend (lowercase snake_case)
const STATUS_CONFIG: Record<string, { label: string; color: string; backgroundColor: string }> = {
  reception:      { label: 'Recepção',               color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  initial_survey: { label: 'Vistoria Inicial',        color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.15)' },
  budget:         { label: 'Orçamento',               color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  waiting_auth:   { label: 'Aguard. Autorização',     color: '#fb923c', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
  authorized:     { label: 'Autorizada',              color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.15)' },
  waiting_parts:  { label: 'Aguard. Peças',           color: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.12)' },
  repair:         { label: 'Reparo',                  color: '#22d3ee', backgroundColor: 'rgba(6, 182, 212, 0.15)' },
  mechanic:       { label: 'Mecânica',                color: '#38bdf8', backgroundColor: 'rgba(14, 165, 233, 0.15)' },
  bodywork:       { label: 'Funilaria',               color: '#fb923c', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
  painting:       { label: 'Pintura',                 color: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.15)' },
  assembly:       { label: 'Montagem',                color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  polishing:      { label: 'Polimento',               color: '#22d3ee', backgroundColor: 'rgba(6, 182, 212, 0.15)' },
  washing:        { label: 'Lavagem',                 color: '#22d3ee', backgroundColor: 'rgba(6, 182, 212, 0.12)' },
  final_survey:   { label: 'Vistoria Final',          color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.15)' },
  ready:          { label: 'Pronto p/ Entrega',       color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  delivered:      { label: 'Entregue',                color: Colors.textPrimary, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  cancelled:      { label: 'Cancelada',               color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.15)' },
};

const FALLBACK_CONFIG = { label: 'Desconhecido', color: Colors.textPrimary, backgroundColor: Colors.bg };

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
