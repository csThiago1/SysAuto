/**
 * @paddock/types — WMS: Hierarquia de Localização Física
 * Armazém → Rua → Prateleira → Nível
 */

export type ArmazemTipo = "galpao" | "patio"

export interface Armazem {
  id: string
  nome: string
  codigo: string
  tipo: ArmazemTipo
  endereco: string
  responsavel: string | null
  observacoes: string
  total_ruas: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Rua {
  id: string
  armazem: string
  armazem_codigo: string
  codigo: string
  descricao: string
  ordem: number
  total_prateleiras: number
  is_active: boolean
  created_at: string
}

export interface Prateleira {
  id: string
  rua: string
  rua_codigo: string
  codigo: string
  descricao: string
  capacidade_kg: string | null
  ordem: number
  total_niveis: number
  is_active: boolean
  created_at: string
}

export interface Nivel {
  id: string
  prateleira: string
  prateleira_codigo: string
  codigo: string
  descricao: string
  altura_cm: number | null
  largura_cm: number | null
  profundidade_cm: number | null
  ordem: number
  endereco_completo: string
  total_unidades: number
  total_lotes: number
  is_active: boolean
  created_at: string
}

export interface OcupacaoRua {
  rua_id: string
  rua_codigo: string
  descricao: string
  total_niveis: number
  total_unidades: number
  total_lotes: number
}

export interface NivelConteudo {
  unidades: unknown[]
  lotes: unknown[]
}
