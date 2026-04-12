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
        } else if (
          (activeToolRef.current === 'arrow' && dist >= 5) ||
          (activeToolRef.current === 'circle' && dist >= 12)
        ) {
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
      setObservation(photoId, observation.trim());

      // 4. Navigate back to checklist
      setIsSaving(false);
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
