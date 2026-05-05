import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Typography } from '@/constants/theme';

interface SectionDividerProps {
  label: string;
  style?: ViewStyle;
}

export function SectionDivider({ label, style }: SectionDividerProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  label: {
    ...Typography.labelMono,
  },
  line: {
    flex: 1,
    height: Math.max(StyleSheet.hairlineWidth, 0.5),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
