import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  add: (message: string, variant: ToastVariant, duration?: number) => void;
  remove: (id: string) => void;
}

let _id = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  add: (message, variant, duration = 3000) => {
    const id = String(++_id);
    set((s) => ({ items: [...s.items, { id, message, variant, duration }] }));
  },
  remove: (id) => {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));

/** Imperative API — use anywhere without hooks */
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'success', duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'error', duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'warning', duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'info', duration),
};
