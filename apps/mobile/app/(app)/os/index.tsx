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
import { MonoLabel } from '@/components/ui/MonoLabel';
import { Colors, Radii, Spacing, Shadow } from '@/constants/theme';


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
          <Text variant="label" color={Colors.textPrimary}>Filtrar por Status</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={Colors.textTertiary} />
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
          accessibilityRole="radio"
          accessibilityState={{ checked: activeStatus === undefined }}
          accessibilityLabel="Todas"
        >
          <View style={[styles.statusDot, { backgroundColor: Colors.brand }]} />
          <Text
            variant="body"
            style={[styles.statusRowLabel, activeStatus === undefined && { color: Colors.brand, fontWeight: '700' }]}
          >
            Todas
          </Text>
          {activeStatus === undefined && (
            <Ionicons name="checkmark" size={18} color={Colors.brand} style={styles.statusCheck} />
          )}
        </TouchableOpacity>

        {/* Status rows */}
        {STATUS_LIST.map((status) => {
          const color = getStatusColor(status);
          const bg = getStatusBackgroundColor(status);
          const isSelected = activeStatus === status;
          const statusLabel = getStatusLabel(status);
          return (
            <TouchableOpacity
              key={status}
              activeOpacity={0.75}
              onPress={() => { onSelect(isSelected ? undefined : status); onClose(); }}
              style={[styles.statusRow, isSelected && { backgroundColor: bg }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={statusLabel}
            >
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text
                variant="body"
                style={[styles.statusRowLabel, isSelected && { color, fontWeight: '700' }]}
              >
                {statusLabel}
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
      colors={[Colors.bgHeader, Colors.bg]}
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
          accessibilityRole="button"
          accessibilityLabel="Notificações"
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
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
  const [excludeClosed, setExcludeClosed] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = {
    status: activeStatus,
    search: debouncedSearch || undefined,
    // When a specific status is selected, it takes precedence — don't exclude anything.
    // When no specific status is active, apply the "Na Oficina" filter if toggled on.
    excludeClosed: activeStatus === undefined ? excludeClosed : false,
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
  const hasActiveFilter = Boolean(activeStatus) || Boolean(debouncedSearch) || excludeClosed;

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
      <Ionicons name="car-outline" size={48} color={Colors.textTertiary} />
      <Text variant="body" color={Colors.textTertiary} style={styles.emptyText}>
        {hasActiveFilter ? 'Nenhuma OS encontrada para esta busca' : 'Nenhuma OS disponível'}
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
      <OSHeader paddingTop={insets.top} />

      {/* Search + filter row */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por placa, número ou cliente..."
          placeholderTextColor={Colors.textSecondary}
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
          accessibilityRole="button"
          accessibilityLabel="Filtrar por status"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeStatus !== undefined ? Colors.brand : Colors.textTertiary}
          />
          {activeStatus !== undefined && <View style={styles.filterDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setExcludeClosed(!excludeClosed)}
          style={[
            styles.naOficinaButton,
            excludeClosed && styles.naOficinaButtonActive,
          ]}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={excludeClosed ? 'Mostrando veículos na oficina' : 'Mostrando todas as OS'}
        >
          <Text
            variant="caption"
            style={[
              styles.naOficinaText,
              excludeClosed && styles.naOficinaTextActive,
            ]}
          >
            {excludeClosed ? 'Na Oficina' : 'Todas'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active filter label */}
      {activeStatus !== undefined && (
        <View style={styles.activeFilterBar}>
          <Text variant="caption" color={Colors.brand} style={styles.activeFilterLabel}>
            {getStatusLabel(activeStatus)}
          </Text>
          <TouchableOpacity
            onPress={() => setActiveStatus(undefined)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtro"
          >
            <Ionicons name="close-circle" size={16} color={Colors.brand} />
          </TouchableOpacity>
        </View>
      )}

      {/* Result count */}
      {!isLoading && orders.length > 0 && (
        <View style={styles.countBar}>
          <MonoLabel size="sm">{`${orders.length} OS`}</MonoLabel>
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
    backgroundColor: Colors.bg,
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
    backgroundColor: Colors.inputBg,
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.brand,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },

  // Count bar
  countBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 4,
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

  // Filter modal (bottom sheet)
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayLight,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
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
    backgroundColor: Colors.brandTint,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  statusCheck: {
    marginLeft: 'auto',
  },

  // "Na Oficina" toggle
  naOficinaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  naOficinaButtonActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  naOficinaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  naOficinaTextActive: {
    color: Colors.brand,
  },
});
