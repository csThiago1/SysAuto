import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { StatusDot } from '@/components/ui/StatusDot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Radii, Spacing, SemanticColors, type OSStatus } from '@/constants/theme';
import {
  useNotificationFeed,
  type NotificationFeedItem,
} from '@/hooks/useNotifications';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return `há ${days}d`;
}

/** Cor do status de destino para o indicador lateral. */
function statusColor(status: string): string {
  if (['delivered', 'ready', 'final_survey'].includes(status)) return Colors.success;
  if (['cancelled'].includes(status)) return Colors.error;
  if (['authorized', 'waiting_parts'].includes(status)) return Colors.warning;
  if (['repair', 'mechanic', 'bodywork', 'painting', 'assembly', 'polishing', 'washing'].includes(status))
    return Colors.info;
  return Colors.textTertiary;
}

// ─── Item de notificação ──────────────────────────────────────────────────────

function NotificationItem({
  item,
  onPress,
}: {
  item: NotificationFeedItem;
  onPress: () => void;
}): React.JSX.Element {
  const color = statusColor(item.to_status);
  const vehicle =
    [item.os_make, item.os_model].filter(Boolean).join(' ') || item.os_plate;
  const isAuto = Boolean(item.triggered_by_field);

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.itemBar, { backgroundColor: color }]} />
      <View style={styles.itemContent}>
        <View style={styles.itemTopRow}>
          <Text style={styles.itemOS}>OS #{item.os_number}</Text>
          {isAuto && (
            <View style={styles.autoBadge}>
              <Ionicons name="flash" size={10} color={Colors.warning} />
              <Text style={styles.autoBadgeText}>automático</Text>
            </View>
          )}
          <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.fromStatus}>{item.from_status_display}</Text>
          <Ionicons name="arrow-forward" size={12} color={Colors.textTertiary} />
          <StatusDot status={item.to_status as OSStatus} size={8} />
          <Text style={[styles.toStatus, { color }]}>{item.to_status_display}</Text>
        </View>

        <Text style={styles.itemVehicle} numberOfLines={1}>
          {vehicle} · {item.os_plate}
        </Text>
        <Text style={styles.itemCustomer} numberOfLines={1}>
          {item.os_customer_name}
        </Text>
        {!isAuto && (
          <Text style={styles.itemAgent} numberOfLines={1}>
            por {item.changed_by_name}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function NotificacoesScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useNotificationFeed();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationFeedItem }) => (
      <NotificationItem
        item={item}
        onPress={() => router.push(`/os/${item.os_id}`)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback(
    (item: NotificationFeedItem) => item.id,
    [],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alertas</Text>
        {isLoading && !isRefetching && (
          <ActivityIndicator size="small" color={Colors.brand} />
        )}
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Atualizações de status das ordens de serviço</Text>
      </View>

      {isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            (!data || data.length === 0) && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={Colors.brand}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Nenhum alerta</Text>
              <Text style={styles.emptySubtitle}>
                As mudanças de status das OS aparecerão aqui.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  legend: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  legendText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  separator: {
    height: Spacing.sm,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 240,
  },

  // Item
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  itemBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  itemContent: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 3,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemOS: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.warning.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  autoBadgeText: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: '500',
  },
  itemTime: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginLeft: 'auto',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  fromStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  toStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemVehicle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  itemCustomer: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  itemAgent: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
