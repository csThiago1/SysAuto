import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

interface GlowEffectProps {
  style?: AnimatedStyle<ViewStyle>;
}

export function GlowEffect({ style }: GlowEffectProps) {
  const animatedStyle = [styles.glow, style] as unknown as React.ComponentProps<typeof Animated.View>['style'];
  return <Animated.View style={animatedStyle} />;
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(227, 27, 27, 0.3)',
    alignSelf: 'center',
  },
});
