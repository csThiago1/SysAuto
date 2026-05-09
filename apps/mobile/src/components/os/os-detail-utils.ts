import type { TransitionRequirements } from '@paddock/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OSPhoto {
  id: string;
  folder: string;
  url: string;
  caption?: string;
}

export interface OSLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: string;
  total: string;
}

export interface OSTransitionLog {
  id: string;
  from_status: string;
  to_status: string;
  created_at: string;       // campo real do backend StatusTransitionLog
  changed_by_name?: string; // campo real do backend (get_full_name ou email)
}

// The hook's ServiceOrderDetailAPI is the base; we extend it with the rich
// fields that the real endpoint returns but the offline model doesn't cache.
export interface ServiceOrderDetail {
  id: string;
  number: number;
  status: string;
  customer_name: string;
  customer_type: string;
  os_type: string;
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  opened_at: string;
  parts_total: string;
  services_total: string;
  consultant?: { id: string; email: string; full_name: string };
  photos?: OSPhoto[];
  parts?: OSLineItem[];
  labor_items?: OSLineItem[];
  transition_logs?: OSTransitionLog[];
  transition_requirements?: TransitionRequirements;
  casualty_number?: string;
  deductible_amount?: string;
  estimated_delivery_date?: string;
  observations?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const TAB_NAMES = ['Geral', 'Peças', 'Serviços', 'Fotos', 'Docs', 'Histórico'];

export const FOLDER_LABELS: Record<string, string> = {
  checklist_entrada: 'Checklist de Entrada',
  acompanhamento: 'Acompanhamento',
  checklist_saida: 'Checklist de Saída',
  pericia: 'Perícia',
  outros: 'Outros',
};

export const OS_TYPE_LABELS: Record<string, string> = {
  bodywork:   'Lataria/Pintura',
  warranty:   'Garantia',
  rework:     'Retrabalho',
  mechanical: 'Mecânica',
  aesthetic:  'Estética',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function groupPhotosByFolder(photos: OSPhoto[]): [string, OSPhoto[]][] {
  const grouped = photos.reduce<Record<string, OSPhoto[]>>((acc, photo) => {
    const key = photo.folder;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(photo);
    return acc;
  }, {});
  return Object.entries(grouped);
}
