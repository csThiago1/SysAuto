import React, { useCallback } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
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
import { GlowEffect } from './GlowEffect';

// Mapeamento por nome de rota — robusto mesmo se ordem mudar
interface TabConfig {
  routeName: string;
  iconInactive: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  isCentral?: boolean;
}

const TAB_CONFIG: TabConfig[] = [
  { routeName: 'index', iconInactive: 'list-outline', iconActive: 'list' },
  { routeName: 'busca/index', iconInactive: 'search-outline', iconActive: 'search' },
  {
    routeName: 'nova-os/index',
    iconInactive: 'add-circle-outline',
    iconActive: 'add-circle',
    isCentral: true,
  },
  {
    routeName: 'notificacoes/index',
    iconInactive: 'notifications-outline',
    iconActive: 'notifications',
  },
  { routeName: 'perfil/index', iconInactive: 'person-outline', iconActive: 'person' },
];

// Rotas que nao aparecem na tab bar (href: null)
const HIDDEN_ROUTES = new Set(['os', 'checklist']);

interface TabItemProps {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ config, isActive, onPress }: TabItemProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const handlePress = useCallback(() => {
    // Feedback haptico nativo
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animacao de escala com spring
    scale.value = withSpring(1.15, { damping: 10, stiffness: 200 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });

    // Animacao de glow — aparece e desaparece
    glowOpacity.value = withTiming(1, { duration: 150 }, () => {
      glowOpacity.value = withTiming(0, { duration: 300 });
    });

    onPress();
  }, [scale, glowOpacity, onPress]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const iconSize = config.isCentral ? 32 : 24;
  const iconName = isActive ? config.iconActive : config.iconInactive;
  const iconColor = isActive ? '#9333ea' : '#9ca3af';

  return (
    <TouchableOpacity
      style={[styles.tabItem, config.isCentral && styles.centralTabItem]}
      onPress={handlePress}
      activeOpacity={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.iconContainer}>
        <GlowEffect style={animatedGlowStyle} />
        <Animated.View style={animatedIconStyle}>
          <Ionicons name={iconName} size={iconSize} color={iconColor} />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

export function PillTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handleTabPress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation]
  );

  // Filtra apenas as rotas visiveis na tab bar
  const visibleRoutes = state.routes.filter((r) => !HIDDEN_ROUTES.has(r.name));

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 8 }]}
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
              onPress={() =>
                handleTabPress(route.name, route.key, isActive)
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    ...Platform.select({
      ios: {},
      android: {
        borderWidth: 1,
        borderColor: '#222222',
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 44, // acessibilidade — area minima de toque HIG/Material
  },
  centralTabItem: {
    flex: 1.2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
});
