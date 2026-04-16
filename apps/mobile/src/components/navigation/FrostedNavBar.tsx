// apps/mobile/src/components/navigation/FrostedNavBar.tsx

import React, { useCallback, useEffect, useMemo } from 'react';
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
import { Colors, Radii } from '@/constants/theme';

// ─── Tab configuration ─────────────────────────────────────────────────────

interface TabConfig {
  routeName: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  label: string;
  isCentral?: boolean;
}

const TAB_CONFIG: TabConfig[] = [
  {
    // Tabs.Screen name="index" — the OS list entry point declared in _layout.tsx.
    // 'os' is a detail route (href: null) and never appears as a tab route name.
    routeName: 'index',
    iconActive: 'list',
    iconInactive: 'list-outline',
    label: 'OS',
  },
  {
    routeName: 'agenda/index',
    iconActive: 'calendar',
    iconInactive: 'calendar-outline',
    label: 'Agenda',
  },
  {
    routeName: 'nova-os/index',
    iconActive: 'add',
    iconInactive: 'add',
    label: 'Nova OS',
    isCentral: true,
  },
  {
    routeName: 'notificacoes/index',
    iconActive: 'notifications',
    iconInactive: 'notifications-outline',
    label: 'Alertas',
  },
  {
    routeName: 'perfil/index',
    iconActive: 'settings',
    iconInactive: 'settings-outline',
    label: 'Config',
  },
];

// Only routes that should completely hide the nav bar (full-screen sub-screens).
// 'os' is NOT listed here — it is the main OS list screen (app/(app)/os/index.tsx).
// checklist, camera, photo-editor are full-screen flows that suppress the pill.
const HIDDEN_ROUTES = new Set(['checklist', 'camera', 'photo-editor']);

// ─── TabItem ───────────────────────────────────────────────────────────────

interface TabItemProps {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ config, isActive, onPress }: TabItemProps): React.JSX.Element {
  const pressScale = useSharedValue(1);
  const restingScale = useSharedValue(isActive ? 1.05 : 1);
  const lineOpacity = useSharedValue(isActive && !config.isCentral ? 1 : 0);

  useEffect(() => {
    restingScale.value = withTiming(isActive ? 1.05 : 1, { duration: 200 });
  }, [isActive, restingScale]);

  useEffect(() => {
    if (config.isCentral) return;
    lineOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, lineOpacity, config.isCentral]);

  const handlePress = useCallback((): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressScale.value = withSpring(0.92, { damping: 10, stiffness: 300 }, () => {
      pressScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    onPress();
  }, [pressScale, onPress]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * restingScale.value }],
  }));

  const lineAnimStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
  }));

  if (config.isCentral) {
    return (
      <TouchableOpacity
        style={styles.centralItem}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityRole="tab"
        accessibilityLabel={config.label}
        accessibilityState={{ selected: isActive }}
      >
        <Animated.View style={[styles.centralButton, iconAnimStyle]}>
          <Ionicons name="add" size={22} color={Colors.textPrimary} />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  const iconColor = isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';
  const iconName = isActive ? config.iconActive : config.iconInactive;

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={handlePress}
      activeOpacity={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={[styles.iconWrapper, iconAnimStyle]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
        <Animated.View style={[styles.activeLine, lineAnimStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── FrostedNavBar ─────────────────────────────────────────────────────────
// Name kept for compatibility with _layout.tsx import.

export function FrostedNavBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const visibleRoutes = useMemo(
    () => state.routes.filter((r) => !HIDDEN_ROUTES.has(r.name)),
    [state.routes],
  );

  const activeRouteName = state.routes[state.index]?.name;
  const isHiddenRoute = activeRouteName !== undefined && HIDDEN_ROUTES.has(activeRouteName);

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

  if (isHiddenRoute) {
    return <View style={styles.hiddenPlaceholder} />;
  }

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
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
    left: 10,
    right: 10,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 44,
  },
  iconWrapper: {
    alignItems: 'center',
  },
  activeLine: {
    position: 'absolute',
    bottom: -5,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.brand,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  centralItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  centralButton: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.lg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  hiddenPlaceholder: {
    height: 0,
  },
});
