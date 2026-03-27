export type PersonType = 'Cliente' | 'Colaborador' | 'Seguradora' | 'Corretor';
export type EmployeeRole = 'Pintor' | 'Mecânico' | 'Funileiro' | 'Consultor' | 'Polidor' | 'Lavador' | 'Montador' | 'Administrador';

// 15 estados reais do Kanban — alinhados com o backend Django
export type OSStatus =
  | 'reception'
  | 'initial_survey'
  | 'budget'
  | 'waiting_parts'
  | 'repair'
  | 'mechanic'
  | 'bodywork'
  | 'painting'
  | 'assembly'
  | 'polishing'
  | 'washing'
  | 'final_survey'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export const OS_STATUS_LABEL: Record<OSStatus, string> = {
  reception:      'Recepção',
  initial_survey: 'Vistoria Inicial',
  budget:         'Orçamento',
  waiting_parts:  'Aguardando Peças',
  repair:         'Reparo',
  mechanic:       'Mecânica',
  bodywork:       'Funilaria',
  painting:       'Pintura',
  assembly:       'Montagem',
  polishing:      'Polimento',
  washing:        'Lavagem',
  final_survey:   'Vistoria Final',
  ready:          'Pronto para Entrega',
  delivered:      'Entregue',
  cancelled:      'Cancelada',
};

// Transições válidas — espelha VALID_TRANSITIONS do backend
export const VALID_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  reception:      ['initial_survey', 'cancelled'],
  initial_survey: ['budget'],
  budget:         ['waiting_parts', 'repair'],
  waiting_parts:  ['repair'],
  repair:         ['mechanic', 'bodywork', 'polishing'],
  mechanic:       ['bodywork', 'polishing'],
  bodywork:       ['painting'],
  painting:       ['assembly'],
  assembly:       ['polishing'],
  polishing:      ['washing'],
  washing:        ['final_survey'],
  final_survey:   ['ready'],
  ready:          ['delivered'],
  delivered:      [],
  cancelled:      [],
};

export type FinancialStatus = 'A Faturar' | 'Faturado' | 'Em aberto' | 'Parcialmente Pago' | 'Pago';
export type OSType = 'Particular' | 'Seguradora';
export type ServiceCategory = 'Funilaria/Pintura' | 'Reparação/Pintura' | 'Troca/Pintura' | 'Alinhamento' | 'Balanceamento' | 'Lavagem simples/técnica' | 'Mecânica' | 'Outros serviços';
export type InsuranceClaimType = 'Segurado' | 'Terceiro';
export type PaymentMethod = 'Débito em conta' | 'Pix' | 'Boleto' | 'Cartão 1x' | 'Cartão 2x' | 'Cartão 3x' | 'Cartão 4x' | 'Cartão 5x' | 'Cartão 6x' | 'Cartão 10x' | 'Cartão 12x';

export type InvoiceType = 'NF' | 'NFSe';
export type InvoiceStatus = 'Pendente' | 'Autorizada' | 'Cancelada' | 'Erro';
export type InvoiceDirection = 'Emitida' | 'Recebida';

export interface Invoice {
  id: string;
  number: string;
  series: string;
  type: InvoiceType;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  issuerName: string;
  issuerCnpj: string;
  receiverName: string;
  receiverCnpj: string;
  value: number;
  issueDate: string;
  xmlUrl?: string;
  danfeUrl?: string;
  orderId?: string;
}

export interface Person {
  id: string;
  name: string;
  type: PersonType;
  role?: EmployeeRole;
  phone: string;
  email: string;
  birthDate?: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  cost?: number;
  supplier?: string;
  description?: string;
}

export interface ServiceItem {
  name: string;
  price: number;
}

export interface PartItem {
  partId: string;
  quantity: number;
  price: number;
}

export interface StatusHistory {
  status: OSStatus;
  changedBy: string;
  changedAt: string;
  notes?: string;
}

export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface Photo {
  id: string;
  url: string;
  name: string;
  uploadedAt: string;
}

export interface Reminder {
  id: string;
  type: 'Entrega' | 'Revisão' | 'Outro';
  date: string;
  description: string;
  completed: boolean;
}

export interface OSTemplate {
  id: string;
  name: string;
  osType: OSType;
  serviceCategory?: ServiceCategory;
  services: ServiceItem[];
  parts: PartItem[];
  observations?: string;
}

export type OSPriority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export interface ServiceOrder {
  id: string;
  clientId: string;
  assignedEmployeeId?: string;
  osType: OSType;
  priority?: OSPriority;
  serviceCategory?: ServiceCategory;
  insuranceCompanyId?: string;
  insuranceClaimType?: InsuranceClaimType;
  deductibleAmount?: number;
  deductiblePaid?: boolean;
  vehicle: string;
  plate: string;
  status: OSStatus;
  statusHistory: StatusHistory[];
  financialStatus: FinancialStatus;
  invoiceNumber?: string;
  billedAt?: string;
  amountPaid: number;
  paymentMethod?: PaymentMethod;
  services: ServiceItem[];
  parts: PartItem[];
  checklist?: ChecklistItem[];
  photos?: Photo[];
  totalValue: number;
  observations?: string;
  reminders?: Reminder[];
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Veículos ──────────────────────────────────────────────────────────────────

export interface VehicleBrand {
  id: number;
  fipe_brand_id: number;
  name: string;
  vehicle_type: 'car' | 'motorcycle' | 'truck';
}

export interface VehicleModel {
  id: number;
  fipe_model_id: number;
  name: string;
  brand_name: string;
}

export interface VehicleVersion {
  id: number;
  fipe_code: string;
  year_model: number;
  fuel: string;
  full_name: string;
}

export interface Vehicle {
  id: number;
  plate: string;
  version?: VehicleVersion;
  description: string;
  display_name: string;
  color: string;
  year_manufacture?: number;
  chassis: string;
  renavam: string;
}

export interface PlateLookupResult {
  plate: string;
  fipe_code: string;
  full_name: string;
  year_model?: number;
  fuel: string;
  color: string;
  version_id?: number;
}
