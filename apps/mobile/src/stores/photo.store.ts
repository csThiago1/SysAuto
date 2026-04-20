import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, getTenantDomain } from '@/lib/constants';

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
  // Sync: substitui o osId local pelo remoteId do servidor após push bem-sucedido
  updateOsId: (oldOsId: string, newOsId: string) => void;
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

      updateOsId: (oldOsId, newOsId) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.osId === oldOsId ? { ...item, osId: newOsId } : item,
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
    const { id, osId, localUri, annotatedLocalUri, folder, slot, checklistType, observation } = item;
    const { token, activeCompany } = useAuthStore.getState();

    // Pula fotos de OS offline ainda não sincronizadas com o servidor.
    if (!osId) {
      continue;
    }

    setUploading(id);

    const uploadUri = annotatedLocalUri ?? localUri;
    const url = `${API_BASE_URL}/api/v1/service-orders/${osId}/photos/`;

    try {
      // FormData multipart — abordagem padrão React Native, sem depender de expo-file-system/legacy
      const body = new FormData();
      body.append('file', { uri: uploadUri, type: 'image/jpeg', name: 'photo.jpg' } as never);
      body.append('folder', folder);
      body.append('slot', slot);
      body.append('checklist_type', checklistType);
      body.append('caption', observation ?? '');

      const response = await fetch(url, {
        method: 'POST',
        // Não definir Content-Type manualmente — o fetch seta automaticamente
        // com o boundary correto para multipart/form-data
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'X-Tenant-Domain': getTenantDomain(activeCompany),
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const parsed = (await response.json()) as PhotoUploadResponse;
      setDone(id, parsed.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.warn(`[photo upload] id=${id} osId=${osId} folder=${folder} erro:`, message);
      setError(id, message);
    }
  }
}
