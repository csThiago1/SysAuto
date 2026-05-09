import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';

// ─── OSDetailSkeleton ──────────────────────────────────────────────────────

export function OSDetailSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      <ShimmerBlock height={80} />
      <ShimmerBlock height={140} />
      <ShimmerBlock height={100} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  skeletonContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
