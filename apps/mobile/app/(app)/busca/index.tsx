import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useServiceOrdersList } from '@/hooks/useServiceOrders';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { OSCard } from '@/components/os/OSCard';
import { Text } from '@/components/ui/Text';
import { SemanticBadge } from '@/components/ui/SemanticBadge';
import { SectionDivider } from '@/components/ui/SectionDivider';

// ─── MMKV storage (module-level — never recreated on render) ─────────────────
// MMKV requer JSI nativo — não disponível no Expo Go. Fallback in-memory.

const _memCache = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'search-history' });
} catch {
  // Expo Go — JSI não disponível
}

const searchStorage = {
  getString: (key: string): string | undefined =>
    _mmkv ? (_mmkv.getString(key) as string | undefined) : _memCache.get(key),
  set: (key: string, value: string): void => {
    if (_mmkv) _mmkv.set(key, value);
    else _memCache.set(key, value);
  },
};
const HISTORY_KEY = 'recent_searches';
const MAX_HISTORY = 10;

function getHistory(): string[] {
  const raw = searchStorage.getString(HISTORY_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

function saveToHistory(query: string): void {
  if (!query.trim()) return;
  const history = getHistory().filter((h) => h !== query);
  history.unshift(query);
  searchStorage.set(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function removeFromHistory(item: string): void {
  const history = getHistory().filter((h) => h !== item);
  searchStorage.set(HISTORY_KEY, JSON.stringify(history));
}

// ─── useDebounce ──────────────────────────────────────────────────────────────

function useDebounce(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BuscaScreen(): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>(() => getHistory());

  const debouncedQuery = useDebounce(inputValue, 300);
  const activeSearch = debouncedQuery.length >= 2 ? debouncedQuery : '';

  const { orders, isLoading, isOffline } = useServiceOrdersList({
    search: activeSearch || undefined,
  });

  // ── Sync history state from MMKV whenever history changes ──────────────────
  const refreshHistory = useCallback((): void => {
    setHistory(getHistory());
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChangeText = useCallback((text: string): void => {
    setInputValue(text);
  }, []);

  const handleClearInput = useCallback((): void => {
    setInputValue('');
    inputRef.current?.focus();
  }, []);

  const handleHistoryItemPress = useCallback((item: string): void => {
    setInputValue(item);
  }, []);

  const handleHistoryItemRemove = useCallback(
    (item: string): void => {
      removeFromHistory(item);
      refreshHistory();
    },
    [refreshHistory],
  );

  // Save to history when user presses the OS card (result selected)
  const handleResultPress = useCallback((): void => {
    if (debouncedQuery.trim().length >= 2) {
      saveToHistory(debouncedQuery.trim());
      refreshHistory();
    }
  }, [debouncedQuery, refreshHistory]);

  // Save to history when submitting the text field (Enter key)
  const handleSubmitEditing = useCallback((): void => {
    if (inputValue.trim().length >= 2) {
      saveToHistory(inputValue.trim());
      refreshHistory();
    }
  }, [inputValue, refreshHistory]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const showHistory = inputValue.length === 0;
  const showResults = debouncedQuery.length >= 2;
  const showEmpty = showResults && !isLoading && orders.length === 0;

  // Memoized key extractor for performance
  const keyExtractor = useCallback((item: ServiceOrder): string => item.id, []);

  const historyKeyExtractor = useCallback((item: string, index: number): string => `${item}-${index}`, []);

  // Wrap OSCard so we can intercept the press to save history.
  // OSCard internally calls router.push — we capture the event via a transparent
  // overlay Pressable that fires BEFORE the TouchableOpacity inside OSCard.
  const renderResult = useCallback(
    ({ item }: { item: ServiceOrder }): React.JSX.Element => (
      <Pressable onPress={handleResultPress} style={styles.resultWrapper}>
        <OSCard order={item} />
      </Pressable>
    ),
    [handleResultPress],
  );

  const renderHistoryItem = useCallback(
    ({ item }: { item: string }): React.JSX.Element => (
      <View style={styles.historyRow}>
        <TouchableOpacity
          style={styles.historyTextTouchable}
          onPress={() => handleHistoryItemPress(item)}
          activeOpacity={0.6}
        >
          <Text variant="bodySmall" color={Colors.textSecondary} numberOfLines={1} style={styles.historyText}>
            {item}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.historyRemoveBtn}
          onPress={() => handleHistoryItemRemove(item)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
    ),
    [handleHistoryItemPress, handleHistoryItemRemove],
  );

  // ── Offline badge ──────────────────────────────────────────────────────────

  const offlineBadge = isOffline ? (
    <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
      <SemanticBadge variant="warning" label="Offline — resultados locais" icon="cloud-offline-outline" />
    </View>
  ) : null;

  // ── List footer spacer (PillTabBar) ────────────────────────────────────────
  const listFooter = useMemo(() => <View style={styles.listFooter} />, []);

  // ── Empty result ───────────────────────────────────────────────────────────

  const emptyResult = showEmpty ? (
    <View style={styles.emptyState}>
      <Text variant="body" color={Colors.textTertiary}>
        {`Nenhuma OS encontrada para "${debouncedQuery}"`}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Buscar OS..."
          placeholderTextColor={Colors.textSecondary}
          value={inputValue}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmitEditing}
          autoFocus
          returnKeyType="search"
          clearButtonMode="never"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        {inputValue.length > 0 && (
          <TouchableOpacity
            onPress={handleClearInput}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.clearBtn}
            activeOpacity={0.6}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {offlineBadge}

      {/* ── History (shown when input is empty) ───────────────────────── */}
      {showHistory && (
        <View style={styles.historyContainer}>
          {history.length > 0 ? (
            <>
              <View style={styles.historyHeader}>
                <SectionDivider label="RECENTES" />
                <TouchableOpacity
                  onPress={() => {
                    setHistory([]);
                    try { searchStorage.set(HISTORY_KEY, JSON.stringify([])); } catch {}
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar histórico de busca"
                >
                  <Text variant="caption" style={{ color: Colors.brand }}>Limpar tudo</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={history}
                keyExtractor={historyKeyExtractor}
                renderItem={renderHistoryItem}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={styles.historyList}
                ListFooterComponent={listFooter}
                keyboardShouldPersistTaps="handled"
              />
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="body" color={Colors.textSecondary}>
                Digite para buscar uma OS por placa, numero ou cliente.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Results (shown when query.length >= 2 after debounce) ─────── */}
      {showResults && orders.length > 0 && (
        <Text variant="caption" style={{ color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 }}>
          {orders.length} resultado{orders.length !== 1 ? 's' : ''}
        </Text>
      )}
      {showResults && (
        <FlatList
          data={orders}
          keyExtractor={keyExtractor}
          renderItem={renderResult}
          ListEmptyComponent={emptyResult}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 0,
    height: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    paddingLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // History
  historyContainer: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  historyList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  historyTextTouchable: {
    flex: 1,
  },
  historyText: {
    flex: 1,
  },
  historyRemoveBtn: {
    paddingLeft: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.inputBg,
  },
  // Results
  resultsList: {
    paddingTop: Spacing.sm,
    paddingBottom: 120,
  },
  resultWrapper: {
    // Transparent wrapper that intercepts press for history saving.
    // OSCard renders its own TouchableOpacity inside.
  },
  // Empty state
  emptyState: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  // Footer spacer
  listFooter: {
    height: 24,
  },
});
