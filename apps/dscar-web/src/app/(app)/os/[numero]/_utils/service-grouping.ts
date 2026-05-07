/**
 * Service grouping helpers — extracted from ServicesTab.tsx
 *
 * `parseServiceDescription` parses the "[Tipo] Descrição" format used by
 * imported Cilia budget items.
 *
 * `groupServicesByPart` groups imported items by part name for accordion
 * display, leaving manual/complement items as a flat list.
 */

/** Parse "[Tipo] Descrição" → { svcType, partName } */
export function parseServiceDescription(desc: string): { svcType: string; partName: string } {
  const match = desc.match(/^\[(.+?)\]\s*(.+)$/)
  return match ? { svcType: match[1]!, partName: match[2]! } : { svcType: "", partName: desc }
}

export interface GroupedServiceItem {
  partName: string
  items: ServiceItem[]
  total: number
}

// Minimal shape used by grouping logic — avoids coupling to a specific type
export interface ServiceItem {
  id: string
  description: string
  source_type: string
  quantity: string | number
  unit_price: string | number
  discount?: string | number
  total: number
  service_catalog_name?: string
  billing_status?: string
}

/**
 * Agrupa itens importados por nome de peça (accordion), mantém
 * manuais/complemento como flat list.
 *
 * Grupos com apenas 1 item são rebaixados para flatItems.
 */
export function groupServicesByPart(items: ServiceItem[]): {
  groups: GroupedServiceItem[]
  flatItems: ServiceItem[]
} {
  const groups = new Map<string, Array<ServiceItem & { _svcType: string; _partName: string }>>()
  const flatItems: ServiceItem[] = []

  for (const item of items) {
    const { svcType, partName } = parseServiceDescription(item.description)
    // Itens importados com tipo de serviço → agrupar
    if (svcType && item.source_type === "import") {
      const existing = groups.get(partName) ?? []
      existing.push({ ...item, _svcType: svcType, _partName: partName })
      groups.set(partName, existing)
    } else {
      flatItems.push(item)
    }
  }

  const result: GroupedServiceItem[] = []
  for (const [partName, groupItems] of groups) {
    // Se só tem 1 item, não precisa accordion
    if (groupItems.length === 1) {
      flatItems.push(groupItems[0]!)
    } else {
      const total = groupItems.reduce((sum, i) => sum + Number(i.total ?? 0), 0)
      result.push({ partName, items: groupItems, total })
    }
  }

  return { groups: result, flatItems }
}
