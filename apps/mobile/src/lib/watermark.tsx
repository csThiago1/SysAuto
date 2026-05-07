/**
 * Marca d'água discreta para fotos capturadas.
 *
 * Renderiza foto + texto no rodapé em View on-screen (por trás do overlay "Salvando"),
 * captura com react-native-view-shot.
 *
 * Formato: "DS Car · Nome do Consultor · DD/MM/YYYY HH:MM"
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, Text as RNText, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useAuthStore } from '@/stores/auth.store';

function formatDateTime(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export interface WatermarkHandle {
  apply: (photoUri: string, width: number, height: number) => Promise<string>;
}

/**
 * Componente que aplica marca d'água. Montar no JSX e usar via ref.
 * Renderiza a foto em tamanho real (1px = 1px) atrás de qualquer overlay visível.
 */
export const WatermarkOverlay = forwardRef<WatermarkHandle>(
  function WatermarkOverlay(_props, ref) {
    const viewRef = useRef<View>(null);
    const [source, setSource] = useState<{
      uri: string;
      width: number;
      height: number;
      text: string;
    } | null>(null);
    const resolveRef = useRef<((uri: string) => void) | null>(null);

    useImperativeHandle(ref, () => ({
      apply: (photoUri: string, width: number, height: number): Promise<string> => {
        const userName = useAuthStore.getState().user?.name ?? '';
        const text = `DS Car  ·  ${userName}  ·  ${formatDateTime()}`;
        return new Promise((resolve) => {
          resolveRef.current = resolve;
          setSource({ uri: photoUri, width, height, text });
        });
      },
    }));

    if (!source) return null;

    const fontSize = Math.max(24, Math.round(source.width * 0.018));

    const handleImageLoad = async (): Promise<void> => {
      // Aguarda a View pintar completamente
      await new Promise((r) => setTimeout(r, 300));
      try {
        const uri = await captureRef(viewRef, {
          format: 'jpg',
          quality: 0.85,
          result: 'tmpfile',
          width: source.width,
          height: source.height,
        });
        resolveRef.current?.(uri);
      } catch (err) {
        console.error('[Watermark] capture failed:', err);
        resolveRef.current?.(source.uri);
      }
      resolveRef.current = null;
      setSource(null);
    };

    return (
      <View
        ref={viewRef}
        collapsable={false}
        style={[styles.container, { width: source.width, height: source.height }]}
      >
        <Image
          source={{ uri: source.uri }}
          style={{ width: source.width, height: source.height }}
          resizeMode="cover"
          onLoad={() => void handleImageLoad()}
        />
        <View style={[styles.bar, { paddingVertical: fontSize * 0.4, paddingHorizontal: fontSize * 0.6 }]}>
          <RNText style={[styles.text, { fontSize }]}>{source.text}</RNText>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: -1,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  text: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
