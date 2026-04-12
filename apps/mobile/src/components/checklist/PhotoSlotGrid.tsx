import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { usePhotoStore, type PhotoQueueItem } from '@/stores/photo.store';

// ─── Slot definitions ─────────────────────────────────────────────────────────

interface SlotDef {
  key: string;
  label: string;
  icon: string;
}

const EXTERNAL_SLOTS: SlotDef[] = [
  { key: 'frente',       label: 'Frente',           icon: 'car-outline' },
  { key: 'traseira',     label: 'Traseira',          icon: 'car-outline' },
  { key: 'lateral_esq', label: 'Lateral Esquerda',  icon: 'car-outline' },
  { key: 'lateral_dir', label: 'Lateral Direita',   icon: 'car-outline' },
  { key: 'diag_diant',  label: 'Diag. Dianteira',   icon: 'car-outline' },
  { key: 'diag_tras',   label: 'Diag. Traseira',    icon: 'car-outline' },
];

const DETAIL_SLOTS: SlotDef[] = [
  { key: 'chave',       label: 'Chave / Controle',  icon: 'key-outline' },
  { key: 'painel',      label: 'Painel / Odômetro', icon: 'speedometer-outline' },
  { key: 'motor',       label: 'Motor',             icon: 'hardware-chip-outline' },
  { key: 'step',        label: 'Step / Estepe',     icon: 'disc-outline' },
  { key: 'ferramentas', label: 'Kit Ferramentas',   icon: 'build-outline' },
  { key: 'combustivel', label: 'Nível Combustível', icon: 'water-outline' },
];

const MANDATORY_COUNT = EXTERNAL_SLOTS.length + DETAIL_SLOTS.length; // 12

// ─── Component API ────────────────────────────────────────────────────────────

interface PhotoSlotGridProps {
  osId: string;
  folder: string;
  checklistType: string;
  onSlotPress: (slot: string, folder: string, checklistType: string) => void;
}

// ─── Upload status overlay ────────────────────────────────────────────────────

interface StatusOverlayProps {
  status: PhotoQueueItem['uploadStatus'];
}

function StatusOverlay({ status }: StatusOverlayProps): React.ReactElement | null {
  if (status === 'done') {
    return (
      <View style={styles.statusOverlay}>
        <View style={[styles.statusBubble, styles.statusBubbleDone]}>
          <Ionicons name="checkmark" size={12} color="#ffffff" />
        </View>
      </View>
    );
  }
  if (status === 'uploading') {
    return (
      <View style={styles.statusOverlay}>
        <View style={[styles.statusBubble, styles.statusBubbleUploading]}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={styles.statusOverlay}>
        <View style={[styles.statusBubble, styles.statusBubblePending]}>
          <Ionicons name="time-outline" size={12} color="#ffffff" />
        </View>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.statusOverlay}>
        <View style={[styles.statusBubble, styles.statusBubbleError]}>
          <Text style={styles.statusErrorText}>!</Text>
        </View>
      </View>
    );
  }
  return null;
}

// ─── Single slot card ─────────────────────────────────────────────────────────

interface SlotCardProps {
  slotKey: string;
  label: string;
  icon: string;
  photo: PhotoQueueItem | undefined;
  onPress: () => void;
}

