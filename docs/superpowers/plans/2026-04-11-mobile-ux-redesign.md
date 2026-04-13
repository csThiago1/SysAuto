# Mobile UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark `PillTabBar` with a frosted-glass `FrostedNavBar` featuring a sliding red bubble, redesign the OS list screen with a dark immersive header, add a colored-border card layout, and fix all back-button destinations.

**Architecture:** New `FrostedNavBar` component replaces `PillTabBar` in `_layout.tsx`. The OS list screen gains a custom dark header with user greeting + company name + 3 stat chips. `OSCard` gets a colored left border per status and a new info layout. Back buttons use `router.replace()` with explicit destinations.

**Tech Stack:** React Native 0.83, Expo SDK 55, Expo Router v4, react-native-reanimated 4, expo-haptics, WatermelonDB, Zustand, TypeScript strict.

---

## File Map

| Action | File |
|--------|------|
| Create | `apps/mobile/src/components/navigation/FrostedNavBar.tsx` |
| Modify | `apps/mobile/app/(app)/_layout.tsx` |
| Modify | `apps/mobile/src/components/os/OSCard.tsx` |
| Modify | `apps/mobile/app/(app)/os/index.tsx` |
| Modify | `apps/mobile/app/(app)/os/[id].tsx` |
| Modify | `apps/mobile/app/(app)/checklist/[osId].tsx` |

---

## Task 1: Create `FrostedNavBar.tsx`

**Files:**
- Create: `apps/mobile/src/components/navigation/FrostedNavBar.tsx`

### Context

`PillTabBar.tsx` (the existing navbar) has:
- `TAB_CONFIG` mapping route names to icons — same routes apply
- `HIDDEN_ROUTES = new Set(['os', 'checklist', 'camera'])` — same rule applies
- Uses `BottomTabBarProps` from `@react-navigation/bottom-tabs`
- Uses `useSafeAreaInsets` for bottom positioning
- `navigation.emit({ type: 'tabPress', ... })` pattern for tab press

The new `FrostedNavBar` must:
1. Show a frosted-glass bar (semi-transparent white + border + shadow)
2. Render a sliding red bubble behind the active tab (using `react-native-reanimated`)
3. Show icon + label only on the active tab — inactive tabs show icon only
4. Apply haptic feedback on each press
5. Central "Nova OS" button is always solid red and does not participate in the bubble animation

Bubble animation strategy: track container width via `onLayout`, compute tab widths from flex ratios (normal = 1, central = 1.2, total = 5.2), slide bubble to active tab's X position using `withSpring`.

- [x] **Step 1: Create `FrostedNavBar.tsx` with complete implementation**

```typescript
// apps/mobile/src/components/navigation/FrostedNavBar.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
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
  const scale = useSharedValue(1);
  const labelMaxWidth = useSharedValue(isActive && !config.isCentral ? 56 : 0);
  const labelOpacity = useSharedValue(isActive && !config.isCentral ? 1 : 0);

  useEffect(() => {
    if (config.isCentral) return; // central never shows label
    labelMaxWidth.value = withSpring(isActive ? 56 : 0, {
      damping: 20,
      stiffness: 200,
    });
    labelOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, labelMaxWidth, labelOpacity, config.isCentral]);

  const handlePress = useCallback((): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.92, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    onPress();
  }, [scale, onPress]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
            <Text variant="caption" style={[styles.tabLabel, { color: iconColor }]} numberOfLines={1}>
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
    if (!activeCfg) return;

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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
    ...Platform.select({
      android: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
      },
    }),
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
});
```

- [x] **Step 2: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```

Expected: 0 errors for `FrostedNavBar.tsx`. Any errors from unrelated files can be ignored.

- [x] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/src/components/navigation/FrostedNavBar.tsx
git commit -m "feat(mobile/ux): cria FrostedNavBar com bubble deslizante e glass effect"
```

---

## Task 2: Switch `_layout.tsx` to use `FrostedNavBar`

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

### Context

Current `_layout.tsx`:
```typescript
import { PillTabBar } from '@/components/navigation/PillTabBar';
// ...
<Tabs tabBar={(props) => <PillTabBar {...props} />} ...>
```

Replace `PillTabBar` with `FrostedNavBar`. No other changes needed.

- [x] **Step 1: Update `_layout.tsx`**

Replace the entire file content:

