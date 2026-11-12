import React, { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  DAMAGE_TYPES,
  PANEL_LABELS,
  SEVERITIES,
  SEVERITY_COLORS,
  type PanelKey,
  type Regions,
  type Stop,
  type Vec3,
} from '@paddock/car-3d/core';
import Car3DDom from '@/components/car3d/Car3DDom';
import { SLOT_LABELS } from '@/components/checklist/PhotoSlotGrid';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import type { QueuedDamage } from '@/stores/entry-checklist.store';
import type { PhotoQueueItem } from '@/stores/photo.store';

// ponytail: o wrapper do DOM component reenvia todas as props (inclusive o .glb em base64) a cada
// render; memo + props estáveis fazem o reenvio só quando algo muda de fato.
const Car3DView = memo(Car3DDom);
const DOM_PROPS = { style: { flex: 1, backgroundColor: 'transparent' }, scrollEnabled: false } as const;

export type CarAsset = { modelUri: string; regions: Regions };

const typeLabel = (v: string): string => DAMAGE_TYPES.find((t) => t.value === v)?.label ?? v;
const severityLabel = (v: string): string => SEVERITIES.find((t) => t.value === v)?.label ?? v;

// ─── Cartões de foto dos slots (paradas 1 a 6) ────────────────────────────────

interface SlotCardsProps {
  slots: string[];
  photos: PhotoQueueItem[];
  onSlotPress: (slot: string) => void;
}

export function SlotCards({ slots, photos, onSlotPress }: SlotCardsProps): React.ReactElement | null {
  if (slots.length === 0) return null;
  return (
    <View style={styles.slots}>
      {slots.map((slot) => {
        // a última foto do slot vale; as anteriores ficam na fila (foto nunca é apagada)
        const photo = photos.filter((p) => p.slot === slot).at(-1);
        return (
          <TouchableOpacity key={slot} style={styles.slot} onPress={() => onSlotPress(slot)} activeOpacity={0.8}>
            {photo ? (
              <Image source={{ uri: photo.annotatedLocalUri ?? photo.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="camera-outline" size={28} color={Colors.textSecondary} />
            )}
            <View style={styles.slotLabel}>
              {photo && <Ionicons name="checkmark-circle" size={14} color={Colors.success} />}
              <Text variant="caption" numberOfLines={1}>
                {SLOT_LABELS[slot] ?? slot}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Parada externa (1 a 5): fotos + carro 3D + peças ─────────────────────────

interface StopScreenProps {
  stop: Stop;
  photos: PhotoQueueItem[];
  damages: QueuedDamage[];
  car: CarAsset | null;
  carFailed: boolean;
  color: string;
  highlights: { panel: PanelKey; color: string }[];
  onSlotPress: (slot: string) => void;
  onPanelPick: (panel: PanelKey, point: Vec3 | null) => void;
}

export function StopScreen({
  stop,
  photos,
  damages,
  car,
  carFailed,
  color,
  highlights,
  onSlotPress,
  onPanelPick,
}: StopScreenProps): React.ReactElement {
  // peça sem volume no modelo (ex.: caçamba num hatch) não aparece
  const panels = useMemo(
    () => (car ? stop.panels.filter((p) => (car.regions.panels[p]?.length ?? 0) > 0) : stop.panels),
    [stop.panels, car],
  );
  const stopDamages = damages.filter((d) => stop.panels.includes(d.panelKey));

  const handleTap = useCallback(async (panel: PanelKey, point: Vec3) => onPanelPick(panel, point), [onPanelPick]);
  const handleError = useCallback(async (message: string) => {
    console.warn(`[car3d] falha ao carregar o modelo: ${message.slice(0, 200)}`);
  }, []);

  return (
    <View style={styles.container}>
      <SlotCards slots={stop.slots} photos={photos} onSlotPress={onSlotPress} />

      <View style={styles.car}>
        {car ? (
          <Car3DView
            modelUri={car.modelUri}
            regions={car.regions}
            color={color}
            highlights={highlights}
            view={stop.view}
            panels={panels}
            onPanelTap={handleTap}
            onError={handleError}
            dom={DOM_PROPS}
          />
        ) : carFailed ? (
          <Text variant="bodySmall" color={Colors.textSecondary} style={styles.carNote}>
            Carro 3D indisponível sem rede. Escolha a peça na lista abaixo.
          </Text>
        ) : (
          <ActivityIndicator color={Colors.textSecondary} />
        )}
      </View>

      <Text variant="label" color={Colors.textSecondary}>
        Toque na peça com dano (no carro ou na lista)
      </Text>
      <View style={styles.chips}>
        {panels.map((panel) => {
          const hit = highlights.find((h) => h.panel === panel);
          return (
            <TouchableOpacity key={panel} style={styles.chip} onPress={() => onPanelPick(panel, null)} activeOpacity={0.8}>
              {hit && <View style={[styles.dot, { backgroundColor: hit.color }]} />}
              <Text variant="bodySmall">{PANEL_LABELS[panel]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {stopDamages.length > 0 && (
        <View style={styles.damages}>
          <Text variant="label" color={Colors.textSecondary}>
            Danos nesta parada
          </Text>
          {stopDamages.map((d) => (
            <View key={d.clientUuid} style={styles.damageRow}>
              <View style={[styles.dot, { backgroundColor: SEVERITY_COLORS[d.severity] }]} />
              <View style={{ flex: 1 }}>
                <Text variant="bodySmall">
                  {PANEL_LABELS[d.panelKey]} · {typeLabel(d.damageType)} · {severityLabel(d.severity)}
                </Text>
                {d.syncStatus === 'error' && (
                  <Text variant="caption" color={Colors.error}>
                    {d.errorMessage ?? 'Erro ao enviar'}
                  </Text>
                )}
              </View>
              <Ionicons
                name={d.syncStatus === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline'}
                size={16}
                color={d.syncStatus === 'synced' ? Colors.success : Colors.textTertiary}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slot: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.overlay,
  },
  car: { height: 240, borderRadius: Radii.lg, backgroundColor: Colors.surfaceLight, justifyContent: 'center', overflow: 'hidden' },
  carNote: { textAlign: 'center', padding: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  damages: { gap: Spacing.sm },
  damageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
});
