# Mobile Navigation & Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frosted-glass tab bar with a dark T2 pill and the text-only OS screen header with a compact gradient header featuring the DS Car logo.

**Architecture:** Two independent changes in `apps/mobile`. Task 1 rewrites `FrostedNavBar.tsx` in-place (same export name, same interface — `_layout.tsx` unchanged). Task 2 replaces the `DarkHeader` component inside `os/index.tsx` with a new `OSHeader` using `expo-linear-gradient`.

**Tech Stack:** React Native 0.83.4, Expo SDK 55, `react-native-reanimated` 4.2.1, `expo-haptics`, `expo-linear-gradient` (to be added), `@expo/vector-icons` Ionicons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/src/components/navigation/FrostedNavBar.tsx` | Rewrite | T2 dark pill tab bar — same export, new visual |
| `apps/mobile/app/(app)/os/index.tsx` | Modify | Replace `DarkHeader` with `OSHeader` using gradient + logo |
| `apps/mobile/package.json` | Modify | Add `expo-linear-gradient ~14.0.2` |

`apps/mobile/app/(app)/_layout.tsx` — **no changes needed** (imports `FrostedNavBar` by name, interface unchanged).

---

## Task 1: Rewrite FrostedNavBar → T2 Dark Pill

**Files:**
- Modify: `apps/mobile/src/components/navigation/FrostedNavBar.tsx`

### What changes

**Remove:**
- `BlurView` import and usage
- `bubbleX`, `bubbleW` shared values and the entire bubble animation `useEffect`
- `containerWidth` state and `onLayout` handler
- `tabWidth()` function, `NORMAL_FLEX`, `CENTRAL_FLEX`, `TOTAL_FLEX`
- `labelMaxWidth`, `labelOpacity` animations in `TabItem`
- Label `<Text>` and `labelWrapper` animated view
- `frostedBar`, `frostedBarAndroid`, `bubble` styles
- The two-layer shadow+BlurView structure in `FrostedNavBar` render
- `iconInactive`/`iconActive` fields (consolidate into single `iconActive`/`iconInactive` kept for filled/outline distinction — see TAB_CONFIG below)
- `Text` import from `@/components/ui/Text` (no labels in T2)

**Add:**
- `activeLine` View (3 px red glow line, absolutely positioned below icon)
- `centralButton` View inside `centralItem` (red pill with `+` icon)
- Simplified pill `View` container

**Keep:**
- `pressScale` + `restingScale` Reanimated pattern (spring on press + resting at 1.05 active)
- `Haptics.impactAsync` on press
- `HIDDEN_ROUTES` check → `hiddenPlaceholder`
- `handleTabPress` navigation logic
- `useSafeAreaInsets` for `bottom` positioning

- [ ] **Step 1: Verify existing tests/lint pass**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/mobile && npx tsc --noEmit
```

Expected: 0 errors (establishes baseline).

- [ ] **Step 2: Write the complete new FrostedNavBar.tsx**

Replace the entire file content with:

```tsx
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
    routeName: 'index',
    iconActive: 'list',
    iconInactive: 'list-outline',
    label: 'OS',
  },
  {
    routeName: 'busca/index',
    iconActive: 'search',
    iconInactive: 'search-outline',
    label: 'Busca',
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
    iconActive: 'person',
    iconInactive: 'person-outline',
    label: 'Perfil',
  },
];

const HIDDEN_ROUTES = new Set(['os', 'checklist', 'camera', 'photo-editor']);

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
      >
        <Animated.View style={[styles.centralButton, iconAnimStyle]}>
          <Ionicons name="add" size={22} color="#ffffff" />
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
    backgroundColor: '#141414',
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
    backgroundColor: '#e31b1b',
    shadowColor: '#e31b1b',
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
    backgroundColor: '#e31b1b',
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e31b1b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  hiddenPlaceholder: {
    height: 0,
  },
});
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && git add apps/mobile/src/components/navigation/FrostedNavBar.tsx && git commit -m "feat(mobile): redesign tab bar — T2 dark pill with red glow indicator"
```

