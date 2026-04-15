/**
 * @paddock/utils — Formatters
 * Funções puras de formatação. Sem side-effects, sem imports de API.
 */

// ─── Data e hora ──────────────────────────────────────────────────────────────

/** Formata data ISO (YYYY-MM-DD ou datetime) como dd/MM/yyyy */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Adiciona horário para evitar problema de timezone em datas sem hora
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T12:00:00");
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Formata datetime ISO como dd/MM/yyyy HH:mm */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Retorna data de hoje no formato YYYY-MM-DD (para filtros de API) */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

/** Retorna datetime atual no formato ISO 8601 */
export function nowISO(): string {
  return new Date().toISOString();
}

// ─── Moeda ────────────────────────────────────────────────────────────────────

interface FormatCurrencyOptions {
  /** Exibe valor abreviado: R$1,2k ou R$2,5M */
  compact?: boolean
}

/** Formata número ou string numérica como BRL.
 *  Passar `{ compact: true }` para exibição abreviada (ex.: R$1,2k, R$2,5M).
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: FormatCurrencyOptions,
): string {
  const n = value == null ? 0 : typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "R$ 0,00";

  if (options?.compact) {
    if (Math.abs(n) >= 1_000_000) {
      return `R$${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
    }
    if (Math.abs(n) >= 1_000) {
      return `R$${(n / 1_000).toFixed(1).replace(".", ",")}k`;
    }
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

// ─── Nomes e texto ────────────────────────────────────────────────────────────

/** Extrai iniciais de um nome (máx. 2 letras maiúsculas) */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Trunca texto longo com reticências */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

// ─── Números ──────────────────────────────────────────────────────────────────

/** Formata número de OS com zeros à esquerda (ex: 0042) */
export function formatOSNumber(n: number): string {
  return String(n).padStart(4, "0");
}
