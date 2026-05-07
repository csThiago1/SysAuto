import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { Colors, SemanticColors, Radii, Spacing } from '@/constants/theme';
import { useToastStore, type ToastItem, type ToastVariant } from '@/stores/toast.store';

const ICON_MAP: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

function ToastCard({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    // Haptic on mount
    if (item.variant === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (item.variant === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Animate in
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });

    // Animate out after duration
    opacity.value = withDelay(
      item.duration,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(remove)(item.id);
      }),
    );
    translateY.value = withDelay(
      item.duration,
      withTiming(-20, { duration: 300 }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const semantic = SemanticColors[item.variant];

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: semantic.bg, borderColor: semantic.border },
        animatedStyle,
      ]}
    >
      <Ionicons name={ICON_MAP[item.variant]} size={18} color={semantic.color} />
      <Text variant="bodySmall" style={[styles.message, { color: semantic.color }]}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

export function Toast() {
  const items = useToastStore((s) => s.items);
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.container, { top: insets.top + Spacing.sm }]}
      pointerEvents="none"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  message: {
    flex: 1,
  },
});
