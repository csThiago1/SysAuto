import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import type { QueuedBelonging } from '@/stores/entry-checklist.store';
import type { PhotoQueueItem } from '@/stores/photo.store';

interface Props {
  belongings: QueuedBelonging[];
  /** Fotos da OS, para achar a do pertence pelo id. */
  photos: PhotoQueueItem[];
  /** photoId devolvido pela câmera. Só entra se o formulário pediu a foto. */
  capturedPhotoId: string | undefined;
  onTakePhoto: () => void;
  onAdd: (description: string, photoId: string) => void;
}

function Thumb({ photo }: { photo: PhotoQueueItem | undefined }): React.ReactElement {
  return (
    <View style={styles.thumb}>
      {photo ? (
        <Image source={{ uri: photo.annotatedLocalUri ?? photo.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Ionicons name="image-outline" size={22} color={Colors.textTertiary} />
      )}
    </View>
  );
}

/** Parada 7: lista de pertences; "Adicionar pertence" = foto + descrição. */
export function BelongingsStop({ belongings, photos, capturedPhotoId, onTakePhoto, onAdd }: Props): React.ReactElement {
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const awaitingPhoto = useRef(false);

  useEffect(() => {
    if (!capturedPhotoId || !awaitingPhoto.current) return;
    awaitingPhoto.current = false;
    setPhotoId(capturedPhotoId);
  }, [capturedPhotoId]);

  const reset = (): void => {
    setAdding(false);
    setDescription('');
    setPhotoId(null);
  };
  const byId = (id: string | null): PhotoQueueItem | undefined => photos.find((p) => p.id === id);

  return (
    <View style={styles.container}>
      {belongings.length === 0 && !adding && (
        <Text variant="bodySmall" color={Colors.textSecondary}>
          Nenhum pertence registrado. Se o cliente deixou algo no carro, registre com foto.
        </Text>
      )}
      {belongings.map((b) => (
        <View key={b.clientUuid} style={styles.row}>
          <Thumb photo={byId(b.photoClientUuid)} />
          <View style={{ flex: 1 }}>
            <Text variant="body">{b.description}</Text>
            {b.syncStatus === 'error' && (
              <Text variant="caption" color={Colors.error}>
                {b.errorMessage ?? 'Erro ao enviar'}
              </Text>
            )}
          </View>
          <Ionicons
            name={b.syncStatus === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline'}
            size={16}
            color={b.syncStatus === 'synced' ? Colors.success : Colors.textTertiary}
          />
        </View>
      ))}

      {adding ? (
        <View style={styles.form}>
          <TouchableOpacity
            style={styles.formPhoto}
            onPress={() => {
              awaitingPhoto.current = true;
              onTakePhoto();
            }}
            activeOpacity={0.8}
          >
            {photoId ? (
              <Thumb photo={byId(photoId)} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={26} color={Colors.textPrimary} />
                <Text variant="caption">Tirar foto</Text>
              </>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Descrição (ex.: óculos de sol no porta-luvas)"
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.actions}>
            <Button label="Cancelar" variant="ghost" onPress={reset} style={{ flex: 1 }} />
            <Button
              label="Salvar"
              disabled={!photoId || description.trim().length === 0}
              onPress={() => {
                if (!photoId) return;
                onAdd(description.trim(), photoId);
                reset();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Button label="Adicionar pertence" variant="secondary" fullWidth onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border },
  formPhoto: {
    height: 96,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
