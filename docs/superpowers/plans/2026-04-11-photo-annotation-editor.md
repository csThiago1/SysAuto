# Photo Annotation Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullscreen photo annotation editor (arrows, circles, text) on top of checklist photos, generating a flattened annotated image for upload.

**Architecture:** New `/(app)/photo-editor` route (hidden from nav bar like `camera`) accessed from `PhotoSlotGrid` when tapping a photo that already exists. `react-native-svg` draws the annotation overlay; `react-native-view-shot` flattenizes the Image + SVG into a single JPEG. History (undo/redo, max 10) and annotations JSON are persisted in `photo.store.ts` via Zustand + MMKV.

**Tech Stack:** React Native 0.83.4 · Expo SDK 55 · react-native-svg@15.15.3 (installed) · react-native-view-shot (new) · Zustand + MMKV (existing) · expo-crypto (existing)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/mobile/package.json` | Modify | Add react-native-view-shot |
| `apps/mobile/src/stores/photo.store.ts` | Modify | Extend PhotoQueueItem + new actions |
| `apps/mobile/src/components/navigation/FrostedNavBar.tsx` | Modify | Add 'photo-editor' to HIDDEN_ROUTES |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Register photo-editor tab screen |
| `apps/mobile/app/(app)/photo-editor/_layout.tsx` | Create | Stack layout (no header) |
| `apps/mobile/app/(app)/photo-editor/index.tsx` | Create | Main editor screen (state + save logic) |
| `apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx` | Create | SVG overlay + PanResponder |
| `apps/mobile/src/components/photo-editor/EditorToolBar.tsx` | Create | Tool/color selector + undo/redo/save |
| `apps/mobile/src/components/checklist/PhotoSlotGrid.tsx` | Modify | Add onPhotoPress for filled slots |
| `apps/mobile/app/(app)/checklist/[osId].tsx` | Modify | Add handlePhotoPress → navigate to editor |

---

## Task 1: Install dependency + extend photo store + routing setup

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/src/stores/photo.store.ts`
- Modify: `apps/mobile/src/components/navigation/FrostedNavBar.tsx:67`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Install react-native-view-shot**

```bash
cd apps/mobile && npx expo install react-native-view-shot
```

Expected output: `✅ Added react-native-view-shot` (version ~4.0.0). No plugin needed in app.json.

- [ ] **Step 2: Verify install**

```bash
node -e "require('react-native-view-shot'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Extend PhotoQueueItem type and add store actions in photo.store.ts**

The full updated file `apps/mobile/src/stores/photo.store.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL } from '@/lib/constants';

// ─── MMKV storage (module-level — never recreated on render) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'photo-queue' });
} catch {
  // Expo Go — JSI não disponível
}

const mmkvStorage = {
  getItem: (name: string): string | null => _mmkv?.getString(name) ?? null,
  setItem: (name: string, value: string): void => { _mmkv?.set(name, value); },
  removeItem: (name: string): void => { _mmkv?.delete(name); },
};

// ─── Annotation types (exported for use in editor) ────────────────────────────

export type AnnotationColor = '#e31b1b' | '#facc15' | '#ffffff';
export type AnnotationTool = 'arrow' | 'circle' | 'text';

export interface ArrowAnnotation {
  id: string;
  type: 'arrow';
  x1: number; y1: number;
  x2: number; y2: number;
  color: AnnotationColor;
}

export interface CircleAnnotation {
  id: string;
  type: 'circle';
  cx: number; cy: number;
  r: number;
  color: AnnotationColor;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  x: number; y: number;
  text: string;
  color: AnnotationColor;
}

export type Annotation = ArrowAnnotation | CircleAnnotation | TextAnnotation;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoQueueItem {
  id: string;
  osId: string;
  slot: string;
  folder: string;
  checklistType: string;
  localUri: string;
  uploadStatus: 'pending' | 'uploading' | 'done' | 'error';
  remoteUrl: string | null;
  errorMessage: string | null;
  createdAt: number;
  // Annotation fields (Sprint M4)
  annotations?: Annotation[];
  annotatedLocalUri?: string | null; // flattened image — used for upload if present
  observation?: string | null;       // text note for this photo
}