---

## Task 2: Add expo-linear-gradient

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/mobile && npm install expo-linear-gradient
```

Expected: package added to `dependencies` in `package.json`. `expo-linear-gradient` is part of the Expo SDK 55 bundle — no native rebuild required for Expo Go.

- [ ] **Step 2: Verify TypeScript can resolve the import**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/mobile && npx tsc --noEmit
```

Expected: 0 errors (the package ships its own types).

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && git add apps/mobile/package.json package-lock.json && git commit -m "chore(mobile): add expo-linear-gradient for OS header gradient"
```

---

## Task 3: Replace DarkHeader → OSHeader in os/index.tsx

**Files:**
- Modify: `apps/mobile/app/(app)/os/index.tsx`

### Changes summary

1. Add imports: `Image` from `react-native`, `LinearGradient` from `expo-linear-gradient`
2. Remove: `COMPANY_NAMES`, `getCompanyName()` (no longer shown in header)
3. Rename `DarkHeader` → `OSHeader`, update `DarkHeaderProps` → `OSHeaderProps` (drop `companyName` field)
4. In `OSHeader`: replace `View + overlay` with `LinearGradient`, replace greeting+company text with logo+name row, update stat chip colors to match T2 palette
5. In `OSListScreen`: remove `activeCompany` selector and `companyName` variable, update both `<DarkHeader ...>` call sites to `<OSHeader ...>`
6. In `StyleSheet`: remove `darkHeader*` styles, add new `header*` styles

- [ ] **Step 1: Apply all changes to os/index.tsx**

Make the following targeted edits (apply in order):

**Edit A — add imports at the top of the file (after line 12, before `useSafeAreaInsets` import)**

Old:
```tsx
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
```

New:
```tsx
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
```

**Edit B — remove COMPANY_NAMES and getCompanyName (lines 31–40)**

Old:
```tsx
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
```

New: *(remove entirely — empty)*

**Edit C — replace DarkHeader component (lines 175–229)**

Old:
```tsx
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
      <View style={styles.darkHeaderOverlay} pointerEvents="none" />

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
```

New:
```tsx
// ─── OS Header ─────────────────────────────────────────────────────────────

const LOGO: ImageSourcePropType = require('../../../assets/dscar-logo.png');

interface OSHeaderProps {
  paddingTop: number;
  firstName: string;
  stats: OSStats;
}

