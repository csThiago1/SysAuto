import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radii, Spacing, SemanticColors, Typography } from '@/constants/theme';
import {
  useCalendar,
  buildAgendaEventsMap,
  formatDateKey,
  type AgendaEvent,
} from '@/hooks/useCalendar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = Spacing.xl;
const CELL_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2) / 7;

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AgendaScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const startDate = useMemo(() => new Date(year, month, 1), [year, month]);
  const endDate = useMemo(() => new Date(year, month + 1, 0), [year, month]);

  const { data, isLoading } = useCalendar(startDate, endDate);
  const eventsMap = useMemo(() => buildAgendaEventsMap(data ?? []), [data]);
  const calendarRows = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const selectedKey = formatDateKey(selectedDate);
  const selectedEvents = eventsMap[selectedKey] ?? [];

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  function getDots(day: number): { hasEntry: boolean; hasDelivery: boolean } {
    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
    const events = eventsMap[key] ?? [];
    return {
      hasEntry: events.some((e) => e.type === 'entry'),
      hasDelivery: events.some((e) => e.type === 'delivery'),
    };
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agenda</Text>
        {isLoading && (
          <ActivityIndicator size="small" color={Colors.brand} style={styles.loader} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── Month navigation ───────────────────────────────────────── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ─── Legend ─────────────────────────────────────────────────── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
            <Text style={styles.legendText}>Entrada</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.legendText}>Entrega</Text>
          </View>
        </View>

        {/* ─── Day-of-week header ─────────────────────────────────────── */}
        <View style={styles.dayHeaders}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ─── Calendar grid ──────────────────────────────────────────── */}
        <View style={styles.grid}>
          {calendarRows.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((day, di) => {
                if (!day) {
                  return <View key={di} style={styles.emptyCell} />;
                }
                const cellDate = new Date(year, month, day);
                const isToday = sameDay(cellDate, today);
                const isSelected = sameDay(cellDate, selectedDate);
                const { hasEntry, hasDelivery } = getDots(day);

                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(new Date(year, month, day))}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isToday && styles.todayCircle,
                        isSelected && !isToday && styles.selectedCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isToday && styles.todayText,
                          isSelected && !isToday && styles.selectedText,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                    <View style={styles.dots}>
                      {hasEntry && (
                        <View style={[styles.dot, { backgroundColor: Colors.info }]} />
                      )}
                      {hasDelivery && (
                        <View style={[styles.dot, { backgroundColor: Colors.success }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ─── Events for selected day ─────────────────────────────────── */}
        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>
            {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
          </Text>

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyEvents}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={Colors.textTertiary}
              />
              <Text variant="bodySmall" color={Colors.textTertiary}>Nenhum agendamento para este dia</Text>
            </View>
          ) : (
            selectedEvents.map((event, i) => (
              <EventCard
                key={`${event.os.id}-${event.type}-${i}`}
                event={event}
                onPress={() => router.push(`/os/${event.os.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onPress,
}: {
  event: AgendaEvent;
  onPress: () => void;
}): React.JSX.Element {
  const isEntry = event.type === 'entry';
  const color = isEntry ? Colors.info : Colors.success;
  const semantic = isEntry ? SemanticColors.info : SemanticColors.success;
  const label = isEntry ? 'Entrada' : 'Entrega';
  const vehicle =
    [event.os.make, event.os.model].filter(Boolean).join(' ') || event.os.plate;

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.eventBar, { backgroundColor: color }]} />
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventOS}>OS #{event.os.number}</Text>
          <View style={[styles.typeBadge, { backgroundColor: semantic.bg }]}>
            <Text style={[styles.typeBadgeText, { color }]}>{label}</Text>
          </View>
          {event.timeStr && (
            <Text style={styles.eventTime}>{event.timeStr}</Text>
          )}
        </View>
        <Text style={styles.eventVehicle} numberOfLines={1}>
          {vehicle}
        </Text>
        <Text style={styles.eventCustomer} numberOfLines={1}>
          {event.os.plate} · {event.os.customer_name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingBottom: 100, // space for nav bar
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  loader: {
    marginLeft: Spacing.sm,
  },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  navBtn: {
    padding: Spacing.sm,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Day headers
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  dayHeaderText: {
    ...Typography.labelMono,
    color: Colors.textTertiary,
  },

  // Grid
  grid: {
    paddingHorizontal: GRID_PADDING,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  emptyCell: {
    width: CELL_SIZE,
  },
  dayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: Colors.brand,
  },
  selectedCircle: {
    backgroundColor: Colors.brandTint,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  dayText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  todayText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  selectedText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    height: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Events section
  eventsSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  eventsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  emptyEvents: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyEventsText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },

  // Event card
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  eventBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  eventContent: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 3,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventOS: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  eventVehicle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  eventCustomer: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
