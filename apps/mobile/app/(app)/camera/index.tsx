import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { usePhotoStore } from '@/stores/photo.store';
import { MAX_PHOTO_SIZE_PX, JPEG_QUALITY } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraParams {
  osId: string;
  slot: string;
  folder: string;
  checklistType: string;
  [key: string]: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns ImageManipulator resize actions that constrain the longer dimension
 * to MAX_PHOTO_SIZE_PX while preserving aspect ratio. Returns [] if already
 * within bounds.
 */
function buildResizeActions(
  width: number,
  height: number,
): ImageManipulator.Action[] {
  if (width <= MAX_PHOTO_SIZE_PX && height <= MAX_PHOTO_SIZE_PX) {
    return [];
  }
  if (width >= height) {
    return [{ resize: { width: MAX_PHOTO_SIZE_PX } }];
  }
  return [{ resize: { height: MAX_PHOTO_SIZE_PX } }];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CameraScreen(): React.ReactElement {
  const params = useLocalSearchParams<CameraParams>();
  const { osId, slot, folder, checklistType } = params;

  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [permission, requestPermission] = useCameraPermissions();

  // ── Permission: loading ────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#e31b1b" />
      </View>
    );
  }

  // ── Permission: not granted ────────────────────────────────────────────────

  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionTitle}>Câmera necessária</Text>
        <Text style={styles.permissionBody}>
          Para fotografar a OS, permita o acesso à câmera.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionCancelButton}
          onPress={() => router.replace(`/(app)/checklist/${osId ?? ''}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionCancelText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFlipCamera(): void {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }

  function handleToggleFlash(): void {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  }

  async function handleCapture(): Promise<void> {
    if (!cameraRef.current || isSaving) return;

    setIsSaving(true);

    try {
      // 1. Take picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: JPEG_QUALITY,
        base64: false,
      });

      if (!photo) {
        throw new Error('takePictureAsync returned null');
      }

      // 2. Resize so longer dimension ≤ MAX_PHOTO_SIZE_PX, then compress
      const resizeActions = buildResizeActions(photo.width, photo.height);

      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        resizeActions,
        { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
      );

      // 3. Ensure photos/ sub-directory exists in the document directory
      const photosDir = new Directory(Paths.document, 'photos');
      if (!photosDir.exists) {
        photosDir.create({ intermediates: true });
      }

      // 4. Generate UUID and destination file reference
      const uuid = Crypto.randomUUID();
      const destFile = new File(photosDir, `${uuid}.jpg`);

      // 5. Copy from temp URI to permanent path
      const sourceFile = new File(manipResult.uri);
      sourceFile.copy(destFile);

      // 6. Register in photo queue store
      usePhotoStore.getState().addPhoto({
        id: uuid,
        osId: osId ?? '',
        slot: slot ?? '',
        folder: folder ?? '',
        checklistType: checklistType ?? '',
        localUri: destFile.uri,
      });

      // 7. Retorna para o checklist da OS (navegação explícita — evita
      //    router.back() que retorna ao Tab raiz em vez da tela [osId])
      router.replace(`/(app)/checklist/${osId ?? ''}`);
    } catch (err: unknown) {
      console.error('[CameraScreen] capture error:', err);
      setIsSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      />

      {/* Saving overlay */}
      {isSaving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.savingText}>Salvando...</Text>
        </View>
      )}

      {/* Controls bar */}
      <View style={styles.controls}>
        {/* Flash toggle */}
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handleToggleFlash}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off-outline'}
            size={26}
            color={flash === 'on' ? '#facc15' : '#ffffff'}
          />
          <Text style={styles.sideButtonLabel}>
            {flash === 'on' ? 'Flash ligado' : 'Flash desligado'}
          </Text>
        </TouchableOpacity>

        {/* Capture button */}
        <TouchableOpacity
          style={[styles.captureButton, isSaving && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>

        {/* Flip camera */}
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handleFlipCamera}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#ffffff" />
          <Text style={styles.sideButtonLabel}>Virar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full-screen layout
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  camera: {
    flex: 1,
  },

  // Permission screens
  centeredContainer: {
    flex: 1,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBody: {
    color: '#cccccc',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  permissionCancelText: {
    color: '#aaaaaa',
    fontSize: 15,
  },

  // Saving overlay
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  savingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Bottom controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 20,
    paddingHorizontal: 24,
  },

  // Side buttons (flash, flip)
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
  },
  sideButtonLabel: {
    color: '#ffffff',
    fontSize: 11,
    marginTop: 4,
  },

  // Capture button
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  captureButtonDisabled: {
    opacity: 0.4,
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#e31b1b',
  },
});
