import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { OSStatus } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export const OS_STATUS_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  'Em vistoria': ['Aguardando Liberação'],
  'Aguardando Liberação': ['Aguardando Peças', 'Em serviço'],
  'Aguardando Peças': ['Em serviço'],
  'Em serviço': ['Veículo Pronto'],
  'Veículo Pronto': ['Veículo Entregue'],
  'Veículo Entregue': [],
}

export function canTransitionOSStatus(from: OSStatus, to: OSStatus): boolean {
  if (from === to) {
    return true
  }

  return OS_STATUS_TRANSITIONS[from].includes(to)
}
