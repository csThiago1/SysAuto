import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { OS_STATUS_MAP, Colors, type OSStatus } from '@/constants/theme';

// ─── Pipeline stages ────────────────────────────────────────────────────────
// 6 production stages in system pipeline order.
// A segment lights up when the OS status index >= that stage's index.

interface PipelineStage {
  status: OSStatus;
  index: number; // position in STATUS_ORDER
}

const STATUS_ORDER: OSStatus[] = [
  'reception',      // 0
  'initial_survey', // 1
  'budget',         // 2
  'waiting_auth',   // 3
  'authorized',     // 4
  'waiting_parts',  // 5
  'repair',         // 6
  'mechanic',       // 7
  'bodywork',       // 8
  'painting',       // 9
  'assembly',       // 10
  'polishing',      // 11
  'washing',        // 12
  'final_survey',   // 13
  'ready',          // 14
];

const PIPELINE_STAGES: PipelineStage[] = [
  { status: 'mechanic',     index: 7 },
  { status: 'bodywork',     index: 8 },
  { status: 'painting',     index: 9 },
  { status: 'polishing',    index: 11 },
  { status: 'washing',      index: 12 },
  { status: 'ready',        index: 14 },
];

function getStatusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status as OSStatus);
  // delivered/cancelled → treat as fully complete / zero
  if (idx === -1) {
    if (status === 'delivered') return STATUS_ORDER.length;
    return -1; // cancelled or unknown
  }
  return idx;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PipelineBarProps {
  status: string;
}

export function PipelineBar({ status }: PipelineBarProps): React.JSX.Element {
  const currentIdx = getStatusIndex(status);
  const isCancelled = status === 'cancelled';

  let completedCount = 0;
  if (!isCancelled) {
    for (const stage of PIPELINE_STAGES) {
      if (currentIdx >= stage.index) completedCount++;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {PIPELINE_STAGES.map((stage, i) => {
          const isCompleted = !isCancelled && currentIdx >= stage.index;
          const color = isCompleted
            ? OS_STATUS_MAP[stage.status]?.color ?? Colors.textTertiary
            : Colors.inputBg;
          return (
            <View
              key={stage.status}
              style={[
                styles.segment,
                { backgroundColor: color },
                i === 0 && styles.segmentFirst,
                i === PIPELINE_STAGES.length - 1 && styles.segmentLast,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.fraction}>
        {isCancelled ? '—' : `${completedCount}/${PIPELINE_STAGES.length}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 5,
  },
  segment: {
    flex: 1,
    borderRadius: 1,
  },
  segmentFirst: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  segmentLast: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  fraction: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'right',
  },
});
