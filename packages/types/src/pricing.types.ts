/**
 * @paddock/types — Motor de Orçamentos (MO-1: Perfil Veicular)
 * Tipos para precificação, enquadramento veicular e catálogo FIPE.
 */

// ─── Empresa ─────────────────────────────────────────────────────────────────

export interface Empresa {
  id: string;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  inscricao_estadual: string;
  is_active: boolean;
}

// ─── Segmento Veicular ────────────────────────────────────────────────────────

export interface SegmentoVeicular {
  id: string;
  codigo: string;
  nome: string;
  ordem: number;
  /** DecimalField vem como string no DRF */
  fator_responsabilidade: string;
  descricao: string;
  is_active: boolean;
}

// ─── Categoria de Tamanho ─────────────────────────────────────────────────────

export interface CategoriaTamanho {
  id: string;
  codigo: string;
  nome: string;
  ordem: number;
  /** DecimalField → string */
  multiplicador_insumos: string;
  /** DecimalField → string */
  multiplicador_horas: string;
  is_active: boolean;
}

// ─── Tipo de Pintura ──────────────────────────────────────────────────────────

export interface TipoPintura {
  id: string;
  codigo: string;
  nome: string;
  complexidade: number;
  is_active: boolean;
}

// ─── Enquadramento de Veículo ─────────────────────────────────────────────────

export interface EnquadramentoVeiculo {
  id: string;
  marca: string;
  modelo: string;
  ano_inicio: number | null;
  ano_fim: number | null;
  segmento: SegmentoVeicular;
  tamanho: CategoriaTamanho;
  tipo_pintura_default: TipoPintura | null;
  segmento_codigo: string;
  tamanho_codigo: string;
  tipo_pintura_codigo: string | null;
  prioridade: number;
  is_active: boolean;
}

export type EnquadramentoOrigem =
  | "exato"
  | "marca_modelo"
  | "marca"
  | "fallback";

export interface EnquadramentoResolve {
  segmento_codigo: string;
  tamanho_codigo: string;
  tipo_pintura_codigo: string | null;
  origem: EnquadramentoOrigem;
  enquadramento_id: string | null;
  segmento: SegmentoVeicular | null;
  tamanho: CategoriaTamanho | null;
  tipo_pintura_default: TipoPintura | null;
}

// ─── FIPE — Catálogo Veicular ─────────────────────────────────────────────────

export interface VehicleMake {
  id: number;
  fipe_id: string;
  nome: string;
  nome_normalizado: string;
}

export interface VehicleModel {
  id: number;
  fipe_id: string;
  nome: string;
  nome_normalizado: string;
  marca: number;
  marca_nome: string;
}

export interface VehicleYearVersion {
  id: number;
  fipe_id: string;
  ano: number;
  combustivel: string;
  descricao: string;
  codigo_fipe: string;
  valor_referencia: string | null;
}
