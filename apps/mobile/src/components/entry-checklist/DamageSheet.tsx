import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  DAMAGE_TYPES,
  PANEL_LABELS,
  RELATIONS,
  SEVERITIES,
  type DamageType,
  type PanelKey,
  type Relation,
  type Severity,
  type Vec3,
} from '@paddock/car-3d/core';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import type { DamageInput } from '@/stores/entry-checklist.store';
import type { PhotoQueueItem } from '@/stores/photo.store';

interface Props {
  panelKey: PanelKey;
  point: Vec3 | null;
  /** Fotos da parada, para escolher em vez de tirar outra. */
  photos: PhotoQueueItem[];
  /** photoId devolvido pela câmera (parâmetro da rota). Só entra se este sheet pediu a foto. */
  capturedPhotoId: string | undefined;
  onTakePhoto: () => void;
  onSave: (damage: DamageInput) => void;
  onClose: () => void;
}

function Choices<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text variant="label" color={Colors.textSecondary}>
        {title}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, value === o.value && styles.chipActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text variant="bodySmall">{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** Tipo → gravidade → relação → foto (obrigatória). Fica montado enquanto a câmera abre. */
export function DamageSheet({ panelKey, point, photos, capturedPhotoId, onTakePhoto, onSave, onClose }: Props): React.ReactElement {
  const [damageType, setDamageType] = useState<DamageType | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const awaitingPhoto = useRef(false);

  useEffect(() => {
    if (!capturedPhotoId || !awaitingPhoto.current) return;
    awaitingPhoto.current = false;
    setPhotoIds((ids) => (ids.includes(capturedPhotoId) ? ids : [...ids, capturedPhotoId]));
  }, [capturedPhotoId]);

  const toggle = (id: string): void =>
    setPhotoIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const canSave = damageType && severity && relation && photoIds.length > 0;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text variant="heading3" style={{ flex: 1 }}>
            {PANEL_LABELS[panelKey]}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Fechar">
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Choices title="Tipo de dano" options={DAMAGE_TYPES} value={damageType} onChange={setDamageType} />
          {damageType && <Choices title="Gravidade" options={SEVERITIES} value={severity} onChange={setSeverity} />}
          {severity && <Choices title="Relação" options={RELATIONS} value={relation} onChange={setRelation} />}
          {relation && (
            <View style={styles.section}>
              <Text variant="label" color={Colors.textSecondary}>
                Foto do dano (obrigatória)
              </Text>
              <View style={styles.photos}>
                <TouchableOpacity
                  style={[styles.photo, styles.takePhoto]}
                  onPress={() => {
                    awaitingPhoto.current = true;
                    onTakePhoto();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={26} color={Colors.textPrimary} />
                  <Text variant="caption">Tirar agora</Text>
                </TouchableOpacity>
                {photos.map((p) => {
                  const selected = photoIds.includes(p.id);
                  return (
                    <TouchableOpacity key={p.id} style={[styles.photo, selected && styles.photoSelected]} onPress={() => toggle(p.id)}>
                      <Image source={{ uri: p.annotatedLocalUri ?? p.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.success} style={styles.check} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
        <Button
          label="Salvar dano"
          fullWidth
          disabled={!canSave}
          onPress={() => {
            if (!damageType || !severity || !relation) return;
            onSave({ panelKey, damageType, severity, relation, point, notes: '', photoClientUuids: photoIds });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  body: { gap: Spacing.lg, paddingBottom: Spacing.md },
  section: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { borderColor: Colors.brand, backgroundColor: Colors.brandTint },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: {
    width: 88,
    height: 88,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoSelected: { borderColor: Colors.success },
  takePhoto: { alignItems: 'center', justifyContent: 'center', gap: 4, borderColor: Colors.border, borderWidth: 1 },
  check: { position: 'absolute', top: 4, right: 4 },
});
