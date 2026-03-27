import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { OSStatus } from "./types"
import { VALID_TRANSITIONS } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function canTransitionOSStatus(from: OSStatus, to: OSStatus): boolean {
  if (from === to) return true;
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}