```typescript
// apps/mobile/app/(app)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { FrostedNavBar } from '@/components/navigation/FrostedNavBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <FrostedNavBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* The 5 tabs that appear in the FrostedNavBar, in TAB_CONFIG order */}
      <Tabs.Screen name="index" options={{ title: 'OS' }} />
      <Tabs.Screen name="busca/index" options={{ title: 'Busca' }} />
      <Tabs.Screen name="nova-os/index" options={{ title: 'Nova OS' }} />
      <Tabs.Screen name="notificacoes/index" options={{ title: 'Notificacoes' }} />
      <Tabs.Screen name="perfil/index" options={{ title: 'Perfil' }} />
      {/* Detail routes — no tab icon */}
      <Tabs.Screen name="os" options={{ href: null }} />
      <Tabs.Screen name="checklist" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ href: null }} />
    </Tabs>
  );
}
```

- [x] **Step 2: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile/ux): troca PillTabBar por FrostedNavBar no layout"
```

---

## Task 3: OS List — dark header + redesigned OSCard

**Files:**
- Modify: `apps/mobile/src/components/os/OSCard.tsx`
- Modify: `apps/mobile/app/(app)/os/index.tsx`

### Context

**OSCard changes (spec §2.5):**
- Remove the outer `<Card>` component (which has `borderWidth: 1`) — build the card inline
- Add a 4px colored left border whose color depends on `order.status`
- New layout per row:
  1. Row: `OS #N` + time ago (right-aligned)
  2. Row: plate (monospace via `letterSpacing`)
  3. Row: customer · vehicle
  4. Row: status badge (left) + value (right)
- Shadow: `0 2px 10px rgba(0,0,0,0.06)` — no external border
- BorderRadius: 16px, Padding: 14px 16px

Status → left border color mapping:
```
reception, initial_survey, final_survey → #3b82f6 (blue)
budget, waiting_approval, waiting_parts → #f59e0b (amber)
approved, in_progress                   → #22c55e (green)
ready                                   → #10b981 (teal)
delivered                               → #94a3b8 (slate)
cancelled                               → #ef4444 (red)
```

**OSListScreen header changes (spec §2.4):**
- Dark header with `#0f172a` background (gradient approximation: overlay with `#1e293b` at 50% opacity)
- Shows: greeting (Bom dia/tarde/noite + first name), company display name, 3 stat chips
- Greeting uses `useAuthStore` to get `user.name` and `activeCompany`
- Stats: open (≠ delivered/cancelled), ready, overdue (open > 5 days)
- Stats come from a `useOSStats()` hook that queries WatermelonDB directly
- Remove `navigation.setOptions({ headerRight: ... })` — now in the custom header via `<SyncIndicator />`
- `SafeAreaView` now needs top safe area: use `useSafeAreaInsets()` and apply `paddingTop: insets.top` inside the header

**`useOSStats` hook:** added inline at the top of `os/index.tsx` (not exported — used only here).

**`COMPANY_DISPLAY_NAMES` map:** `dscar → DS Car`, `pecas → Peças`, `vidros → Vidros`, `estetica → Estética`.

- [x] **Step 1: Update `OSCard.tsx`**

Replace the entire file content:

