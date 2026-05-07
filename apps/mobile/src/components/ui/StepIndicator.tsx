import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Colors, Spacing, Radii, Typography } from '@/constants/theme';

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
}

export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {/* Step dots with connecting lines */}
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => {
          const isCompleted = i < current;
          const isActive = i === current;
          const isLast = i === total - 1;

          return (
            <React.Fragment key={i}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isActive && styles.dotActive,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color={Colors.textPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.dotNumber,
                      isActive && styles.dotNumberActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, isCompleted && styles.lineCompleted]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Label */}
      <Text style={styles.label}>
        {labels?.[current] ?? `Passo ${current + 1} de ${total}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  dotActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  dotNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  dotNumberActive: {
    color: Colors.brand,
  },
  line: {
    width: 24,
    height: 2,
    backgroundColor: Colors.border,
  },
  lineCompleted: {
    backgroundColor: Colors.brand,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textSecondary,
  },
});
