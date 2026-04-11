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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { OSCard } from '@/components/os/OSCard';
import {
  getStatusBackgroundColor,
  getStatusColor,
  getStatusLabel,
} from '@/components/os/OSStatusBadge';
import { SyncIndicator } from '@/components/common/SyncIndicator';
import { Text } from '@/components/ui/Text';

// ─── Status chips configuration ───────────────────────────────────────────────

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

// ─── Skeleton placeholder ──────────────────────────────────────────────────────

function SkeletonCard(): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
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

// ─── Filter chip ───────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  selected: boolean;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

function FilterChip({
  label,
  selected,
  color,
  backgroundColor,
  onPress,
}: FilterChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        selected
          ? { backgroundColor, borderColor: color }
          : styles.chipOutline,
      ]}
    >
      <Text
        variant="caption"
        style={[styles.chipLabel, { color: selected ? color : '#6b7280' }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function OSListScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<OSStatus | undefined>(undefined);

  // Inject SyncIndicator into native header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <SyncIndicator />,
    });
  }, [navigation]);

  // Debounce search input (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
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
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceOrder }): React.JSX.Element => <OSCard order={item} />,
    [],
  );

  const keyExtractor = useCallback((item: ServiceOrder): string => item.id, []);

  const hasActiveFilter = Boolean(activeStatus) || Boolean(debouncedSearch);

  // ── Skeleton loading state ─────────────────────────────────────────────────
  if (isLoading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox} />
        </View>
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <Text variant="body" color="#6b7280" style={styles.emptyText}>
        {hasActiveFilter
          ? 'Nenhuma OS encontrada para esta busca'
          : 'Nenhuma OS disponivel'}
      </Text>
      {isOffline && (
        <Text variant="caption" color="#9ca3af" style={styles.emptyHint}>
          Conecte-se para sincronizar mais dados
        </Text>
      )}
    </View>
  );

  const ListFooter =
    isFetchingNextPage ? (
      <View style={styles.footerSpinner}>
        <ActivityIndicator size="small" color="#9333ea" />
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search input */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por placa, numero ou cliente..."
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
        {/* ALL chip */}
        <FilterChip
          label="Todas"
          selected={activeStatus === undefined}
          color="#9333ea"
          backgroundColor="#f3e8ff"
          onPress={() => setActiveStatus(undefined)}
        />

        {STATUS_LIST.map((status) => (
          <FilterChip
            key={status}
            label={getStatusLabel(status)}
            selected={activeStatus === status}
            color={getStatusColor(status)}
            backgroundColor={getStatusBackgroundColor(status)}
            onPress={() =>
              setActiveStatus(activeStatus === status ? undefined : status)
            }
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
            tintColor="#9333ea"
            colors={['#9333ea']}
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  searchBox: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    height: 44,
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