function SlotCard({ slotKey: _slotKey, label, icon, photo, onPress }: SlotCardProps): React.ReactElement {
  const imageUri = photo?.remoteUrl ?? photo?.localUri ?? null;
  const hasThumbnail = imageUri !== null;

  return (
    <TouchableOpacity
      style={styles.slotCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {hasThumbnail ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.slotImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.slotEmpty}>
          <Ionicons
            name={icon as React.ComponentProps<typeof Ionicons>['name']}
            size={32}
            color="#9ca3af"
          />
          <Text variant="caption" style={styles.slotLabel}>
            {label}
          </Text>
        </View>
      )}
      {photo !== undefined && (
        <StatusOverlay status={photo.uploadStatus} />
      )}
    </TouchableOpacity>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

interface SlotSectionProps {
  title: string;
  slots: SlotDef[];
  photoMap: Map<string, PhotoQueueItem>;
  folder: string;
  checklistType: string;
  onSlotPress: PhotoSlotGridProps['onSlotPress'];
}

function SlotSection({
  title,
  slots,
  photoMap,
  folder,
  checklistType,
  onSlotPress,
}: SlotSectionProps): React.ReactElement {
  const filledCount = slots.filter((s) => photoMap.has(s.key)).length;

  return (
    <View style={styles.section}>
      <Text variant="label" style={styles.sectionHeader}>
        {title} ({filledCount}/{slots.length})
      </Text>
      <View style={styles.grid}>
        {slots.map((slot) => (
          <SlotCard
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            icon={slot.icon}
            photo={photoMap.get(slot.key)}
            onPress={() => onSlotPress(slot.key, folder, checklistType)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhotoSlotGrid({
  osId,
  folder,
  checklistType,
  onSlotPress,
}: PhotoSlotGridProps): React.ReactElement {
  const queue = usePhotoStore((s) => s.queue);

  // Build slot → PhotoQueueItem map filtered to this OS + checklistType
  const photoMap = useMemo<Map<string, PhotoQueueItem>>(() => {
    const map = new Map<string, PhotoQueueItem>();
    for (const item of queue) {
      if (item.osId === osId && item.checklistType === checklistType) {
        // Keep the most recent item per slot (last write wins)
        const existing = map.get(item.slot);
        if (existing === undefined || item.createdAt > existing.createdAt) {
          map.set(item.slot, item);
        }
      }
    }
    return map;
  }, [queue, osId, checklistType]);

  // Progress: mandatory slots only (EXTERNAL + DETAIL = 12)
  const completedMandatory = useMemo<number>(() => {
    const allMandatoryKeys = [
      ...EXTERNAL_SLOTS.map((s) => s.key),
      ...DETAIL_SLOTS.map((s) => s.key),
    ];
    return allMandatoryKeys.filter((key) => photoMap.has(key)).length;
  }, [photoMap]);

  const progressFraction = completedMandatory / MANDATORY_COUNT;

  // Extra photos: slots whose keys start with 'extra_'
  const extraPhotos = useMemo<PhotoQueueItem[]>(() => {
    const extras: PhotoQueueItem[] = [];
    for (const [key, item] of photoMap.entries()) {
      if (key.startsWith('extra_')) {
        extras.push(item);
      }
    }
    // Sort by slot key so extra_0, extra_1, ... appear in order
    extras.sort((a, b) => a.slot.localeCompare(b.slot));
    return extras;
  }, [photoMap]);

  const nextExtraIndex = extraPhotos.length;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text variant="caption" style={styles.progressLabel}>
            Progresso obrigatórias
          </Text>
          <Text variant="caption" style={styles.progressCount}>
            {completedMandatory}/{MANDATORY_COUNT}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progressFraction * 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* External slots section */}
      <SlotSection
        title="Externos"
        slots={EXTERNAL_SLOTS}
        photoMap={photoMap}
        folder={folder}
        checklistType={checklistType}
        onSlotPress={onSlotPress}
      />

      {/* Detail slots section */}
      <SlotSection
        title="Detalhes"
        slots={DETAIL_SLOTS}
        photoMap={photoMap}
        folder={folder}
        checklistType={checklistType}
        onSlotPress={onSlotPress}
      />

      {/* Extra photos section */}
      <View style={styles.section}>
        <Text variant="label" style={styles.sectionHeader}>
          Extras ({extraPhotos.length})
        </Text>

        {extraPhotos.length > 0 && (
          <View style={styles.grid}>
            {extraPhotos.map((photo) => (
              <SlotCard
                key={photo.slot}
                slotKey={photo.slot}
                label="Extra"
                icon="image-outline"
                photo={photo}
                onPress={() => onSlotPress(photo.slot, folder, checklistType)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addExtraButton}
          onPress={() =>
            onSlotPress(`extra_${nextExtraIndex}`, folder, checklistType)
          }
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={20} color="#e31b1b" />
          <Text variant="label" style={styles.addExtraLabel}>
            Adicionar foto
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SLOT_SIZE = 160;
const SLOT_GAP = 12;

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },

  // Progress bar
  progressContainer: {
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#6b7280',
  },
  progressCount: {
    color: '#6b7280',
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e31b1b',
    borderRadius: 3,
  },

  // Section
  section: {
    gap: 12,
  },
  sectionHeader: {
    color: '#374151',
  },

  // Grid — 2-column layout
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
  },

  // Slot card
  slotCard: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    position: 'relative',
  },
  slotEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  slotLabel: {
    textAlign: 'center',
    color: '#9ca3af',
  },
  slotImage: {
    width: '100%',
    height: '100%',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
  },

  // Status overlay (bottom-right)
  statusOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  statusBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBubbleDone: {
    backgroundColor: '#16a34a',
  },
  statusBubbleUploading: {
    backgroundColor: '#3b82f6',
  },
  statusBubblePending: {
    backgroundColor: '#9ca3af',
  },
  statusBubbleError: {
    backgroundColor: '#ef4444',
  },
  statusErrorText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },

  // Add extra button
  addExtraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#e31b1b',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addExtraLabel: {
    color: '#e31b1b',
  },
});
