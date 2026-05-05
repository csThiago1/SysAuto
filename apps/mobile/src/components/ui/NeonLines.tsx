import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Colors } from '@/constants/theme';

// ── Config ───────────────────────────────────────────────────────────────────

interface LineConfig {
  direction: 'h' | 'v';
  /** Position as percentage (0–1) of the cross-axis */
  position: number;
  /** Animation duration in ms */
  duration: number;
  /** Animation delay in ms */
  delay: number;
  opacity: number;
}

const DEFAULT_LINES: LineConfig[] = [
  // Horizontais
  { direction: 'h', position: 0.12, duration: 4200, delay: 0,    opacity: 0.6 },
  { direction: 'h', position: 0.30, duration: 3800, delay: 1200, opacity: 0.5 },
  { direction: 'h', position: 0.48, duration: 5000, delay: 600,  opacity: 0.55 },
  { direction: 'h', position: 0.66, duration: 4500, delay: 2000, opacity: 0.45 },
  { direction: 'h', position: 0.82, duration: 3600, delay: 300,  opacity: 0.6 },
  { direction: 'h', position: 0.93, duration: 4800, delay: 1800, opacity: 0.4 },
  // Verticais
  { direction: 'v', position: 0.18, duration: 4000, delay: 800,  opacity: 0.5 },
  { direction: 'v', position: 0.42, duration: 3500, delay: 1500, opacity: 0.55 },
  { direction: 'v', position: 0.65, duration: 4800, delay: 200,  opacity: 0.45 },
  { direction: 'v', position: 0.85, duration: 3800, delay: 2200, opacity: 0.5 },
];

const LINE_LENGTH = 140;
const LINE_THICKNESS = 0.5;
const NEON_COLOR = Typography.labelMono.color; // '#cc4444'
const NEON_BRIGHT = Colors.brand; // '#e31b1b' — vermelho vivo da marca

// ── Single animated line ─────────────────────────────────────────────────────

function NeonLine({ config }: { config: LineConfig }): React.JSX.Element {
  const translate = useRef(new Animated.Value(0)).current;
  const { width: screenW, height: screenH } = Dimensions.get('window');

  const isH = config.direction === 'h';
  const travel = isH ? screenW + LINE_LENGTH * 2 : screenH + LINE_LENGTH * 2;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translate, {
        toValue: travel,
        duration: config.duration,
        delay: config.delay,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [translate, travel, config.duration, config.delay]);

  const posStyle = isH
    ? { top: `${config.position * 100}%` as unknown as number, left: 0 }
    : { left: `${config.position * 100}%` as unknown as number, top: 0 };

  const sizeStyle = isH
    ? { width: LINE_LENGTH, height: LINE_THICKNESS }
    : { width: LINE_THICKNESS, height: LINE_LENGTH };

  const transformStyle = isH
    ? { transform: [{ translateX: Animated.subtract(translate, LINE_LENGTH) }] }
    : { transform: [{ translateY: Animated.subtract(translate, LINE_LENGTH) }] };

  const gradientColors: [string, string, string, string, string] = ['transparent', NEON_COLOR, NEON_BRIGHT, NEON_COLOR, 'transparent'];
  const gradientStart = isH ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 };
  const gradientEnd = isH ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 };

  return (
    <Animated.View
      style={[
        styles.line,
        posStyle,
        sizeStyle,
        { opacity: config.opacity },
        transformStyle,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={gradientStart}
        end={gradientEnd}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── NeonLines container ──────────────────────────────────────────────────────

interface NeonLinesProps {
  lines?: LineConfig[];
}

export function NeonLines({ lines = DEFAULT_LINES }: NeonLinesProps): React.JSX.Element {
  return (
    <View style={styles.container} pointerEvents="none">
      {lines.map((cfg, i) => (
        <NeonLine key={i} config={cfg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    shadowColor: NEON_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
});
