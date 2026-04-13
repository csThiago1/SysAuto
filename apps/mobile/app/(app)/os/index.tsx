import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  RefreshControl,
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
import { useInsurers } from '@/hooks/useInsurers';
import { OSCard } from '@/components/os/OSCard';
import {
  getStatusBackgroundColor,
  getStatusColor,
  getStatusLabel,
} from '@/components/os/OSStatusBadge';
import { Text } from '@/components/ui/Text';


// ─── Status list ───────────────────────────────────────────────────────────

const STATUS_LIST = [
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

// ─── Status filter modal ───────────────────────────────────────────────────

interface StatusFilterModalProps {
  visible: boolean;
  activeStatus: OSStatus | undefined;
  onSelect: (status: OSStatus | undefined) => void;
  onClose: () => void;
}

function StatusFilterModal({
  visible,
  activeStatus,
  onSelect,
  onClose,
}: StatusFilterModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle bar */}
        <View style={styles.modalHandle} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <Text variant="label" color="#111827">Filtrar por Status</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.modalClose}>
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* "Todas" option */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => { onSelect(undefined); onClose(); }}
          style={[
            styles.statusRow,
            activeStatus === undefined && styles.statusRowActive,
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: '#e31b1b' }]} />
          <Text
            variant="body"
            style={[styles.statusRowLabel, activeStatus === undefined && { color: '#e31b1b', fontWeight: '700' }]}
          >
            Todas
          </Text>
          {activeStatus === undefined && (
            <Ionicons name="checkmark" size={18} color="#e31b1b" style={styles.statusCheck} />
          )}
        </TouchableOpacity>

        {/* Status rows */}
        {STATUS_LIST.map((status) => {
          const color = getStatusColor(status);
          const bg = getStatusBackgroundColor(status);
          const isSelected = activeStatus === status;
          return (
            <TouchableOpacity
              key={status}
              activeOpacity={0.75}
              onPress={() => { onSelect(isSelected ? undefined : status); onClose(); }}
              style={[styles.statusRow, isSelected && { backgroundColor: bg }]}
            >
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text
                variant="body"
                style={[styles.statusRowLabel, isSelected && { color, fontWeight: '700' }]}
              >
                {getStatusLabel(status)}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark" size={18} color={color} style={styles.statusCheck} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
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
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

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

  const { insurers } = useInsurers();
  const insurerMap = useMemo(
    () => Object.fromEntries(insurers.map((ins) => [ins.id, ins])),
    [insurers],
  );

  const handleEndReached = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceOrder }): React.JSX.Element => (
      <OSCard order={item} insurer={item.insurerId != null ? insurerMap[item.insurerId] : undefined} />
    ),
    [insurerMap],
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

      {/* Search + filter row */}
      <View style={styles.searchRow}>
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

        <TouchableOpacity
          style={[styles.filterBtn, activeStatus !== undefined && styles.filterBtnActive]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeStatus !== undefined ? '#e31b1b' : '#6b7280'}
          />
          {activeStatus !== undefined && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Active filter label */}
      {activeStatus !== undefined && (
        <View style={styles.activeFilterBar}>
          <Text variant="caption" color="#e31b1b" style={styles.activeFilterLabel}>
            {getStatusLabel(activeStatus)}
          </Text>
          <TouchableOpacity onPress={() => setActiveStatus(undefined)} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color="#e31b1b" />
          </TouchableOpacity>
        </View>
      )}

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

      {/* Status filter modal */}
      <StatusFilterModal
        visible={filterModalVisible}
        activeStatus={activeStatus}
        onSelect={setActiveStatus}
        onClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141414',
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

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: '#e31b1b',
    backgroundColor: 'rgba(227, 27, 27, 0.15)',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e31b1b',
    borderWidth: 1.5,
    borderColor: '#fff1f1',
  },

  // Active filter label bar
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  activeFilterLabel: {
    fontWeight: '600',
  },

  // List
  list: {
    flex: 1,
  },
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
    backgroundColor: 'rgba(44, 44, 50, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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

  // Filter modal (bottom sheet)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalClose: {
    padding: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 2,
  },
  statusRowActive: {
    backgroundColor: 'rgba(227, 27, 27, 0.15)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#e5e7eb',
  },
  statusCheck: {
    marginLeft: 'auto',
  },
});
