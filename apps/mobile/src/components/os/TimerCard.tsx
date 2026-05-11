import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';

interface TimerCardProps {
  tecnicoName: string;
  iniciadoEm: string;
  onEncerrar: () => void;
  isLoading: boolean;
}

function formatElapsed(startIso: string): string {
  const diff = Date.now() - new Date(startIso).getTime();
  if (diff < 0) return '00:00:00';
  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerCard({ tecnicoName, iniciadoEm, onEncerrar, isLoading }: TimerCardProps): React.JSX.Element {
  const [elapsed, setElapsed] = useState(formatElapsed(iniciadoEm));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(iniciadoEm));
    }, 1000);
    return () => clearInterval(interval);
  }, [iniciadoEm]);

  return (
    <View style={styles.card}>
      <View style={styles.dot} />
      <View style={styles.info}>
        <Text style={styles.name}>{tecnicoName}</Text>
        <Text style={styles.timer}>{elapsed}</Text>
      </View>
      <Button
        label="Encerrar"
        variant="secondary"
        onPress={onEncerrar}
        loading={isLoading}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.success.bg,
    borderWidth: 1,
    borderColor: SemanticColors.success.border,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SemanticColors.success.color,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  timer: {
    fontSize: 22, fontWeight: '800', color: SemanticColors.success.color,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  btn: { minWidth: 90 },
});