interface PhotoStoreState {
  queue: PhotoQueueItem[];
  addPhoto: (photo: Omit<PhotoQueueItem, 'uploadStatus' | 'remoteUrl' | 'errorMessage' | 'createdAt' | 'annotations' | 'annotatedLocalUri' | 'observation'>) => void;
  setUploading: (id: string) => void;
  setDone: (id: string, remoteUrl: string) => void;
  setError: (id: string, message: string) => void;
  retryPhoto: (id: string) => void;
  removePhoto: (id: string) => void;
  getPhotoForSlot: (osId: string, slot: string) => PhotoQueueItem | undefined;
  getPendingCount: () => number;
  // Annotation actions
  setAnnotations: (id: string, annotations: Annotation[], annotatedLocalUri: string) => void;
  setObservation: (id: string, observation: string) => void;
}

interface PhotoUploadResponse {
  url: string;
}

export const usePhotoStore = create<PhotoStoreState>()(
  persist(
    (set, get) => ({
      queue: [],

      addPhoto: (photo) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...photo,
              uploadStatus: 'pending',
              remoteUrl: null,
              errorMessage: null,
              createdAt: Date.now(),
              annotations: undefined,
              annotatedLocalUri: null,
              observation: null,
            },
          ],
        })),

      setUploading: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, uploadStatus: 'uploading', errorMessage: null } : item,
          ),
        })),

      setDone: (id, remoteUrl) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, uploadStatus: 'done', remoteUrl, errorMessage: null } : item,
          ),
        })),

      setError: (id, message) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, uploadStatus: 'error', errorMessage: message } : item,
          ),
        })),

      retryPhoto: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, uploadStatus: 'pending', errorMessage: null } : item,
          ),
        })),

      removePhoto: (id) =>
        set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),

      getPhotoForSlot: (osId, slot) =>
        get().queue.find((item) => item.osId === osId && item.slot === slot),

      getPendingCount: () =>
        get().queue.filter((item) => item.uploadStatus === 'pending').length,

      setAnnotations: (id, annotations, annotatedLocalUri) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? { ...item, annotations, annotatedLocalUri, uploadStatus: 'pending' }
              : item,
          ),
        })),

      setObservation: (id, observation) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, observation } : item,
          ),
        })),
    }),
    {
      name: 'photo-queue',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// ─── uploadPendingPhotos ──────────────────────────────────────────────────────
// Uses annotatedLocalUri if present (flattened image with annotations baked in),
// falls back to localUri (original).

export async function uploadPendingPhotos(): Promise<void> {
  const { queue, setUploading, setDone, setError } = usePhotoStore.getState();
  const pending = queue.filter((item) => item.uploadStatus === 'pending');

  for (const item of pending) {
    const { id, osId, localUri, annotatedLocalUri, folder, slot, checklistType } = item;
    const { token, activeCompany } = useAuthStore.getState();

    setUploading(id);

    const uploadUri = annotatedLocalUri ?? localUri;

    try {
      const result = await uploadAsync(
        `${API_BASE_URL}/api/v1/service-orders/${osId}/photos/`,
        uploadUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'image',
          parameters: { folder, slot, checklist_type: checklistType },
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
            'X-Tenant-Domain': `${activeCompany}.localhost`,
          },
        },
      );

      if (result.status < 200 || result.status >= 300) {
        throw new Error(`HTTP ${result.status}`);
      }

      const parsed = JSON.parse(result.body) as PhotoUploadResponse;
      setDone(id, parsed.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(id, message);
    }
  }
}
```

- [ ] **Step 4: Add 'photo-editor' to HIDDEN_ROUTES in FrostedNavBar.tsx**

In `apps/mobile/src/components/navigation/FrostedNavBar.tsx`, line 67:

```typescript
// Before:
const HIDDEN_ROUTES = new Set(['os', 'checklist', 'camera']);

