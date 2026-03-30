/**
 * Paddock Solutions — TypeScript Types Compartilhados
 * Usado em hub, dscar-web, store-web e mobile
 */

// ─── Autenticação / JWT ───────────────────────────────────────────────────────

export type PaddockRole =
    | "OWNER"
    | "ADMIN"
    | "MANAGER"
    | "CONSULTANT"
    | "TECHNICIAN"
    | "SALESPERSON"
    | "ACCOUNTANT"
    | "READONLY";

export interface PaddockJWT {
    sub: string; // UUID global do usuário
    email: string;
    name: string;
    companies: string[]; // ['dscar', 'pecas']
    active_company: string; // empresa ativa na sessão
    role: PaddockRole;
    tenant_schema: string; // 'tenant_dscar'
    client_slug: string; // 'grupo-dscar'
    iat: number;
    exp: number;
}

// ─── PDV / Carrinho ───────────────────────────────────────────────────────────

export type DiscountReason = "group_loyalty" | "promotion" | "manual";

export interface CartItem {
    product_id: string;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    discount_pct: number; // 0–100
    discount_reason?: DiscountReason;
    total: number;
}

// ─── Ordens de Serviço ────────────────────────────────────────────────────────

export type ServiceOrderStatus =
    | "reception"
    | "initial_survey"
    | "budget"
    | "waiting_parts"
    | "repair"
    | "mechanic"
    | "bodywork"
    | "painting"
    | "assembly"
    | "polishing"
    | "washing"
    | "final_survey"
    | "ready"
    | "delivered"
    | "cancelled";

export interface ServiceOrder {
    id: string;
    number: number;
    plate: string;
    make: string;
    model: string;
    year: number | null;
    customer_name: string;
    customer_id: string | null;
    status: ServiceOrderStatus;
    opened_at: string; // ISO datetime
    estimated_delivery: string | null;
    total: number;
}

// ─── Paginação DRF ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// ─── Recomendações IA ─────────────────────────────────────────────────────────

export type RecommendationUrgency = "critical" | "high" | "medium" | "low";

export interface AIRecommendationItem {
    service: string;
    urgency: RecommendationUrgency;
    reason: string;
    estimated_price_range: { min: number; max: number };
}
