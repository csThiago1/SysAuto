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

    const sub1 = collection
      .query(Q.where('status', Q.notIn(['delivered', 'cancelled'])))
      .observeCount()
      .subscribe((count: number) => {
        setStats((prev) => ({ ...prev, open: count }));
      });

    const sub2 = collection
      .query(Q.where('status', 'ready'))
      .observeCount()
      .subscribe((count: number) => {
        setStats((prev) => ({ ...prev, ready: count }));
      });

    const sub3 = collection
      .query(
        Q.and(
          Q.where('status', Q.notIn(['delivered', 'cancelled'])),
          Q.where('created_at_remote', Q.lt(fiveDaysAgo)),
        ),
      )
      .observeCount()
      .subscribe((count: number) => {
        setStats((prev) => ({ ...prev, overdue: count }));
      });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    };
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