// After:
const HIDDEN_ROUTES = new Set(['os', 'checklist', 'camera', 'photo-editor']);
```

- [ ] **Step 5: Register photo-editor in _layout.tsx**

Full updated `apps/mobile/app/(app)/_layout.tsx`:

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { FrostedNavBar } from '@/components/navigation/FrostedNavBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <FrostedNavBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'OS' }} />
      <Tabs.Screen name="busca/index" options={{ title: 'Busca' }} />
      <Tabs.Screen name="nova-os/index" options={{ title: 'Nova OS' }} />
      <Tabs.Screen name="notificacoes/index" options={{ title: 'Notificacoes' }} />
      <Tabs.Screen name="perfil/index" options={{ title: 'Perfil' }} />
      {/* Detail routes — no tab icon */}
      <Tabs.Screen name="os" options={{ href: null }} />
      <Tabs.Screen name="checklist" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ href: null }} />
      <Tabs.Screen name="photo-editor" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 6: Create photo-editor stack layout**

Create `apps/mobile/app/(app)/photo-editor/_layout.tsx`:

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function PhotoEditorLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/package.json apps/mobile/src/stores/photo.store.ts \
  apps/mobile/src/components/navigation/FrostedNavBar.tsx \
  apps/mobile/app/\(app\)/_layout.tsx \
  apps/mobile/app/\(app\)/photo-editor/_layout.tsx
git commit -m "feat(mobile/annotation): instala view-shot, estende photo store, registra rota photo-editor"
```

---

## Task 2: AnnotationCanvas component

**Files:**
- Create: `apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx`

- [ ] **Step 1: Create AnnotationCanvas.tsx**

Create `apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx`:

```tsx
// apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx
import React from 'react';
import { StyleSheet, View, type GestureResponderHandlers } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Path, G } from 'react-native-svg';
import type {
  Annotation,
  ArrowAnnotation,
  CircleAnnotation,
  TextAnnotation,
  AnnotationColor,
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
  const color = ann.color as string;
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
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={arrowheadPath(ann.x1, ann.y1, ann.x2, ann.y2)}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={color}
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
      stroke={ann.color as string}
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
      fill={ann.color as string}
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
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      {/* SVG layer renders committed + in-progress annotations */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {annotations.map((ann) => renderAnnotation(ann))}
        {drawingAnnotation !== null && renderAnnotation(drawingAnnotation, 0.7)}
      </Svg>
      {/* Transparent touch capture overlay on top of SVG */}
      <View style={StyleSheet.absoluteFill} {...panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    pointerEvents: 'box-none',
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/src/components/photo-editor/AnnotationCanvas.tsx
git commit -m "feat(mobile/annotation): AnnotationCanvas com SVG (seta, círculo, texto)"
```

---

## Task 3: EditorToolBar component

**Files:**
- Create: `apps/mobile/src/components/photo-editor/EditorToolBar.tsx`

- [ ] **Step 1: Create EditorToolBar.tsx**

Create `apps/mobile/src/components/photo-editor/EditorToolBar.tsx`:

