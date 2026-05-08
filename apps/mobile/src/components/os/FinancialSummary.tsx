import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Colors, Spacing } from '@/constants/theme';

interface FinancialSummaryProps {
  partsTotal: number;
  laborTotal: number;
  discountPercent: number;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function FinancialSummary({ partsTotal, laborTotal, discountPercent }: FinancialSummaryProps): React.JSX.Element {
  const subtotal = partsTotal + laborTotal;
  const discountValue = subtotal * (discountPercent / 100);
  const total = subtotal - discountValue;

  return (
    <>
      <SectionDivider label="RESUMO FINANCEIRO" />
      <Card>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Peças</Text>
          <Text variant="mono">{formatBRL(partsTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Serviços</Text>
          <Text variant="mono">{formatBRL(laborTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Subtotal</Text>
          <Text variant="mono">{formatBRL(subtotal)}</Text>
        </View>
        {discountPercent > 0 && (
          <View style={styles.row}>
            <Text variant="body" color={Colors.textSecondary}>Desconto ({discountPercent}%)</Text>
            <Text variant="mono" color={Colors.error}>- {formatBRL(discountValue)}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text variant="heading3">TOTAL</Text>
          <Text variant="heading3">{formatBRL(total)}</Text>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
});
