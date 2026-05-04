import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { Text } from './Text';
import { Typography, Colors } from '@/constants/theme';

interface MonoLabelProps {
  children: string;
  variant?: 'default' | 'accent';
  size?: 'sm' | 'md';
  style?: TextStyle;
}

export function MonoLabel({
  children,
  variant = 'default',
  size = 'md',
  style,
}: MonoLabelProps): React.JSX.Element {
  return (
    <Text
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        variant === 'accent' && styles.accent,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...Typography.mono,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sm: {
    fontSize: 12,
  },
  accent: {
    color: '#cc4444',
    fontWeight: '600',
  },
});