```tsx
// apps/mobile/src/components/photo-editor/EditorToolBar.tsx
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { AnnotationTool, AnnotationColor } from '@/stores/photo.store';

// ─── Color dot ────────────────────────────────────────────────────────────────

interface ColorDotProps {
  color: AnnotationColor;
  isActive: boolean;
  onPress: () => void;
}

function ColorDot({ color, isActive, onPress }: ColorDotProps): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.colorDot,
        { backgroundColor: color === '#ffffff' ? '#e5e7eb' : color },
        isActive && styles.colorDotActive,
      ]}
    />
  );
}

// ─── Tool button ──────────────────────────────────────────────────────────────

interface ToolButtonProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function ToolButton({ iconName, label, isActive, onPress }: ToolButtonProps): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.toolButton, isActive && styles.toolButtonActive]}
    >
      <Ionicons name={iconName} size={22} color={isActive ? '#ffffff' : '#374151'} />
      <Text variant="caption" style={[styles.toolLabel, isActive && styles.toolLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface EditorToolBarProps {
  activeTool: AnnotationTool;
  activeColor: AnnotationColor;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: AnnotationColor) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

const COLORS: AnnotationColor[] = ['#e31b1b', '#facc15', '#ffffff'];

export function EditorToolBar({
  activeTool,
  activeColor,
  canUndo,
  canRedo,
  isSaving,
  onToolChange,
  onColorChange,
  onUndo,
  onRedo,
  onSave,
}: EditorToolBarProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {/* Row 1: Tools + Undo/Redo */}
      <View style={styles.toolsRow}>
        <ToolButton
          iconName="arrow-forward-outline"
          label="Seta"
          isActive={activeTool === 'arrow'}
          onPress={() => onToolChange('arrow')}
        />
        <ToolButton
          iconName="ellipse-outline"
          label="Círculo"
          isActive={activeTool === 'circle'}
          onPress={() => onToolChange('circle')}
        />
        <ToolButton
          iconName="text-outline"
          label="Texto"
          isActive={activeTool === 'text'}
          onPress={() => onToolChange('text')}
        />

        <View style={styles.separator} />

        {/* Color picker */}
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <ColorDot
              key={c}
              color={c}
              isActive={activeColor === c}
              onPress={() => onColorChange(c)}
            />
          ))}
        </View>

        <View style={styles.separator} />

        {/* Undo / Redo */}
        <TouchableOpacity
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
          style={[styles.iconButton, !canUndo && styles.iconButtonDisabled]}
        >
          <Ionicons name="arrow-undo-outline" size={22} color={canUndo ? '#374151' : '#d1d5db'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
          style={[styles.iconButton, !canRedo && styles.iconButtonDisabled]}
        >
          <Ionicons name="arrow-redo-outline" size={22} color={canRedo ? '#374151' : '#d1d5db'} />
        </TouchableOpacity>
      </View>

      {/* Save button */}
      <TouchableOpacity
        onPress={onSave}
        disabled={isSaving}
        activeOpacity={0.85}
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons name="checkmark" size={20} color="#ffffff" />
        )}
        <Text variant="label" style={styles.saveLabel}>
          {isSaving ? 'Salvando...' : 'Salvar anotações'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 2,
    backgroundColor: '#f3f4f6',
  },
  toolButtonActive: {
    backgroundColor: '#e31b1b',
  },
  toolLabel: {
    color: '#374151',
    fontSize: 10,
  },
  toolLabelActive: {
    color: '#ffffff',
  },
  separator: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 2,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#374151',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    paddingVertical: 13,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    color: '#ffffff',
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/src/components/photo-editor/EditorToolBar.tsx
git commit -m "feat(mobile/annotation): EditorToolBar com seletor de ferramenta, cor, undo/redo e salvar"
```

---

## Task 4: Photo editor screen

**Files:**
- Create: `apps/mobile/app/(app)/photo-editor/index.tsx`

- [ ] **Step 1: Create photo-editor/index.tsx**

Create `apps/mobile/app/(app)/photo-editor/index.tsx`:

```tsx
// apps/mobile/app/(app)/photo-editor/index.tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Text } from '@/components/ui/Text';
import { AnnotationCanvas } from '@/components/photo-editor/AnnotationCanvas';
import { EditorToolBar } from '@/components/photo-editor/EditorToolBar';
import { usePhotoStore } from '@/stores/photo.store';
import type {
  Annotation,
  AnnotationColor,
  AnnotationTool,
  ArrowAnnotation,
  CircleAnnotation,
} from '@/stores/photo.store';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 10;

// ─── History helpers ──────────────────────────────────────────────────────────

interface HistoryState {
  stack: Annotation[][];
  index: number;
}

function makeInitialHistory(existing: Annotation[] | undefined): HistoryState {
  const initial = existing ?? [];
  return { stack: [initial], index: 0 };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface EditorParams {
  photoId: string;
  osId: string;
  [key: string]: string;
}

export default function PhotoEditorScreen(): React.ReactElement {
  const { photoId, osId } = useLocalSearchParams<EditorParams>();

  const photo = usePhotoStore((s) => s.queue.find((i) => i.id === photoId));
  const { setAnnotations, setObservation } = usePhotoStore.getState();

  // Canvas dimensions (set once via onLayout)
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  // Annotation history
  const [historyState, setHistoryState] = useState<HistoryState>(() =>
    makeInitialHistory(photo?.annotations),
  );
  const currentAnnotations = historyState.stack[historyState.index] ?? [];

  // In-progress stroke (shows while finger is down)
  const [drawingAnnotation, setDrawingAnnotation] = useState<Annotation | null>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState<AnnotationTool>('arrow');
  const [activeColor, setActiveColor] = useState<AnnotationColor>('#e31b1b');

  // Observation text
  const [observation, setObservationText] = useState<string>(photo?.observation ?? '');

  // Text modal (for text tool)
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>('');

  // Save state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // ViewShot ref
  const viewShotRef = useRef<View>(null);

  // ── History actions ──────────────────────────────────────────────────────────

  const addAnnotation = useCallback((ann: Annotation): void => {
    setHistoryState((prev) => {
      const trimmed = prev.stack.slice(0, prev.index + 1);
      const next = [...(trimmed[trimmed.length - 1] ?? []), ann];
      const newStack = [...trimmed, next].slice(-(MAX_HISTORY + 1));
      return { stack: newStack, index: newStack.length - 1 };
    });
  }, []);

  const undo = useCallback((): void => {
    setHistoryState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  }, []);

  const redo = useCallback((): void => {
    setHistoryState((prev) => ({
      ...prev,
      index: Math.min(prev.stack.length - 1, prev.index + 1),
    }));
  }, []);

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.stack.length - 1;

  // ── PanResponder ─────────────────────────────────────────────────────────────
  // Use refs so PanResponder (created once) always sees the latest state.

  const activeToolRef = useRef<AnnotationTool>(activeTool);
  const activeColorRef = useRef<AnnotationColor>(activeColor);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Keep refs in sync
  React.useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  React.useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);

  const addAnnotationRef = useRef(addAnnotation);
  React.useEffect(() => { addAnnotationRef.current = addAnnotation; }, [addAnnotation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        startRef.current = { x, y };

        if (activeToolRef.current === 'arrow') {
          setDrawingAnnotation({ id: '', type: 'arrow', x1: x, y1: y, x2: x, y2: y, color: activeColorRef.current });
        } else if (activeToolRef.current === 'circle') {
          setDrawingAnnotation({ id: '', type: 'circle', cx: x, cy: y, r: 0, color: activeColorRef.current });
        }
        // 'text' shows modal only on release (tap)
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const start = startRef.current;
        if (!start) return;

        if (activeToolRef.current === 'arrow') {
          const ann: ArrowAnnotation = {
            id: '', type: 'arrow',
            x1: start.x, y1: start.y, x2: x, y2: y,
            color: activeColorRef.current,
          };
          setDrawingAnnotation(ann);
        } else if (activeToolRef.current === 'circle') {
          const r = Math.hypot(x - start.x, y - start.y);
          const ann: CircleAnnotation = {
            id: '', type: 'circle',
            cx: start.x, cy: start.y, r,
            color: activeColorRef.current,
          };
          setDrawingAnnotation(ann);
        }
      },
      onPanResponderRelease: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const start = startRef.current;
        startRef.current = null;

        if (!start) {
          setDrawingAnnotation(null);
          return;
        }

        const dist = Math.hypot(x - start.x, y - start.y);

        if (activeToolRef.current === 'text' && dist < 8) {
          // Treat as tap — open text input modal
          setPendingTextPos({ x: start.x, y: start.y });
        } else if ((activeToolRef.current === 'arrow' || activeToolRef.current === 'circle') && dist >= 5) {
          const id = Crypto.randomUUID();
          if (activeToolRef.current === 'arrow') {
            addAnnotationRef.current({
              id, type: 'arrow',
              x1: start.x, y1: start.y, x2: x, y2: y,
              color: activeColorRef.current,
            });
          } else {
            const r = Math.hypot(x - start.x, y - start.y);
            addAnnotationRef.current({
              id, type: 'circle',
              cx: start.x, cy: start.y, r,
              color: activeColorRef.current,
            });
          }
        }

        setDrawingAnnotation(null);
      },
      onPanResponderTerminate: () => {
        startRef.current = null;
        setDrawingAnnotation(null);
      },
    }),
  ).current;

  // ── Text modal confirm ────────────────────────────────────────────────────────

  const handleTextConfirm = useCallback((): void => {
    if (!pendingTextPos || textInputValue.trim() === '') {
      setPendingTextPos(null);
      setTextInputValue('');
      return;
    }
    addAnnotation({
      id: Crypto.randomUUID(),
      type: 'text',
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      text: textInputValue.trim(),
      color: activeColor,
    });
    setPendingTextPos(null);
    setTextInputValue('');
  }, [pendingTextPos, textInputValue, addAnnotation, activeColor]);

  // ── Save handler ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (): Promise<void> => {
    if (!photoId || !viewShotRef.current || isSaving) return;
    setIsSaving(true);

    try {
      // 1. Capture the annotated view as JPEG
      const capturedUri: string = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 0.85,
        result: 'tmpfile',
      });

      // 2. Copy to permanent location
      const photosDir = new Directory(Paths.document, 'photos');
      if (!photosDir.exists) {
        photosDir.create({ intermediates: true });
      }
      const uuid = Crypto.randomUUID();
      const destFile = new File(photosDir, `${uuid}_annotated.jpg`);
      const sourceFile = new File(capturedUri);
      sourceFile.copy(destFile);

      // 3. Persist to store
      setAnnotations(photoId, currentAnnotations, destFile.uri);
      if (observation.trim() !== '') {
        setObservation(photoId, observation.trim());
      }

      // 4. Navigate back to checklist
      router.replace(`/(app)/checklist/${osId ?? ''}`);
    } catch (err: unknown) {
      console.error('[PhotoEditorScreen] save error:', err);
      setIsSaving(false);
    }
  }, [photoId, osId, isSaving, currentAnnotations, observation, setAnnotations, setObservation]);

  // ── Guard: photo not found ────────────────────────────────────────────────────

  if (!photo) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text variant="body" color="#6b7280">Foto não encontrada.</Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text variant="label" color="#e31b1b">Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageUri = photo.annotatedLocalUri ?? photo.localUri;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace(`/(app)/checklist/${osId ?? ''}`)}
            style={styles.headerButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-outline" size={26} color="#141414" />
          </TouchableOpacity>
          <Text variant="label" style={styles.headerTitle}>
            Anotar foto
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* ── Canvas area ── */}
        <View
          style={styles.canvasContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setCanvasSize({ width, height });
          }}
        >
          {canvasSize !== null && (
            <View
              ref={viewShotRef}
              style={{ width: canvasSize.width, height: canvasSize.height }}
              collapsable={false}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: canvasSize.width, height: canvasSize.height }}
                resizeMode="contain"
              />
              <AnnotationCanvas
                width={canvasSize.width}
                height={canvasSize.height}
                annotations={currentAnnotations}
                drawingAnnotation={drawingAnnotation}
                panHandlers={panResponder.panHandlers}
              />
            </View>
          )}
        </View>

        {/* ── Observation field ── */}
        <View style={styles.observationContainer}>
          <TextInput
            style={styles.observationInput}
            placeholder="Observação sobre esta foto..."
            placeholderTextColor="#9ca3af"
            value={observation}
            onChangeText={setObservationText}
            multiline
            returnKeyType="done"
          />
        </View>

        {/* ── Tool bar ── */}
        <EditorToolBar
          activeTool={activeTool}
          activeColor={activeColor}
          canUndo={canUndo}
          canRedo={canRedo}
          isSaving={isSaving}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
          onUndo={undo}
          onRedo={redo}
          onSave={handleSave}
        />
      </KeyboardAvoidingView>

      {/* ── Text input modal ── */}
      <Modal
        visible={pendingTextPos !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingTextPos(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPendingTextPos(null)}
        >
          <View style={styles.textModal}>
            <Text variant="label" style={styles.textModalTitle}>
              Adicionar texto
            </Text>
            <TextInput
              style={styles.textModalInput}
              placeholder="Digite o texto..."
              placeholderTextColor="#9ca3af"
              value={textInputValue}
              onChangeText={setTextInputValue}
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleTextConfirm}
            />
            <View style={styles.textModalButtons}>
              <TouchableOpacity
                onPress={() => { setPendingTextPos(null); setTextInputValue(''); }}
                activeOpacity={0.7}
                style={styles.textModalCancel}
              >
                <Text variant="label" color="#6b7280">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTextConfirm}
                activeOpacity={0.7}
                style={styles.textModalConfirm}
              >
                <Text variant="label" color="#ffffff">Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141414',
  },
  flex: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#141414',
  },
  headerRight: {
    width: 36,
  },

  // Canvas
  canvasContainer: {
    flex: 1,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Observation
  observationContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 80,
  },
  observationInput: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },

  // Text modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  textModal: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  textModalTitle: {
    color: '#141414',
  },
  textModalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  textModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  textModalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textModalConfirm: {
    backgroundColor: '#e31b1b',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/app/\(app\)/photo-editor/index.tsx
git commit -m "feat(mobile/annotation): tela photo-editor com histórico, ViewShot, modal de texto"
```

