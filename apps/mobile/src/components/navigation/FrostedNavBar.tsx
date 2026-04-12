// apps/mobile/src/components/navigation/FrostedNavBar.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';

// ─── Tab configuration ─────────────────────────────────────────────────────

interface TabConfig {
  routeName: string;
  iconInactive: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
  isCentral?: boolean;
}

const TAB_CONFIG: TabConfig[] = [
  {
    routeName: 'index',
    iconInactive: 'list-outline',
    iconActive: 'list',
    label: 'OS',
  },
  {
    routeName: 'busca/index',
    iconInactive: 'search-outline',
    iconActive: 'search',
    label: 'Busca',
  },
  {
    routeName: 'nova-os/index',
    iconInactive: 'add-circle-outline',
    iconActive: 'add-circle',
    label: 'Nova OS',
    isCentral: true,
  },
  {
    routeName: 'notificacoes/index',
    iconInactive: 'notifications-outline',
    iconActive: 'notifications',
    label: 'Alertas',
  },
  {
    routeName: 'perfil/index',
    iconInactive: 'person-outline',
    iconActive: 'person',
    label: 'Perfil',
  },
];

const HIDDEN_ROUTES = new Set(['os', 'checklist', 'camera']);

// Flex ratios — must match StyleSheet below
const NORMAL_FLEX = 1;
const CENTRAL_FLEX = 1.2;
const TOTAL_FLEX = NORMAL_FLEX * 4 + CENTRAL_FLEX; // 5.2

function tabWidth(config: TabConfig, containerWidth: number): number {
  return config.isCentral
    ? (CENTRAL_FLEX / TOTAL_FLEX) * containerWidth
    : (NORMAL_FLEX / TOTAL_FLEX) * containerWidth;
}

// ─── TabItem ───────────────────────────────────────────────────────────────

interface TabItemProps {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ config, isActive, onPress }: TabItemProps): React.JSX.Element {
  // Fix 2: separate pressScale + restingScale for persistent active scale 1.05
  const pressScale = useSharedValue(1);
  // Must be keyed by route.key in the parent so useSharedValue re-initializes on route change
  const restingScale = useSharedValue(isActive ? 1.05 : 1);

  // Fix 6: maxWidth target 56 → 60
  const labelMaxWidth = useSharedValue(isActive && !config.isCentral ? 60 : 0);
  const labelOpacity = useSharedValue(isActive && !config.isCentral ? 1 : 0);

  useEffect(() => {
    restingScale.value = withTiming(isActive ? 1.05 : 1, { duration: 200 });
  }, [isActive, restingScale]);

  useEffect(() => {
    if (config.isCentral) return; // central never shows label
    // Fix 6: maxWidth target 60
    labelMaxWidth.value = withSpring(isActive ? 60 : 0, {
      damping: 20,
      stiffness: 200,
    });
    labelOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, labelMaxWidth, labelOpacity, config.isCentral]);

  const handlePress = useCallback((): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Fix 2: use pressScale for bounce
    pressScale.value = withSpring(0.92, { damping: 10, stiffness: 300 }, () => {
      pressScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    onPress();
  }, [pressScale, onPress]);

  // Fix 2: combined style multiplies pressScale * restingScale
  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * restingScale.value }],
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    maxWidth: labelMaxWidth.value,
    opacity: labelOpacity.value,
  }));

  const iconColor = config.isCentral
    ? '#ffffff'
    : isActive
    ? 'rgba(255,255,255,0.95)'
    : '#94a3b8';
  const iconSize = config.isCentral ? 28 : 22;
  const iconName = isActive ? config.iconActive : config.iconInactive;

  return (
    <TouchableOpacity
      style={[styles.tabItem, config.isCentral && styles.centralTabItem]}
      onPress={handlePress}
      activeOpacity={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.tabContent}>
        <Animated.View style={iconAnimStyle}>
          <Ionicons name={iconName} size={iconSize} color={iconColor} />
        </Animated.View>
        {!config.isCentral && (
          <Animated.View style={[styles.labelWrapper, labelAnimStyle]}>
            <Text
              variant="caption"
              color={iconColor}
              style={styles.tabLabel}
              numberOfLines={1}
            >
              {config.label}
            </Text>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── FrostedNavBar ─────────────────────────────────────────────────────────

export function FrostedNavBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const bubbleX = useSharedValue(0);
  const bubbleW = useSharedValue(0);

  const visibleRoutes = useMemo(
    () => state.routes.filter((r) => !HIDDEN_ROUTES.has(r.name)),
    [state.routes],
  );

  const activeRouteName = state.routes[state.index]?.name;

  // Fix 4: derive hidden state before hooks finish (non-hook derived value)
  const isHiddenRoute = activeRouteName !== undefined && HIDDEN_ROUTES.has(activeRouteName);

  // Animate bubble to the active tab
  useEffect(() => {
    if (containerWidth === 0) return;

    const activeVisibleIdx = visibleRoutes.findIndex(
      (r) => r.name === activeRouteName,
    );
    if (activeVisibleIdx === -1) return;

    const activeCfg = TAB_CONFIG.find(
      (c) => c.routeName === visibleRoutes[activeVisibleIdx]?.name,
    );

    // Fix 1: central button never gets bubble
    if (!activeCfg || activeCfg.isCentral) return;

    let x = 0;
    for (let i = 0; i < activeVisibleIdx; i++) {
      const cfg = TAB_CONFIG.find((c) => c.routeName === visibleRoutes[i]?.name);
      if (cfg) x += tabWidth(cfg, containerWidth);
    }

    const w = tabWidth(activeCfg, containerWidth);

    bubbleX.value = withSpring(x, { damping: 18, stiffness: 160 });
    bubbleW.value = withSpring(w, { damping: 18, stiffness: 160 });
  }, [activeRouteName, containerWidth, visibleRoutes, bubbleX, bubbleW]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }],
    width: bubbleW.value,
  }));

  const handleTabPress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean): void => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  // Fix 4: all hooks have run — safe to return early for hidden routes
  if (isHiddenRoute) {
    return <View style={styles.hiddenPlaceholder} />;
  }

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 8 }]}
      pointerEvents="box-none"
    >
      <View
        style={styles.frostedBar}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Sliding bubble — sits behind tab icons via zIndex */}
        {containerWidth > 0 && (
          <Animated.View style={[styles.bubble, bubbleStyle]} />
        )}

        {visibleRoutes.map((route) => {
          const config = TAB_CONFIG.find((c) => c.routeName === route.name);
          if (!config) return null;
          const isActive = state.routes[state.index]?.name === route.name;
          return (
            <TabItem
              key={route.key}
              config={config}
              isActive={isActive}
              onPress={() => handleTabPress(route.name, route.key, isActive)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  frostedBar: {
    flexDirection: 'row',
    // Fix 3: background alpha 0.72
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 32,
    paddingVertical: 6,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
    // Fix 5: removed Platform.select Android border override
  },
  // Sliding red bubble — absolutely positioned inside frostedBar
  bubble: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#e31b1b',
    borderRadius: 28,
    // Glow — only visible on iOS (elevation doesn't support custom shadow color)
    shadowColor: '#e31b1b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 44,
    zIndex: 1, // above bubble
  },
  centralTabItem: {
    flex: 1.2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelWrapper: {
    overflow: 'hidden',
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 12,
  },
  // Fix 4: placeholder for hidden routes
  hiddenPlaceholder: {
    height: 0,
  },
});
