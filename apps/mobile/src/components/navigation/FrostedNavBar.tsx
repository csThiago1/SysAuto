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
import { Colors } from '@/constants/theme';

// ─── Tab configuration (4 tabs, sem central) ─────────────────────────────────

interface TabConfig {
  routeName: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_CONFIG: TabConfig[] = [
  {
    routeName: 'index',
    iconActive: 'home',
    iconInactive: 'home-outline',
    label: 'Início',
  },
  {
    routeName: 'os/index',
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
    routeName: 'mais/index',
    iconActive: 'menu',
    iconInactive: 'menu-outline',
    label: 'Mais',
  },
];

// Routes that completely hide the nav bar (full-screen sub-screens).
const HIDDEN_ROUTES = new Set(['checklist', 'camera', 'photo-editor', 'vistoria']);

// Routes that map to a tab highlight — e.g. 'os' detail stack → 'os/index' tab.
const ROUTE_TO_TAB: Record<string, string> = {
  'os': 'os/index',
};

// ─── TabItem ───────────────────────────────────────────────────────────────

interface TabItemProps {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ config, isActive, onPress }: TabItemProps): React.JSX.Element {
  const pressScale = useSharedValue(1);
  const restingScale = useSharedValue(isActive ? 1.05 : 1);
  const lineOpacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    restingScale.value = withTiming(isActive ? 1.05 : 1, { duration: 200 });
  }, [isActive, restingScale]);

  useEffect(() => {
    lineOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, lineOpacity]);

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

  const iconColor = isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)';
  const iconName = isActive ? config.iconActive : config.iconInactive;

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={handlePress}
      activeOpacity={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={config.label}
    >
      <Animated.View style={[styles.iconWrapper, iconAnimStyle]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
        <Animated.View style={[styles.activeLine, lineAnimStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── FrostedNavBar ─────────────────────────────────────────────────────────

export function FrostedNavBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const visibleRoutes = useMemo(
    () => state.routes.filter((r) => !HIDDEN_ROUTES.has(r.name)),
    [state.routes],
  );

  const rawActiveRoute = state.routes[state.index]?.name;
  const activeRouteName = ROUTE_TO_TAB[rawActiveRoute ?? ''] ?? rawActiveRoute;
  const isHiddenRoute = rawActiveRoute !== undefined && HIDDEN_ROUTES.has(rawActiveRoute);

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
          const isActive = activeRouteName === route.name;
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopColor: Colors.borderGlintTop,
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
  hiddenPlaceholder: {
    height: 0,
  },
});