```typescript
// apps/mobile/src/components/os/OSCard.tsx
import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { Text } from '@/components/ui/Text';
import { OSStatusBadge } from './OSStatusBadge';

interface OSCardProps {
  order: ServiceOrder;
}

// Status → left border color
const STATUS_BORDER_COLOR: Record<string, string> = {
  reception:        '#3b82f6',
  initial_survey:   '#3b82f6',
  final_survey:     '#3b82f6',
  budget:           '#f59e0b',
  waiting_approval: '#f59e0b',
  waiting_parts:    '#f59e0b',
  approved:         '#22c55e',
  in_progress:      '#22c55e',
  ready:            '#10b981',
  delivered:        '#94a3b8',
  cancelled:        '#ef4444',
};

function getLeftBorderColor(status: string): string {
  return STATUS_BORDER_COLOR[status] ?? '#94a3b8';
}

function getDaysOpen(createdAtMs: number): string {
  const diffMs = Date.now() - createdAtMs;
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'hoje';
  return `${days}d`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const OSCard = React.memo(function OSCard({ order }: OSCardProps): React.JSX.Element {
  const router = useRouter();

  const handlePress = useCallback((): void => {
    router.push(`/(app)/os/${order.remoteId}`);
  }, [router, order.remoteId]);

  const total = (order.totalParts ?? 0) + (order.totalServices ?? 0);
  const plateLine = order.vehiclePlate ? order.vehiclePlate.toUpperCase() : '—';
  const vehicleLine = [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ');
  const timeAgo = getDaysOpen(order.createdAtRemote);
  const borderColor = getLeftBorderColor(order.status);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={styles.touchable}
    >
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        {/* Row 1: OS number + time ago */}
        <View style={styles.row}>
          <Text variant="label" style={styles.osNumber}>
            OS #{order.number}
          </Text>
          <Text variant="caption" color="#9ca3af">
            {timeAgo}
          </Text>
        </View>

        {/* Row 2: plate (monospace) */}
        <Text variant="bodySmall" style={styles.plate}>
          {plateLine}
        </Text>

        {/* Row 3: customer · vehicle */}
        <Text variant="bodySmall" color="#6b7280" numberOfLines={1}>
          {order.customerName}
          {vehicleLine.length > 0 ? ` · ${vehicleLine}` : ''}
        </Text>

        {/* Row 4: status badge + total */}
        <View style={styles.footer}>
          <OSStatusBadge status={order.status} />
          <Text variant="caption" style={styles.total}>
            {formatCurrency(total)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#94a3b8', // overridden inline by status
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  osNumber: {
    color: '#111827',
  },
  plate: {
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#1a1a1a',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  total: {
    fontWeight: '600',
    color: '#374151',
  },
});
```

- [x] **Step 2: Update `os/index.tsx` with dark header + stats**

Replace the entire file content:

