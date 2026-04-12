import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL } from '@/lib/constants';

// ─── MMKV storage (module-level — never recreated on render) ─────────────────
// MMKV requer JSI nativo — não disponível no Expo Go. Fallback in-memory.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'photo-queue' });
} catch {
  // Expo Go — JSI não disponível, fila vive apenas em memória nesta sessão
}

const mmkvStorage = {
  getItem: (name: string): string | null => _mmkv?.getString(name) ?? null,
  setItem: (name: string, value: string): void => {
    _mmkv?.set(name, value);
  },
  removeItem: (name: string): void => {
    _mmkv?.delete(name);
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoQueueItem {
  id: string;               // local UUID
  osId: string;             // service order remote ID
  slot: string;             // checklist slot key ('frente', 'traseira', etc.)
  folder: string;           // 'checklist_entrada' | 'acompanhamento' | 'checklist_saida' | etc.
  checklistType: string;    // 'entrada' | 'saida' | 'acompanhamento'
  localUri: string;         // expo-file-system URI (file://)
  uploadStatus: 'pending' | 'uploading' | 'done' | 'error';
  remoteUrl: string | null; // S3 URL after successful upload
  errorMessage: string | null;
  createdAt: number;        // timestamp ms
}

interface PhotoStoreState {
  queue: PhotoQueueItem[];
  // Actions
  addPhoto: (photo: Omit<PhotoQueueItem, 'uploadStatus' | 'remoteUrl' | 'errorMessage' | 'createdAt'>) => void;
  setUploading: (id: string) => void;
  setDone: (id: string, remoteUrl: string) => void;
  setError: (id: string, message: string) => void;
  retryPhoto: (id: string) => void;
  removePhoto: (id: string) => void;
  getPhotoForSlot: (osId: string, slot: string) => PhotoQueueItem | undefined;
  getPendingCount: () => number;
}

// ─── Upload API response shape ────────────────────────────────────────────────

interface PhotoUploadResponse {
  url: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

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
            },
          ],
        })),

      setUploading: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? { ...item, uploadStatus: 'uploading', errorMessage: null }
              : item,
          ),
        })),

      setDone: (id, remoteUrl) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? { ...item, uploadStatus: 'done', remoteUrl, errorMessage: null }
              : item,
          ),
        })),

      setError: (id, message) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? { ...item, uploadStatus: 'error', errorMessage: message }
              : item,
          ),
        })),

      retryPhoto: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? { ...item, uploadStatus: 'pending', errorMessage: null }
              : item,
          ),
        })),

      removePhoto: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),

      getPhotoForSlot: (osId, slot) =>
        get().queue.find((item) => item.osId === osId && item.slot === slot),

      getPendingCount: () =>
        get().queue.filter((item) => item.uploadStatus === 'pending').length,
    }),
    {
      name: 'photo-queue',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

// ─── uploadPendingPhotos (standalone — not part of the store) ─────────────────
//
// Processes all 'pending' items sequentially to avoid overwhelming the mobile
// connection. Mutates store state via the exported actions.

export async function uploadPendingPhotos(): Promise<void> {
  const { queue, setUploading, setDone, setError } = usePhotoStore.getState();
  const pending = queue.filter((item) => item.uploadStatus === 'pending');

  for (const item of pending) {
    const { id, osId, localUri, folder, slot, checklistType } = item;
    const { token, activeCompany } = useAuthStore.getState();

    setUploading(id);

    try {
      const result = await uploadAsync(
        `${API_BASE_URL}/api/v1/service-orders/${osId}/photos/`,
        localUri,
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
