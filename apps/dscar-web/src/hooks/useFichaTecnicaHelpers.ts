/**
 * Hooks helpers para fichas técnicas — wraps de hooks existentes de catálogo
 * para uso nas páginas de fichas técnicas.
 */
import { useCategoriasMaoObra } from "@/hooks/usePricingCatalog"
import type { CategoriaMaoObra } from "@paddock/types"

/**
 * Retorna as categorias de mão de obra disponíveis.
 * Abstrai o hook do catálogo para uso nas pages de fichas técnicas.
 */
export function useCategoriaMaoObra(): { categoriasMaoObra: CategoriaMaoObra[] } {
  const { data = [] } = useCategoriasMaoObra()
  return { categoriasMaoObra: data }
}
