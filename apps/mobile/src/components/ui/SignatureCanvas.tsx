import React, { useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import * as Haptics from 'expo-haptics';
import { Button } from './Button';
import { Text } from './Text';
import { Colors, Spacing, Radii } from '@/constants/theme';

interface SignatureCanvasProps {
  onSave: (base64Png: string) => void;
  onClear?: () => void;
  initialImage?: string;
  height?: number;
  disabled?: boolean;
  penColor?: string;
  backgroundColor?: string;
}

export function SignatureCanvas({
  onSave,
  onClear,
  initialImage,
  height = 200,
  disabled = false,
  penColor = '#ffffff',
  backgroundColor = '#1c1c1e',
}: SignatureCanvasProps): React.JSX.Element {
  const ref = useRef<SignatureViewRef>(null);

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
    onClear?.();
  };

  const handleConfirm = (): void => {
    ref.current?.readSignature();
  };

  const webStyle = `.m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: ${backgroundColor}; }`;

  return (
    <View style={styles.wrapper}>
      <Text variant="labelMono" style={styles.label}>
        ASSINE ABAIXO
      </Text>
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
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  label: {
    color: Colors.textTertiary,
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
});
