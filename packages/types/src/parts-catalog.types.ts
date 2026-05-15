export interface PartCatalogApplication {
  id: string
  make: number
  make_nome: string
  model: number | null
  model_nome: string | null
  year_start: number | null
  year_end: number | null
  source: "seed" | "os_auto" | "api_external" | "manual"
  confidence_score: number
}

export interface PartCatalogSupplier {
  id: string
  supplier_name: string
  supplier_code: string
}

export interface PartCatalogReference {
  id: string
  manufacturer_code: string
  description: string
  category: number
  category_name: string
  ncm: string
  unit: string
  ean: string
  is_compatible?: boolean
  applications?: PartCatalogApplication[]
  suppliers?: PartCatalogSupplier[]
}