---

## Task 5: Wire into checklist flow

**Files:**
- Modify: `apps/mobile/src/components/checklist/PhotoSlotGrid.tsx`
- Modify: `apps/mobile/app/(app)/checklist/[osId].tsx`

- [ ] **Step 1: Add onPhotoPress to PhotoSlotGrid**

In `apps/mobile/src/components/checklist/PhotoSlotGrid.tsx`, make three changes:

**1a. Extend the props interface (line 43):**

```typescript
// Before:
interface PhotoSlotGridProps {
  osId: string;
  folder: string;
  checklistType: string;
  onSlotPress: (slot: string, folder: string, checklistType: string) => void;
}

// After:
interface PhotoSlotGridProps {
  osId: string;
  folder: string;
  checklistType: string;
  onSlotPress: (slot: string, folder: string, checklistType: string) => void;
  onPhotoPress: (photoId: string) => void;
}
```

**1b. Add onPhotoPress to the SlotCard press handler (line 110 area):**

The `SlotCard` component currently calls `onPress` regardless. We need to distinguish empty vs. filled slots. Change `SlotCard`'s `onPress` call site in `SlotSection` and in the extras section to:

In `SlotSection` props interface, add `onPhotoPress`:
```typescript
interface SlotSectionProps {
  title: string;
  slots: SlotDef[];
  photoMap: Map<string, PhotoQueueItem>;
  folder: string;
  checklistType: string;
  onSlotPress: PhotoSlotGridProps['onSlotPress'];
  onPhotoPress: PhotoSlotGridProps['onPhotoPress'];
}
```

