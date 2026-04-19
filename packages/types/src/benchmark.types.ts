// Paddock Solutions — Pricing Benchmark Types
// MO-8: Benchmark de Mercado + IA Composição

export type BenchmarkFonteTipo =
  | "seguradora_pdf"
  | "seguradora_json"
  | "cotacao_externa"
  | "concorrente"

export type BenchmarkIngestaoStatus =
  | "recebido"
  | "processando"
  | "concluido"
  | "erro"

export type BenchmarkTipoItem = "servico" | "peca"

export type AvaliacaoIA = "util" | "parcial" | "ruim"

export interface BenchmarkFonte {
  id: string
  empresa: string
  nome: string
  tipo: BenchmarkFonteTipo
  fornecedor: string | null
  confiabilidade: string
  is_active: boolean
  created_at: string
}

export interface BenchmarkIngestao {
  id: string
  fonte: string
  fonte_nome: string
  fonte_tipo: BenchmarkFonteTipo
  arquivo: string | null
  metadados: Record<string, unknown>
  status: BenchmarkIngestaoStatus
  iniciado_em: string | null
  concluido_em: string | null
  amostras_importadas: number
  amostras_descartadas: number
  log_erro: string
  criado_por: string | null
  criado_em: string
}

export interface BenchmarkAmostra {
  id: string
  ingestao: string
  fonte: string
  tipo_item: BenchmarkTipoItem
  servico_canonico: string | null
  servico_nome: string | null
  peca_canonica: string | null
  peca_nome: string | null
  descricao_bruta: string
  alias_match_confianca: string | null
  segmento: string | null
  tamanho: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: number | null
  valor_praticado: string
  moeda: string
  data_referencia: string
  metadados: Record<string, unknown>
  revisado: boolean
  descartada: boolean
  motivo_descarte: string
}

export interface BenchmarkEstatisticas {
  count: number
  p50: string | null
  p90: string | null
  minimo: string | null
  maximo: string | null
  janela_dias?: number
}

// IA Composição

export interface SugestaoIAItem {
  codigo: string
  quantidade: number
  confianca: number
  motivo: string
}

export interface SugestaoIAOpcional {
  tipo: "servico" | "peca"
  codigo: string
  motivo: string
}

export interface SugestaoIAResultado {
  servicos: SugestaoIAItem[]
  pecas: SugestaoIAItem[]
  opcional: SugestaoIAOpcional[]
  avisos: string[]
  _meta?: { elapsed_ms: number; modelo: string }
}

export interface SugestaoIA {
  id: string
  orcamento: string | null
  briefing: string
  veiculo_info: Record<string, unknown>
  resposta_raw: SugestaoIAResultado
  avaliacao: AvaliacaoIA | ""
  modelo_usado: string
  tempo_resposta_ms: number | null
  criado_por: string | null
  criado_em: string
}

export interface SugestaoIACreatePayload {
  briefing: string
  orcamento_id?: string
  veiculo: {
    marca: string
    modelo: string
    ano: number
    segmento?: string
  }
}

export interface SugestaoIAResponse {
  sugestao_id: string
  resultado: SugestaoIAResultado
}