function OSHeader({ paddingTop, firstName, stats }: OSHeaderProps): React.JSX.Element {
  return (
    <LinearGradient
      colors={['#1c1c1e', '#2a0e0e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: paddingTop + 10 }]}
    >
      {/* Top row: logo + greeting */}
      <View style={styles.headerRow}>
        <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
        <View style={styles.headerRight}>
          <Text style={styles.headerGreeting}>{getGreeting()} 👋</Text>
          <Text style={styles.headerName}>{firstName}</Text>
        </View>
      </View>

      {/* Stat chips */}
      <View style={styles.statChipsRow}>
        {stats.open > 0 && (
          <View style={[styles.statChip, styles.statChipOpen]}>
            <Text style={[styles.statChipText, styles.statChipOpenText]}>
              {stats.open} Abertas
            </Text>
          </View>
        )}
        {stats.ready > 0 && (
          <View style={[styles.statChip, styles.statChipReady]}>
            <Text style={[styles.statChipText, styles.statChipReadyText]}>
              {stats.ready} Prontas
            </Text>
          </View>
        )}
        {stats.overdue > 0 && (
          <View style={[styles.statChip, styles.statChipOverdue]}>
            <Text style={[styles.statChipText, styles.statChipOverdueText]}>
              {stats.overdue} Atrasadas
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
```

**Edit D — in OSListScreen, remove activeCompany and companyName (around line 236)**

Old:
```tsx
  const user = useAuthStore((s) => s.user);
  const activeCompany = useAuthStore((s) => s.activeCompany);
  const stats = useOSStats();

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
  const companyName = getCompanyName(activeCompany);
```

New:
```tsx
  const user = useAuthStore((s) => s.user);
  const stats = useOSStats();

  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
```

**Edit E — replace both DarkHeader call sites with OSHeader**

First call site (in the loading branch, around line 282):

Old:
```tsx
        <DarkHeader
          paddingTop={insets.top}
          firstName={firstName}
          companyName={companyName}
          stats={stats}
        />
```

New:
```tsx
        <OSHeader
          paddingTop={insets.top}
          firstName={firstName}
          stats={stats}
        />
```

Second call site (in main render, around line 318):

Old:
```tsx
      <DarkHeader
        paddingTop={insets.top}
        firstName={firstName}
        companyName={companyName}
        stats={stats}
      />
```

New:
```tsx
      <OSHeader
        paddingTop={insets.top}
        firstName={firstName}
        stats={stats}
      />
```

**Edit F — replace darkHeader* styles in StyleSheet with new header* styles**

Old (entire dark header section, roughly lines 400–460):
```tsx
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
```

New:
```tsx
  // OS Header
  header: {
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 80,
    height: 44,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  headerGreeting: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400' as const,
  },
  headerName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  statChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  statChipOpen: {
    backgroundColor: 'rgba(252,165,165,0.1)',
    borderColor: 'rgba(252,165,165,0.35)',
  },
  statChipOpenText: {
    color: '#fca5a5',
  },
  statChipReady: {
    backgroundColor: 'rgba(134,239,172,0.1)',
    borderColor: 'rgba(134,239,172,0.35)',
  },
  statChipReadyText: {
    color: '#86efac',
  },
  statChipOverdue: {
    backgroundColor: 'rgba(252,211,77,0.1)',
    borderColor: 'rgba(252,211,77,0.35)',
  },
  statChipOverdueText: {
    color: '#fcd34d',
  },
```

- [ ] **Step 2: Remove unused SyncIndicator import if no longer used in the file**

Check if `SyncIndicator` is used anywhere else in `os/index.tsx`. If the only usage was in `DarkHeader`, remove the import line:

```tsx
import { SyncIndicator } from '@/components/common/SyncIndicator';
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/mobile && npx tsc --noEmit
```

Expected: 0 errors. Common errors to watch for:
- `Module '"expo-linear-gradient"' has no exported member 'LinearGradient'` → ensure Task 2 (npm install) ran first
- `Cannot find module '../../../assets/dscar-logo.png'` → verify file exists at `apps/mobile/assets/dscar-logo.png`

- [ ] **Step 4: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar && git add apps/mobile/app/\(app\)/os/index.tsx && git commit -m "feat(mobile): redesign OS screen header — A2+L1 compact with DS Car logo and gradient"
```

---

## Visual Verification Checklist

Start the app with `expo start --ios` or `expo start --android` from `apps/mobile/` and verify:

- [ ] Tab bar appears as a dark floating pill (`#141414`) at the bottom of the screen
- [ ] Inactive tabs show dim icons (outline variant) at ~28% opacity
- [ ] Active tab shows bright white icon (filled variant) + red glowing line below
- [ ] Tapping a tab triggers light haptic + spring scale animation
- [ ] "Nova OS" center tab shows a red pill with `+` icon
- [ ] Tab bar hides when navigating to OS detail / checklist / camera / photo-editor
- [ ] OS screen header shows DS Car logo (left) + "Bom dia 👋" / user name (right)
- [ ] Header background is dark gradient (#1c1c1e → dark red #2a0e0e)
- [ ] Stat chips are visible: red "Abertas", green "Prontas", yellow "Atrasadas"
- [ ] Header is compact (no wasted vertical space)