```typescript
// apps/mobile/app/(app)/os/index.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { database } from '@/db/index';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { useAuthStore } from '@/stores/auth.store';
import { OSCard } from '@/components/os/OSCard';
import {
  getStatusBackgroundColor,
  getStatusColor,
  getStatusLabel,
} from '@/components/os/OSStatusBadge';
import { SyncIndicator } from '@/components/common/SyncIndicator';
import { Text } from '@/components/ui/Text';

// ─── Company display names ─────────────────────────────────────────────────

const COMPANY_NAMES: Record<string, string> = {
  dscar:    'DS Car',
  pecas:    'Peças Automotivas',
  vidros:   'Vidros',
  estetica: 'Estética',
};

function getCompanyName(slug: string): string {
  return COMPANY_NAMES[slug] ?? slug;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ─── OS stats hook (WatermelonDB counts) ──────────────────────────────────

interface OSStats {
  open: number;
  ready: number;
  overdue: number;
}

function useOSStats(): OSStats {
  const [stats, setStats] = useState<OSStats>({ open: 0, ready: 0, overdue: 0 });

  useEffect(() => {
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const fiveDaysAgo = Date.now() - FIVE_DAYS_MS;
    const collection = database.collections.get<ServiceOrder>('service_orders');

    void Promise.all([
      collection
        .query(Q.where('status', Q.notIn(['delivered', 'cancelled'])))
        .fetchCount(),
      collection
        .query(Q.where('status', 'ready'))
        .fetchCount(),
      collection
        .query(
          Q.and(
            Q.where('status', Q.notIn(['delivered', 'cancelled'])),
            Q.where('created_at_remote', Q.lt(fiveDaysAgo)),
          ),
        )
        .fetchCount(),
    ]).then(([open, ready, overdue]) => {
      setStats({ open, ready, overdue });
    });
  }, []);

  return stats;
}

// ─── Status chips configuration ───────────────────────────────────────────

const STATUS_LIST = [
  'reception',
  'initial_survey',
  'budget',
  'waiting_approval',
  'approved',
  'in_progress',
  'waiting_parts',
  'final_survey',
  'ready',
  'delivered',
  'cancelled',
] as const;

type OSStatus = (typeof STATUS_LIST)[number];

// ─── Skeleton placeholder ──────────────────────────────────────────────────

function SkeletonCard(): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonBadge]} />
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonLine]} />
      <View style={[styles.skeletonBlock, { width: '55%', height: 12 }]} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonBlock, { width: '30%', height: 11 }]} />
        <View style={[styles.skeletonBlock, { width: '25%', height: 11 }]} />
      </View>
    </Animated.View>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  selected: boolean;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

function FilterChip({ label, selected, color, backgroundColor, onPress }: FilterChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, selected ? { backgroundColor, borderColor: color } : styles.chipOutline]}
    >
      <Text variant="caption" style={[styles.chipLabel, { color: selected ? color : '#6b7280' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Dark header ──────────────────────────────────────────────────────────

interface DarkHeaderProps {
  paddingTop: number;
  firstName: string;
  companyName: string;
  stats: OSStats;
}

function DarkHeader({ paddingTop, firstName, companyName, stats }: DarkHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.darkHeader, { paddingTop: paddingTop + 16 }]}>
      {/* Gradient overlay approximation */}
      <View style={styles.darkHeaderOverlay} />

      {/* Top row: greeting + sync indicator */}
      <View style={styles.darkHeaderTopRow}>
        <View>
          <Text variant="heading3" style={styles.greetingText}>
            {getGreeting()}, {firstName} 👋
          </Text>
          <Text variant="bodySmall" style={styles.companyText}>
            {companyName}
          </Text>
        </View>
        <SyncIndicator />
      </View>

      {/* Stat chips row */}
      <View style={styles.statChipsRow}>
        {stats.open > 0 && (
          <View style={[styles.statChip, styles.statChipOpen]}>
            <Text variant="caption" style={styles.statChipOpenText}>
              {stats.open} Abertas
            </Text>
          </View>
        )}
        {stats.ready > 0 && (
          <View style={[styles.statChip, styles.statChipReady]}>
            <Text variant="caption" style={styles.statChipReadyText}>
              {stats.ready} Prontas
            </Text>
          </View>
        )}
        {stats.overdue > 0 && (
          <View style={[styles.statChip, styles.statChipOverdue]}>
            <Text variant="caption" style={styles.statChipOverdueText}>
              {stats.overdue} ⚠ Atrasadas
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function OSListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const activeCompany = useAuthStore((s) => s.activeCompany);
  const stats = useOSStats();

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
  const companyName = getCompanyName(activeCompany);

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<OSStatus | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = {
    status: activeStatus,
    search: debouncedSearch || undefined,
  };

  const {
    orders,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
    isOffline,
  } = useServiceOrdersList(filters);

  const handleEndReached = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceOrder }): React.JSX.Element => <OSCard order={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ServiceOrder): string => item.id, []);
  const hasActiveFilter = Boolean(activeStatus) || Boolean(debouncedSearch);

  if (isLoading && orders.length === 0) {
    return (
      <View style={styles.safe}>
        <DarkHeader
          paddingTop={insets.top}
          firstName={firstName}
          companyName={companyName}
          stats={stats}
        />
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <Text variant="body" color="#6b7280" style={styles.emptyText}>
        {hasActiveFilter ? 'Nenhuma OS encontrada para esta busca' : 'Nenhuma OS disponível'}
      </Text>
      {isOffline && (
        <Text variant="caption" color="#9ca3af" style={styles.emptyHint}>
          Conecte-se para sincronizar mais dados
        </Text>
      )}
    </View>
  );

  const ListFooter = isFetchingNextPage ? (
    <View style={styles.footerSpinner}>
      <ActivityIndicator size="small" color="#e31b1b" />
    </View>
  ) : null;

  return (
    <View style={styles.safe}>
      <DarkHeader
        paddingTop={insets.top}
        firstName={firstName}
        companyName={companyName}
        stats={stats}
      />

      {/* Search input */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por placa, número ou cliente..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
        style={styles.chipsScroll}
      >
        <FilterChip
          label="Todas"
          selected={activeStatus === undefined}
          color="#e31b1b"
          backgroundColor="#fee2e2"
          onPress={() => setActiveStatus(undefined)}
        />
        {STATUS_LIST.map((status) => (
          <FilterChip
            key={status}
            label={getStatusLabel(status)}
            selected={activeStatus === status}
            color={getStatusColor(status)}
            backgroundColor={getStatusBackgroundColor(status)}
            onPress={() => setActiveStatus(activeStatus === status ? undefined : status)}
          />
        ))}
      </ScrollView>

      {/* Order list */}
      <FlatList<ServiceOrder>
        data={orders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor="#e31b1b"
            colors={['#e31b1b']}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Dark header
  darkHeader: {
    backgroundColor: '#0f172a',
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  darkHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e293b',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  darkHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingText: {
    color: '#f1f5f9',
  },
  companyText: {
    color: '#94a3b8',
    marginTop: 2,
  },
  statChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statChipOpen: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  statChipOpenText: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  statChipReady: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  statChipReadyText: {
    color: '#86efac',
    fontWeight: '600',
  },
  statChipOverdue: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statChipOverdueText: {
    color: '#fcd34d',
    fontWeight: '600',
  },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },

  // Chips
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  chipLabel: {
    fontWeight: '600',
    fontSize: 12,
  },

  // List
  listContent: {
    paddingTop: 6,
    paddingBottom: 120,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyHint: {
    marginTop: 8,
    textAlign: 'center',
  },

  // Footer spinner
  footerSpinner: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // Skeleton
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBlock: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  skeletonTitle: {
    width: '35%',
    height: 14,
  },
  skeletonBadge: {
    width: '28%',
    height: 22,
    borderRadius: 11,
  },
  skeletonLine: {
    width: '75%',
    height: 12,
  },
});
```

