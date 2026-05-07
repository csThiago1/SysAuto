import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Button } from './Button';
import { Text } from './Text';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SignatureCanvasProps {
  onSave: (base64Png: string) => void;
  onClear?: () => void;
  initialImage?: string;
  height?: number;
  disabled?: boolean;
  penColor?: string;
  backgroundColor?: string;
  /** Nome exibido no preview ao lado da assinatura */
  signerName?: string;
}

export function SignatureCanvas({
  onSave,
  onClear,
  initialImage,
  height = 200,
  disabled = false,
  penColor = '#ffffff',
  backgroundColor = '#1c1c1e',
  signerName,
}: SignatureCanvasProps): React.JSX.Element {
  const ref = useRef<SignatureViewRef>(null);
  const fullscreenRef = useRef<SignatureViewRef>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);

  // Preview-only mode
  if (disabled && initialImage) {
    return (
      <View style={[styles.container, { height }]}>
        <Image
          source={{ uri: initialImage }}
          style={[styles.preview, { height }]}
          resizeMode="contain"
        />
      </View>
    );
  }

  const handleSave = (signature: string): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const base64 = signature.replace('data:image/png;base64,', '');
    onSave(base64);
  };

  const handleClear = (): void => {
    ref.current?.clearSignature();
    fullscreenRef.current?.clearSignature();
    setPreviewBase64(null);
    onClear?.();
  };

  const handleConfirm = (): void => {
    if (fullscreen) {
      fullscreenRef.current?.readSignature();
    } else {
      ref.current?.readSignature();
    }
  };

  const openFullscreen = async (): Promise<void> => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
    );
    setFullscreen(true);
    setPreviewBase64(null);
  };

  const closeFullscreen = async (): Promise<void> => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
    setFullscreen(false);
  };

  const handleFullscreenSave = (signature: string): void => {
    const base64 = signature.replace('data:image/png;base64,', '');
    setPreviewBase64(base64);
  };

  const handleFullscreenConfirm = async (): Promise<void> => {
    if (previewBase64) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await closeFullscreen();
      onSave(previewBase64);
    } else {
      // Trigger readSignature to get the preview first
      fullscreenRef.current?.readSignature();
    }
  };

  const webStyle = `.m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: ${backgroundColor}; }`;

  const { width: screenW, height: screenH } = Dimensions.get('screen');
  const landscapeW = Math.max(screenW, screenH);
  const landscapeH = Math.min(screenW, screenH);

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.headerRow}>
          <Text variant="mono" style={styles.label}>
            ASSINE ABAIXO
          </Text>
          <TouchableOpacity
            onPress={() => void openFullscreen()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.expandBtn}
          >
            <Ionicons name="expand-outline" size={18} color={Colors.textTertiary} />
            <Text variant="caption" color={Colors.textTertiary}>
              Tela cheia
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.container, { height }]}>
          <SignatureScreen
            ref={ref}
            onOK={handleSave}
            webStyle={webStyle}
            penColor={penColor}
            backgroundColor={backgroundColor}
            dotSize={2}
            minWidth={1.5}
            maxWidth={3}
          />
        </View>
        <View style={styles.actions}>
          <Button variant="ghost" label="Limpar" onPress={handleClear} />
          <Button variant="primary" label="Confirmar" onPress={handleConfirm} />
        </View>
      </View>

      {/* Fullscreen landscape modal */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        supportedOrientations={['landscape']}
        statusBarTranslucent
        onRequestClose={() => void closeFullscreen()}
      >
        <StatusBar hidden />
        <View style={[styles.fullscreenContainer, { width: landscapeW, height: landscapeH }]}>
          {previewBase64 ? (
            /* Preview mode — mostra assinatura + nome */
            <View style={styles.previewContainer}>
              <Text variant="mono" style={styles.previewTitle}>
                PREVIEW DA ASSINATURA
              </Text>
              <View style={styles.previewCard}>
                <Image
                  source={{ uri: `data:image/png;base64,${previewBase64}` }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <View style={styles.previewLine} />
                {signerName ? (
                  <Text variant="body" style={styles.previewName}>
                    {signerName}
                  </Text>
                ) : null}
                <Text variant="caption" color={Colors.textTertiary}>
                  Assinatura Digital
                </Text>
              </View>
              <Text variant="caption" color={Colors.textTertiary} style={{ textAlign: 'center' }}>
                É assim que a assinatura aparecerá nos documentos
              </Text>
              <View style={styles.previewActions}>
                <Button
                  variant="ghost"
                  label="Refazer"
                  onPress={() => {
                    setPreviewBase64(null);
                    fullscreenRef.current?.clearSignature();
                  }}
                />
                <Button
                  variant="primary"
                  label="Confirmar e Salvar"
                  onPress={() => void handleFullscreenConfirm()}
                />
              </View>
            </View>
          ) : (
            /* Canvas mode — desenhar assinatura */
            <View style={styles.fullscreenCanvas}>
              <View style={styles.fullscreenHeader}>
                <TouchableOpacity onPress={() => void closeFullscreen()}>
                  <Ionicons name="close" size={28} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text variant="mono" color={Colors.textTertiary}>
                  ASSINE COM O DEDO
                </Text>
                <View style={{ width: 28 }} />
              </View>
              <View style={styles.fullscreenCanvasArea}>
                <SignatureScreen
                  ref={fullscreenRef}
                  onOK={handleFullscreenSave}
                  webStyle={webStyle}
                  penColor={penColor}
                  backgroundColor={backgroundColor}
                  dotSize={3}
                  minWidth={2}
                  maxWidth={4}
                />
              </View>
              {signerName ? (
                <Text variant="bodySmall" color={Colors.textTertiary} style={{ textAlign: 'center' }}>
                  {signerName}
                </Text>
              ) : null}
              <View style={styles.fullscreenActions}>
                <Button
                  variant="ghost"
                  label="Limpar"
                  onPress={() => fullscreenRef.current?.clearSignature()}
                />
                <Button
                  variant="primary"
                  label="Ver Preview"
                  onPress={() => fullscreenRef.current?.readSignature()}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: Colors.textTertiary,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  container: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    borderRadius: Radii.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  // Fullscreen
  fullscreenContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
  },
  fullscreenCanvas: {
    flex: 1,
    gap: Spacing.sm,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenCanvasArea: {
    flex: 1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  fullscreenActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  // Preview
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  previewTitle: {
    color: Colors.textTertiary,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 320,
  },
  previewImage: {
    width: 280,
    height: 80,
  },
  previewLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#000000',
  },
  previewName: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '600',
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
});
