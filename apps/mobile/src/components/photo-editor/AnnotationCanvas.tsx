// apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx
import React from 'react';
import { StyleSheet, View, type GestureResponderHandlers } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Path, G } from 'react-native-svg';
import type {
  Annotation,
  ArrowAnnotation,
  CircleAnnotation,
  TextAnnotation,
} from '@/stores/photo.store';

// ─── Arrowhead path helper ────────────────────────────────────────────────────

/**
 * Returns an SVG path string for an arrowhead at (x2, y2) pointing away from (x1, y1).
 * The arrowhead has two "wings" of length `size` at ±30° from the arrow direction.
 */
function arrowheadPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 18,
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const lx = x2 - size * Math.cos(angle - Math.PI / 6);
  const ly = y2 - size * Math.sin(angle - Math.PI / 6);
  const rx = x2 - size * Math.cos(angle + Math.PI / 6);
  const ry = y2 - size * Math.sin(angle + Math.PI / 6);
  return `M ${lx} ${ly} L ${x2} ${y2} L ${rx} ${ry}`;
}

// ─── Individual annotation renderers ─────────────────────────────────────────

function renderArrow(ann: ArrowAnnotation, opacity = 1): React.ReactElement {
  const len = Math.hypot(ann.x2 - ann.x1, ann.y2 - ann.y1);
  // Shorten the line endpoint so it doesn't overlap the arrowhead
  const shortenBy = Math.min(16, len * 0.4);
  const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
  const x2s = ann.x2 - shortenBy * Math.cos(angle);
  const y2s = ann.y2 - shortenBy * Math.sin(angle);

  return (
    <G key={ann.id} opacity={opacity}>
      <Line
        x1={ann.x1} y1={ann.y1}
        x2={x2s} y2={y2s}
        stroke={ann.color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={arrowheadPath(ann.x1, ann.y1, ann.x2, ann.y2)}
        stroke={ann.color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={ann.color}
      />
    </G>
  );
}

function renderCircle(ann: CircleAnnotation, opacity = 1): React.ReactElement {
  return (
    <Circle
      key={ann.id}
      cx={ann.cx} cy={ann.cy}
      r={Math.max(ann.r, 2)}
      stroke={ann.color}
      strokeWidth={3}
      fill="transparent"
      opacity={opacity}
    />
  );
}

function renderText(ann: TextAnnotation, opacity = 1): React.ReactElement {
  return (
    <SvgText
      key={ann.id}
      x={ann.x} y={ann.y}
      fill={ann.color}
      fontSize={18}
      fontWeight="bold"
      opacity={opacity}
      stroke="#000000"
      strokeWidth={0.5}
    >
      {ann.text}
    </SvgText>
  );
}

function renderAnnotation(ann: Annotation, opacity = 1): React.ReactElement | null {
  if (ann.type === 'arrow') return renderArrow(ann, opacity);
  if (ann.type === 'circle') return renderCircle(ann, opacity);
  if (ann.type === 'text') return renderText(ann, opacity);
  return null;
}

// ─── Memoized layer for committed annotations ─────────────────────────────────
// Avoids re-render on every draw frame — only updates when committed annotations change.

const CommittedLayer = React.memo(function CommittedLayer({
  width,
  height,
  annotations,
}: {
  width: number;
  height: number;
  annotations: Annotation[];
}): React.ReactElement {
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {annotations.map((ann) => (
        <React.Fragment key={ann.id}>{renderAnnotation(ann)}</React.Fragment>
      ))}
    </Svg>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

export interface AnnotationCanvasProps {
  width: number;
  height: number;
  annotations: Annotation[];
  drawingAnnotation: Annotation | null; // preview of in-progress stroke
  panHandlers: GestureResponderHandlers;
}

export function AnnotationCanvas({
  width,
  height,
  annotations,
  drawingAnnotation,
  panHandlers,
}: AnnotationCanvasProps): React.ReactElement {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.container]}
      accessibilityRole="image"
      accessibilityLabel={`Canvas com ${annotations.length} anotações`}
    >
      {/* Stable layer — only re-renders when committed annotations change */}
      <CommittedLayer width={width} height={height} annotations={annotations} />
      {/* Live layer — re-renders on every draw frame, only contains in-progress preview */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {drawingAnnotation !== null && (
          <React.Fragment key={drawingAnnotation.id}>
            {renderAnnotation(drawingAnnotation, 0.7)}
          </React.Fragment>
        )}
      </Svg>
      {/* Transparent touch capture overlay */}
      <View
        style={StyleSheet.absoluteFill}
        {...panHandlers}
        accessibilityRole="image"
        accessibilityLabel="Área de anotação sobre a foto"
        accessibilityHint="Desenhe setas, círculos ou texto sobre a foto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    pointerEvents: 'box-none',
  },
});
