import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { ServiceOrder } from '@/db/models/ServiceOrder';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { OSCard } from '@/components/os/OSCard';
import {
  getStatusBackgroundColor,
  getStatusColor,
  getStatusLabel,
} from '@/components/os/OSStatusBadge';
import { Text } from '@/components/ui/Text';


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

// ─── OS Header ─────────────────────────────────────────────────────────────

const LOGO: ImageSourcePropType = require('../../../assets/dscar-logo.png');

interface OSHeaderProps {
  paddingTop: number;
}

function OSHeader({ paddingTop }: OSHeaderProps): React.JSX.Element {
  const navigation = useNavigation();

  return (
    <LinearGradient
      colors={['#1c1c1e', '#141414']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.header, { paddingTop: paddingTop + 8 }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />

        <View style={styles.headerLogoWrapper}>
          <Image source={LOGO} style={styles.headerLogo} resizeMode="cover" />
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('notificacoes' as never)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function OSListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

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
        <OSHeader paddingTop={insets.top} />
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
      <OSHeader paddingTop={insets.top} />

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
        style={styles.list}
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

  // Header
  header: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerLogoWrapper: {
    flex: 1,
    height: 52,
    marginHorizontal: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
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
    flexShrink: 0,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  chipsContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
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
