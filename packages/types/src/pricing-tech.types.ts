/**
 * @paddock/types — Pricing Tech Types
 * Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada
 *
 * Tipos para fichas técnicas versionadas de serviços canônicos.
 */

export interface FichaTecnicaMaoObraItem {
  id: string
  /** UUID da CategoriaMaoObra */
  categoria: string
  categoria_codigo: string
  categoria_nome: string
  /** Decimal como string (ex: "2.00") */
  horas: string
  afetada_por_tamanho: boolean
  observacao: string
}

export interface FichaTecnicaInsumoItem {
  id: string
  /** UUID do MaterialCanonico */
  material_canonico: string
  material_codigo: string
  material_nome: string
  /** Decimal como string (ex: "0.3000") */
  quantidade: string
  unidade: string
  afetado_por_tamanho: boolean
  observacao: string
}

export interface FichaTecnicaServico {
  id: string
  /** UUID do ServicoCanonico */
  servico: string
  servico_nome: string
  servico_codigo: string
  versao: number
  /** UUID do TipoPintura ou null (ficha genérica) */
  tipo_pintura: string | null
  tipo_pintura_nome: string | null
  tipo_pintura_codigo: string | null
  is_active: boolean
  criada_em: string
  criada_por: string | null
  criada_por_email: string | null
  motivo_nova_versao: string
  observacoes?: string
  /** Presente no detalhe — ausente na listagem */
  maos_obra?: FichaTecnicaMaoObraItem[]
  /** Presente no detalhe — ausente na listagem */
  insumos?: FichaTecnicaInsumoItem[]
}

export interface FichaResolvida {
  ficha_id: string
  versao: number
  maos_obra: Array<{
    categoria_codigo: string
    categoria_nome: string
    /** Decimal como string */
    horas: string
    afetada_por_tamanho: boolean
  }>
  insumos: Array<{
    material_codigo: string
    material_nome: string
    /** Decimal como string */
    quantidade: string
    unidade_base: string
    afetado_por_tamanho: boolean
  }>
}

export interface NovaVersaoPayload {
  tipo_pintura_id?: string | null
  maos_obra: Array<{
    /** UUID da CategoriaMaoObra */
    categoria: string
    /** Decimal como string (ex: "2.00") */
    horas: string
    afetada_por_tamanho?: boolean
    observacao?: string
  }>
  insumos: Array<{
    /** UUID do MaterialCanonico */
    material_canonico: string
    /** Decimal como string (ex: "0.3000") */
    quantidade: string
    /** Deve corresponder à unidade_base do material */
    unidade: string
    afetado_por_tamanho?: boolean
    observacao?: string
  }>
  /** Mínimo 10 caracteres */
  motivo: string
}

export interface ResolverFichaPayload {
  servico_id: string
  tipo_pintura_codigo?: string | null
}