In `SlotSection` body, change the `SlotCard` `onPress`:
```tsx
<SlotCard
  key={slot.key}
  slotKey={slot.key}
  label={slot.label}
  icon={slot.icon}
  photo={photoMap.get(slot.key)}
  onPress={() => {
    const p = photoMap.get(slot.key);
    if (p !== undefined) {
      onPhotoPress(p.id);
    } else {
      onSlotPress(slot.key, folder, checklistType);
    }
  }}
/>
```

In the extras section, the `onPress` for existing extra photos:
```tsx
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
```

**1c. Pass onPhotoPress down from PhotoSlotGrid to SlotSection:**

In `PhotoSlotGrid`'s return, add `onPhotoPress` prop to both `SlotSection` calls:
```tsx
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
```

Full updated `apps/mobile/src/components/checklist/PhotoSlotGrid.tsx` (complete file, since multiple locations change):

```tsx
// apps/mobile/src/components/checklist/PhotoSlotGrid.tsx
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
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
          <Ionicons name="pencil" size={11} color="#ffffff" />
        </View>
      )}
      {status === 'done' && (
        <View style={[styles.statusBubble, styles.statusBubbleDone]}>
          <Ionicons name="checkmark" size={12} color="#ffffff" />
        </View>
      )}
      {status === 'uploading' && (
        <View style={[styles.statusBubble, styles.statusBubbleUploading]}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
      {status === 'pending' && (
        <View style={[styles.statusBubble, styles.statusBubblePending]}>
          <Ionicons name="time-outline" size={12} color="#ffffff" />
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
            color="#9ca3af"
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
          <Ionicons name="add-circle-outline" size={20} color="#e31b1b" />
          <Text variant="label" style={styles.addExtraLabel}>
            Adicionar foto
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SLOT_SIZE = 160;
const SLOT_GAP = 12;

const styles = StyleSheet.create({
  container: { gap: 20 },
  progressContainer: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#6b7280' },
  progressCount: { color: '#6b7280', fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#e31b1b', borderRadius: 3 },
  section: { gap: 12 },
  sectionHeader: { color: '#374151' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP },
  slotCard: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    position: 'relative',
  },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  slotLabel: { textAlign: 'center', color: '#9ca3af' },
  slotImage: { width: '100%', height: '100%', borderStyle: 'solid', borderColor: '#e5e7eb' },
  statusOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
  },
  statusBubble: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statusBubbleDone: { backgroundColor: '#16a34a' },
  statusBubbleUploading: { backgroundColor: '#3b82f6' },
  statusBubblePending: { backgroundColor: '#9ca3af' },
  statusBubbleError: { backgroundColor: '#ef4444' },
  statusBubbleAnnotated: { backgroundColor: '#7c3aed' },
  statusErrorText: { color: '#ffffff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  addExtraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#e31b1b',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addExtraLabel: { color: '#e31b1b' },
});
```

