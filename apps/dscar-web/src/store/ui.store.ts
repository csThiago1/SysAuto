import { create } from "zustand";

// Store de UI — adicionar outros estados globais de UI aqui conforme necessário
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface UIStore {}

export const useUIStore = create<UIStore>()(() => ({}));