- [x] **Step 3: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```

Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/src/components/os/OSCard.tsx apps/mobile/app/(app)/os/index.tsx
git commit -m "feat(mobile/ux): dark header com greeting + stats, cards com borda de status"
```

---

## Task 4: Fix back button destinations

**Files:**
- Modify: `apps/mobile/app/(app)/os/[id].tsx`
- Modify: `apps/mobile/app/(app)/checklist/[osId].tsx`

### Context

**Spec §2.3:**
| Tela | Destino do back |
|------|----------------|
| OS Detail | `router.replace('/(app)')` |
| Checklist | `router.replace('/(app)/os/' + osId)` |
| Camera | already correct — not changed here |

Back button should show the name of the source screen, not just "Voltar".

**`os/[id].tsx`:**
- `handleBack` at line 347: `router.back()` → `router.replace('/(app)')`
- Back button text: `"Voltar"` → `"Ordens de Serviço"` (in the loading state header)
- The `OSDetailHeader` component handles the main back button — check if it also needs `onBack` to navigate explicitly (it receives `onBack` prop, and we pass `handleBack`)

**`checklist/[osId].tsx`:**
- `handleBack` at line 119: `router.back()` → `router.replace(\`/(app)/os/${osId}\`)`
- The back button text (in the checklist header) should show `"OS #N"` — already handled by `headerTitle`

- [x] **Step 1: Fix back button in `os/[id].tsx`**

In `apps/mobile/app/(app)/os/[id].tsx`, make these two changes:

**Change 1** — `handleBack` function (around line 347):
```typescript
// BEFORE:
const handleBack = useCallback((): void => {
  router.back();
}, [router]);

// AFTER:
const handleBack = useCallback((): void => {
  router.replace('/(app)');
}, [router]);
```

**Change 2** — Loading state back button text (around line 371):
```typescript
// BEFORE:
<Text variant="body" color="#e31b1b">
  Voltar
</Text>

// AFTER:
<Text variant="body" color="#e31b1b">
  Ordens de Serviço
</Text>
```

- [x] **Step 2: Fix back button in `checklist/[osId].tsx`**

In `apps/mobile/app/(app)/checklist/[osId].tsx`, change `handleBack` (around line 119):

```typescript
// BEFORE:
const handleBack = useCallback((): void => {
  router.back();
}, [router]);

// AFTER:
const handleBack = useCallback((): void => {
  router.replace(`/(app)/os/${osId}`);
}, [router, osId]);
```

- [x] **Step 3: Run TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/app/(app)/os/[id].tsx apps/mobile/app/(app)/checklist/\[osId\].tsx
git commit -m "fix(mobile/nav): back buttons com destinos explícitos (replace vs back)"
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|-----------------|------|
| Navbar não aparece em telas de detalhe | ✅ Already handled by `HIDDEN_ROUTES` (unchanged) |
| Back button destino correto + nome da tela de origem | ✅ Task 4 |
| Bubble desliza com spring ao trocar tab | ✅ Task 1 |
| Label só no tab ativo, some com animação | ✅ Task 1 |
| Glow vermelho no tab ativo | ✅ Task 1 (shadow on bubble) |
| Navbar translúcida | ✅ Task 1 (`rgba(255,255,255,0.85)`) |
| Header escuro com greeting + empresa + 3 stats | ✅ Task 3 |
| Cards com borda colorida de status (sem border externo) | ✅ Task 3 |
| Haptic feedback em toque | ✅ Task 1 |
| Funciona em iOS e Android | ✅ All tasks use Platform-agnostic APIs |
