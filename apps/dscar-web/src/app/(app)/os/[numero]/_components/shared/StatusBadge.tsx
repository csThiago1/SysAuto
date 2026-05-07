/**
 * @deprecated — Use `StatusBadge` de `@/components/ui` diretamente.
 *
 * Este arquivo existe apenas para não quebrar imports existentes durante a migração.
 * Remover quando todos os imports locais forem atualizados.
 *
 * ANTES: implementação própria de STATUS_COLORS com 17 entradas inline (ERRO-03)
 * AGORA: re-exporta da fonte de verdade única em @/components/ui
 */
export { StatusBadge } from "@/components/ui";
