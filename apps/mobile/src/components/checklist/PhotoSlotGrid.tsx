// apps/mobile/src/components/checklist/PhotoSlotGrid.tsx
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
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
  { key: 'step',        label: 'Estepe',             icon: 'disc-outline' },
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
  onPhotoPress: (photoId: string) => void;
}

// ─── Upload status overlay ────────────────────────────────────────────────────

interface StatusOverlayProps {
  status: PhotoQueueItem['uploadStatus'];
  hasAnnotations: boolean;
}

function StatusOverlay({ status, hasAnnotations }: StatusOverlayProps): React.ReactElement | null {
  return (
    <View style={styles.statusOverlay}>
      {hasAnnotations && (
        <View style={[styles.statusBubble, styles.statusBubbleAnnotated]}>
          <Ionicons name="pencil" size={11} color={Colors.textPrimary} />
        </View>
      )}
      {status === 'done' && (
        <View style={[styles.statusBubble, styles.statusBubbleDone]}>
          <Ionicons name="checkmark" size={12} color={Colors.textPrimary} />
        </View>
      )}
      {status === 'uploading' && (
        <View style={[styles.statusBubble, styles.statusBubbleUploading]}>
          <ActivityIndicator size="small" color={Colors.textPrimary} />
        </View>
      )}
      {status === 'pending' && (
        <View style={[styles.statusBubble, styles.statusBubblePending]}>
          <Ionicons name="time-outline" size={12} color={Colors.textPrimary} />
        </View>
      )}
      {status === 'error' && (
        <View style={[styles.statusBubble, styles.statusBubbleError]}>
          <Text style={styles.statusErrorText}>!</Text>
        </View>
      )}
    </View>
  );
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
  const imageUri = photo?.annotatedLocalUri ?? photo?.remoteUrl ?? photo?.localUri ?? null;
  const hasThumbnail = imageUri !== null;
  const hasAnnotations = (photo?.annotations?.length ?? 0) > 0;

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
            color={Colors.textSecondary}
          />
          <Text variant="caption" style={styles.slotLabel}>
            {label}
          </Text>
        </View>
      )}
      {photo !== undefined && (
        <StatusOverlay status={photo.uploadStatus} hasAnnotations={hasAnnotations} />
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
  onPhotoPress: PhotoSlotGridProps['onPhotoPress'];
}

function SlotSection({
  title,
  slots,
  photoMap,
  folder,
  checklistType,
  onSlotPress,
  onPhotoPress,
}: SlotSectionProps): React.ReactElement {
  const filledCount = slots.filter((s) => photoMap.has(s.key)).length;

  return (
    <View style={styles.section}>
      <Text variant="label" style={styles.sectionHeader}>
        {title} ({filledCount}/{slots.length})
      </Text>
      <View style={styles.grid}>
        {slots.map((slot) => {
          const photo = photoMap.get(slot.key);
          return (
            <SlotCard
              key={slot.key}
              slotKey={slot.key}
              label={slot.label}
              icon={slot.icon}
              photo={photo}
              onPress={() => {
                if (photo !== undefined) {
                  onPhotoPress(photo.id);
                } else {
                  onSlotPress(slot.key, folder, checklistType);
                }
              }}
            />
          );
        })}
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
  onPhotoPress,
}: PhotoSlotGridProps): React.ReactElement {
  const queue = usePhotoStore((s) => s.queue);

  const photoMap = useMemo<Map<string, PhotoQueueItem>>(() => {
    const map = new Map<string, PhotoQueueItem>();
    for (const item of queue) {
      if (item.osId === osId && item.checklistType === checklistType) {
        const existing = map.get(item.slot);
        if (existing === undefined || item.createdAt > existing.createdAt) {
          map.set(item.slot, item);
        }
      }
    }
    return map;
  }, [queue, osId, checklistType]);

  const completedMandatory = useMemo<number>(() => {
    const allMandatoryKeys = [
      ...EXTERNAL_SLOTS.map((s) => s.key),
      ...DETAIL_SLOTS.map((s) => s.key),
    ];
    return allMandatoryKeys.filter((key) => photoMap.has(key)).length;
  }, [photoMap]);

  const progressFraction = completedMandatory / MANDATORY_COUNT;

  const extraPhotos = useMemo<PhotoQueueItem[]>(() => {
    const extras: PhotoQueueItem[] = [];
    for (const [key, item] of photoMap.entries()) {
      if (key.startsWith('extra_')) {
        extras.push(item);
      }
    }
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
            Fotos obrigatórias
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

      <SlotSection
        title="Externos"
        slots={EXTERNAL_SLOTS}
        photoMap={photoMap}
        folder={folder}
        checklistType={checklistType}
        onSlotPress={onSlotPress}
        onPhotoPress={onPhotoPress}
      />

      <SlotSection
        title="Detalhes"
        slots={DETAIL_SLOTS}
        photoMap={photoMap}
        folder={folder}
        checklistType={checklistType}
        onSlotPress={onSlotPress}
        onPhotoPress={onPhotoPress}
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
                onPress={() => onPhotoPress(photo.id)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addExtraButton}
          onPress={() => onSlotPress(`extra_${nextExtraIndex}`, folder, checklistType)}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.brand} />
          <Text variant="label" style={styles.addExtraLabel}>
            Adicionar foto
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const COLUMNS = 3;
const SLOT_GAP = 8;
const HORIZONTAL_PADDING = 32; // Spacing.lg * 2
const SLOT_SIZE = Math.floor(
  (Dimensions.get('window').width - HORIZONTAL_PADDING - SLOT_GAP * (COLUMNS - 1)) / COLUMNS
);

const styles = StyleSheet.create({
  container: { gap: 20 },
  progressContainer: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: Colors.textTertiary },
  progressCount: { color: Colors.textTertiary, fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.brand, borderRadius: 3 },
  section: { gap: 12 },
  sectionHeader: { color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP, rowGap: SLOT_GAP },
  slotCard: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    position: 'relative',
  },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.sm },
  slotLabel: { textAlign: 'center', color: Colors.textSecondary },
  slotImage: { width: '100%', height: '100%', borderStyle: 'solid', borderColor: Colors.border },
  statusOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
  },
  statusBubble: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statusBubbleDone: { backgroundColor: Colors.success },
  statusBubbleUploading: { backgroundColor: Colors.info },
  statusBubblePending: { backgroundColor: Colors.textSecondary },
  statusBubbleError: { backgroundColor: Colors.error },
  statusBubbleAnnotated: { backgroundColor: '#7c3aed' },
  statusErrorText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  addExtraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.brand,
    borderStyle: 'dashed',
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  addExtraLabel: { color: Colors.brand },
});
