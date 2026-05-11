import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { useInsurers } from '@/hooks/useInsurers';
import { useStatusCounts } from '@/hooks/useStatusCounts';
import { useAuthStore } from '@/stores/auth.store';
import { OSCard } from '@/components/os/OSCard';
import { getStatusColor, getStatusLabel } from '@/components/os/OSStatusBadge';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';

// ─── Status list (for chips) ───────────────────────────────────────────────
// Only show production-relevant statuses as chips (skip terminal ones).

const CHIP_STATUSES = [
  'reception',
  'initial_survey',
  'budget',
  'waiting_auth',
  'authorized',
  'waiting_parts',
  'repair',
  'mechanic',
  'bodywork',
  'painting',
  'assembly',
  'polishing',
  'washing',
  'final_survey',
  'ready',
] as const;

type ChipStatus = (typeof CHIP_STATUSES)[number];

// ─── Greeting helper ────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
    </Animated.View>
  );
}

// ─── Status chip ────────────────────────────────────────────────────────────

interface StatusChipProps {
  label: string;
  count: number;
  isActive: boolean;
  color?: string;
  onPress: () => void;
}

function StatusChip({ label, count, isActive, color, onPress }: StatusChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        isActive && styles.chipActive,
        isActive && color ? { borderColor: color, backgroundColor: color + '18' } : undefined,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isActive }}
      accessibilityLabel={`${label} ${count}`}
    >
      <Text
        style={[
          styles.chipText,
          isActive && { color: color ?? Colors.textPrimary, fontWeight: '700' },
        ]}
      >
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function OSListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const userName = useAuthStore((s) => s.user?.name?.split(' ')[0] ?? 'Usuário');

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<ChipStatus | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { counts, openTotal } = useStatusCounts();

  const filters = {
    status: activeStatus,
    search: debouncedSearch || undefined,
    excludeClosed: activeStatus === undefined,
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

  const { insurers } = useInsurers();
  const insurerMap = useMemo(
    () => Object.fromEntries(insurers.map((ins) => [ins.id, ins])),
    [insurers],
  );

  // Only show chips that have OS in them (+ the active one if selected)
  const visibleChips = useMemo(
    () => CHIP_STATUSES.filter((s) => (counts[s] ?? 0) > 0 || s === activeStatus),
    [counts, activeStatus],
  );

  const handleEndReached = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceOrder }): React.JSX.Element => (
      <OSCard order={item} insurer={item.insurerId ? insurerMap[item.insurerId] : undefined} />
    ),
    [insurerMap],
  );

  const keyExtractor = useCallback((item: ServiceOrder): string => item.id, []);

  const handleChipPress = useCallback((status: ChipStatus): void => {
    setActiveStatus((prev) => (prev === status ? undefined : status));
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading && orders.length === 0) {
    return (
      <View style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTopRow}>
            <Text style={styles.brandName}>DSCAR</Text>
            <View style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            </View>
          </View>
        </View>
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
      <Ionicons name="car-outline" size={48} color={Colors.textTertiary} />
      <Text variant="body" color={Colors.textTertiary} style={styles.emptyText}>
        {activeStatus || debouncedSearch ? 'Nenhuma OS encontrada para esta busca' : 'Nenhuma OS disponível'}
      </Text>
      {isOffline && (
        <Text variant="caption" color={Colors.textSecondary} style={styles.emptyHint}>
          Conecte-se para sincronizar mais dados
        </Text>
      )}
    </View>
  );

  const ListFooter = isFetchingNextPage ? (
    <View style={styles.footerSpinner}>
      <ActivityIndicator size="small" color={Colors.brand} />
    </View>
  ) : null;

  return (
    <View style={styles.safe}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.brandName}>DSCAR</Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('notificacoes' as never)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.greetingPrefix}>{getGreeting()},</Text>
          <Text style={styles.greetingName}>{userName}</Text>
          <Text style={styles.greetingCount}> · {openTotal} OS abertas</Text>
        </View>
      </View>

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Placa, OS ou cliente"
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => {/* Reserved for advanced filters */}}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Filtros"
        >
          <Ionicons name="options-outline" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* ── Status chips ─────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}
      >
        {/* "Todas" chip */}
        <StatusChip
          label="Todas"
          count={openTotal}
          isActive={activeStatus === undefined}
          color={Colors.textPrimary}
          onPress={() => setActiveStatus(undefined)}
        />
        {visibleChips.map((status) => (
          <StatusChip
            key={status}
            label={getStatusLabel(status)}
            count={counts[status] ?? 0}
            isActive={activeStatus === status}
            color={getStatusColor(status)}
            onPress={() => handleChipPress(status)}
          />
        ))}
      </ScrollView>

      {/* ── Order list ───────────────────────────────────────────────────── */}
      <FlatList<ServiceOrder>
        style={styles.list}
        data={orders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={Colors.brand}
            colors={[Colors.brand]}
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
    backgroundColor: Colors.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  greetingPrefix: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 4,
  },
  greetingCount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // ── Search ──────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    marginLeft: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  filterBtn: {
    padding: 6,
  },

  // ── Chips ───────────────────────────────────────────────────────────────
  chipsScroll: {
    flexGrow: 0,
    marginTop: 10,
  },
  chipsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // ── List ────────────────────────────────────────────────────────────────
  list: {
    flex: 1,
    marginTop: 10,
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 120,
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: Spacing.xxl,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyHint: {
    marginTop: 8,
    textAlign: 'center',
  },

  // ── Footer spinner ──────────────────────────────────────────────────────
  footerSpinner: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // ── Skeleton ────────────────────────────────────────────────────────────
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBlock: {
    backgroundColor: Colors.skeleton,
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