- [ ] **Step 2: Add handlePhotoPress in checklist/[osId].tsx**

In `apps/mobile/app/(app)/checklist/[osId].tsx`, add the `handlePhotoPress` callback and wire it to `PhotoSlotGrid`.

**Add the callback after `handleSlotPress` (around line 131):**

```typescript
const handlePhotoPress = useCallback(
  (photoId: string): void => {
    router.push({
      pathname: '/(app)/photo-editor',
      params: { photoId, osId },
    });
  },
  [router, osId],
);
```

**Update the `PhotoSlotGrid` usage (around line 236-241):**

```tsx
// Before:
<PhotoSlotGrid
  osId={osId}
  folder={activeTab.folder}
  checklistType={activeTab.checklistType}
  onSlotPress={handleSlotPress}
/>

// After:
<PhotoSlotGrid
  osId={osId}
  folder={activeTab.folder}
  checklistType={activeTab.checklistType}
  onSlotPress={handleSlotPress}
  onPhotoPress={handlePhotoPress}
/>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Smoke test navigation**

Manually (or describe to QA agent):
1. Open checklist of any OS
2. Take a photo in any slot → returns to checklist ✅
3. Tap the photo you just took → opens photo editor with dark background and photo ✅
4. Tap "✕" → returns to checklist ✅
5. Select arrow tool → drag on photo → red arrow appears ✅
6. Select circle tool → drag → red circle appears ✅
7. Select text tool → tap on photo → modal appears → type "Risco" → Adicionar → text appears ✅
8. Tap Undo → last annotation removed ✅
9. Tap Redo → annotation restored ✅
10. Type observation → tap "Salvar anotações" → photo thumbnail in checklist shows purple pencil badge ✅

- [ ] **Step 5: Commit**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git add apps/mobile/src/components/checklist/PhotoSlotGrid.tsx \
  apps/mobile/app/\(app\)/checklist/\[osId\].tsx
git commit -m "feat(mobile/annotation): conecta editor ao checklist — toque em foto abre editor"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|-------------|-----------|
| Seta (origem → destino, vermelha, ponta sólida) | Task 2 arrowheadPath + Task 4 PanResponder |
| Círculo (toque + arraste define raio, borda vermelha, fill transparente) | Task 2 CircleAnnotation + Task 4 PanResponder |
| Texto livre (caixa posicionável) | Task 4 text modal + TextAnnotation |
| Cores: vermelho (padrão), amarelo, branco | Task 3 EditorToolBar COLORS array |
| Desfazer/Refazer até 10 ações | Task 4 HistoryState MAX_HISTORY=10 |
| Salvar: nova imagem com anotações flattenizadas | Task 4 captureRef + copy to permanent file |
| Preserva original sem anotação | Task 1 annotatedLocalUri separate from localUri |
| Campo de observação geral da foto | Task 4 TextInput observation + setObservation |
| Anotações salvas como JSON (para replay no web) | Task 1 setAnnotations action saves Annotation[] |
| Thumbnail mostra badge de anotação | Task 5 purple pencil badge in StatusOverlay |
| Ferramenta ativa selecionada visualmente | Task 3 toolButtonActive style |

All requirements covered. ✅

### Placeholder scan

No TBDs, TODOs, or incomplete code blocks found. ✅

### Type consistency

- `Annotation`, `ArrowAnnotation`, `CircleAnnotation`, `TextAnnotation` — defined in Task 1, used consistently in Tasks 2–5 ✅
- `AnnotationTool`, `AnnotationColor` — defined in Task 1, used in Tasks 3–4 ✅
- `setAnnotations(id, annotations, annotatedLocalUri)` — defined in Task 1, called in Task 4 ✅
- `onPhotoPress(photoId: string)` — defined in Task 5 PhotoSlotGrid, wired in Task 5 checklist ✅
- `panHandlers` — from `PanResponder.create().panHandlers`, passed to `AnnotationCanvas` ✅

---
