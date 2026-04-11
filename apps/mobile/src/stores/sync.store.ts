import { create } from 'zustand';

interface SyncState {
  lastSyncAt: number | null;
  pendingUploads: number;
  isSyncing: boolean;
  isOnline: boolean;
  setLastSync: (timestamp: number) => void;
  setPendingUploads: (count: number) => void;
  setIsSyncing: (syncing: boolean) => void;
  setIsOnline: (online: boolean) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  lastSyncAt: null,
  pendingUploads: 0,
  isSyncing: false,
  isOnline: true,
  setLastSync: (timestamp) => set({ lastSyncAt: timestamp }),
  setPendingUploads: (count) => set({ pendingUploads: count }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setIsOnline: (online) => set({ isOnline: online }),
}));
