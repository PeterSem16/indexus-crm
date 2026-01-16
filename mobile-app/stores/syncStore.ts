import { create } from 'zustand';

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  error: string | null;
  isOnline: boolean;
  
  startSync: () => void;
  finishSync: (success: boolean, error?: string) => void;
  setPendingCount: (count: number) => void;
  setOnline: (online: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  error: null,
  isOnline: true,

  startSync: () => set({ isSyncing: true, error: null }),
  
  finishSync: (success: boolean, error?: string) =>
    set({
      isSyncing: false,
      lastSyncAt: success ? new Date() : null,
      error: error || null,
    }),

  setPendingCount: (count: number) => set({ pendingCount: count }),
  
  setOnline: (online: boolean) => set({ isOnline: online }),
}));
