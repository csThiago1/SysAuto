/**
 * @paddock/types — Fiscal (NF-e, NFS-e, NFC-e)
 * Espelha apps/fiscal/models.py + serializers.py (Ciclo 06C).
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type FiscalDocumentType = "nfse" | "nfe" | "nfce";

export type FiscalDocumentStatus =
  | "pending"
  | "authorized"
  | "rejected"
  | "cancelled";

export type FiscalEnvironment = "homologacao" | "producao";

// ─── FiscalDocument ───────────────────────────────────────────────────────────

export interface FiscalDocumentList {
  id: string;
  document_type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  ref: string | null;
  environment: FiscalEnvironment;
  service_order_id: string | null;
  /** Valor total em R$ */
  amount: string;
  /** URL do XML autorizado (S3 ou media) */
  caminho_xml: string | null;
  /** URL do PDF DANFE/DPS */
  caminho_pdf: string | null;
  /** Número da NFS-e / NF-e após autorização */
  numero: string | null;
  /** Chave de acesso NF-e (44 dígitos) */
  key: string | null;
  protocolo: string | null;
  mensagem_sefaz: string | null;
  natureza_rejeicao: string | null;
  /** Total de impostos */
  valor_impostos: string | null;
  created_at: string;
}

export interface FiscalDocumentItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  /** Código de serviço LC 116/2003 */
  codigo_servico_lc116: string | null;
  valor_bruto: string | null;
  valor_liquido: string | null;
  valor_iss: string | null;
  iss_retido: boolean;
  icms_cst: string | null;
  icms_aliquota: string | null;
  icms_valor: string | null;
  pis_cst: string | null;
  pis_valor: string | null;
  cofins_cst: string | null;
  cofins_valor: string | null;
}

export interface FiscalDocument extends FiscalDocumentList {
  /** ID do destinatário (Person) */
  destinatario_id: string | null;
  config_id: string | null;
  created_by_id: string | null;
  manual_reason: string | null;
  payload_enviado: Record<string, unknown> | null;
  ultima_resposta: Record<string, unknown> | null;
  documento_referenciado_id: string | null;
  items: FiscalDocumentItem[];
}

// ─── Inputs de emissão manual NFS-e ──────────────────────────────────────────
// Espelha ManualNfseInputSerializer (nomes de campo em português conforme backend)

export interface ManualNfseItem {
  descricao: string;
  quantidade: string;
  valor_unitario: string;
  valor_desconto?: string;
}

export interface ManualNfseInput {
  /** PK inteiro do Person (destinatário) */
  destinatario_id: number;
  itens: ManualNfseItem[];
  discriminacao: string;
  manual_reason: string;
  codigo_servico_lc116?: string;
  aliquota_iss?: number | null;
  iss_retido?: boolean;
  /** ISO datetime ou null (null = agora, ≤ 30 dias passado) */
  data_emissao?: string | null;
  observacoes_contribuinte?: string;
}

// ─── Inputs de emissão NF-e de Produto (07A) ─────────────────────────────────
// Espelha ManualNfeInputSerializer + ManualNfeItemInputSerializer

export interface ManualNfeItem {
  codigo_produto?: string;
  descricao: string;
  /** NCM 8 dígitos obrigatório. Ex: "87089990" */
  ncm: string;
  unidade?: string;
  quantidade: string;
  valor_unitario: string;
  valor_desconto?: string;
}

export interface ManualNfeInput {
  /** PK inteiro do Person (destinatário) */
  destinatario_id: number;
  itens: ManualNfeItem[];
  /** 01=dinheiro, 03=crédito, 04=débito, 99=outros */
  forma_pagamento?: "01" | "03" | "04" | "99";
  observacoes?: string;
  manual_reason: string;
  /** Override opcional de CST ICMS */
  cst_icms?: string;
  /** Override opcional de alíquota ICMS */
  icms_aliquota?: number | null;
}

export interface NfeEmitFromOsInput {
  service_order_id: string;
  /** 01=dinheiro, 03=crédito, 04=débito, 99=outros */
  forma_pagamento?: "01" | "03" | "04" | "99";
}
