/**
 * @paddock/types — Service Catalog (Catálogo de Serviços)
 * Sprint 16 — SC-3
 */

// ─── Category ─────────────────────────────────────────────────────────────────

export type ServiceCatalogCategory =
  | "funilaria"
  | "pintura"
  | "mecanica"
  | "eletrica"
  | "estetica"
  | "alinhamento"
  | "revisao"
  | "lavagem"
  | "outros"

export const SERVICE_CATALOG_CATEGORY_LABELS: Record<ServiceCatalogCategory, string> = {
  funilaria:   "Funilaria / Chapeação",
  pintura:     "Pintura",
  mecanica:    "Mecânica",
  eletrica:    "Elétrica",
  estetica:    "Estética",
  alinhamento: "Alinhamento / Balanceamento",
  revisao:     "Revisão",
  lavagem:     "Lavagem / Higienização",
  outros:      "Outros",
}

// ─── Catalog item (list) ──────────────────────────────────────────────────────

export interface ServiceCatalogItem {
  id: string
  name: string
  category: ServiceCatalogCategory
  category_display: string
  suggested_price: string
}

// ─── Catalog item (detail) ────────────────────────────────────────────────────

export interface ServiceCatalogDetail extends ServiceCatalogItem {
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface ServiceCatalogCreatePayload {
  name: string
  description?: string
  category: ServiceCatalogCategory
  suggested_price: string
}

export type ServiceCatalogUpdatePayload = Partial<ServiceCatalogCreatePayload> & {
  is_active?: boolean
}

// ─── OS Labor items ───────────────────────────────────────────────────────────

export interface ServiceLaborItem {
  id: string
  service_catalog: string | null
  service_catalog_name: string | null
  description: string
  quantity: string
  unit_price: string
  discount: string
  total: number
  source_type: string
  source_type_display: string
  created_at: string
}

export interface ServiceLaborCreatePayload {
  service_catalog?: string | null
  description: string
  quantity: string
  unit_price: string
  discount?: string
}
