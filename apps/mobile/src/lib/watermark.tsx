/**
 * Marca d'água discreta para fotos capturadas.
 *
 * Renderiza foto + texto sobreposto em View off-screen,
 * captura com react-native-view-shot.
 *
 * Formato rodapé: "DS Car · Nome do Consultor · DD/MM/YYYY HH:MM"
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, StyleSheet, Text as RNText, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useAuthStore } from '@/stores/auth.store';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dscarLogo = require('../../../assets/dscar-logo.png') as number;

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
 * Componente off-screen que aplica marca d'água. Montar no JSX e usar via ref.
 *
 * ```tsx
 * const watermarkRef = useRef<WatermarkHandle>(null);
 * <WatermarkOverlay ref={watermarkRef} />
 * // ...
 * const uri = await watermarkRef.current.apply(photoUri, w, h);
 * ```
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

    // Render em tamanho reduzido proporcional (max 960px largura)
    const RENDER_W = Math.min(source.width, 960);
    const scale = RENDER_W / source.width;
    const RENDER_H = source.height * scale;
    const fontSize = Math.max(9, Math.round(11 * (source.width / 1920)));

    const handleImageLoad = async (): Promise<void> => {
      // Pequeno delay para garantir que a View renderizou
      await new Promise((r) => setTimeout(r, 150));
      try {
        const uri = await captureRef(viewRef, {
          format: 'jpg',
          quality: 0.85,
          result: 'tmpfile',
        });
        resolveRef.current?.(uri);
      } catch (err) {
        console.error('[Watermark] capture failed:', err);
        // Fallback: retorna foto original sem marca d'água
        resolveRef.current?.(source.uri);
      }
      resolveRef.current = null;
      setSource(null);
    };

    return (
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={viewRef} style={{ width: RENDER_W, height: RENDER_H }} collapsable={false}>
          <Image
            source={{ uri: source.uri }}
            style={{ width: RENDER_W, height: RENDER_H }}
            resizeMode="cover"
            onLoad={() => void handleImageLoad()}
          />
          {/* Barra semi-transparente no rodapé */}
          <View style={styles.bar}>
            <Image
              source={dscarLogo}
              style={styles.logo}
              resizeMode="contain"
              tintColor="rgba(255,255,255,0.6)"
            />
            <RNText style={[styles.text, { fontSize }]}>{source.text}</RNText>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 1,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  logo: {
    width: 28,
    height: 14,
  },
  text: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
