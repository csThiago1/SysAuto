/**
 * DS Car Mobile — Design Tokens
 * Tema escuro glass, inspirado no dark mode da Apple.
 * Use sempre estas constantes em vez de hex hardcoded.
 */
import { Platform } from 'react-native';

export const Colors = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  /** Fundo principal de todas as telas */
  bg: '#141414',
  /** Header / navbar */
  bgHeader: '#1c1c1e',
  /** Card glass — topo do degradê */
  cardTop: '#3a3a3e',
  /** Card glass — base do degradê */
  cardBottom: '#1e1e22',
  /** Input / botão ghost */
  inputBg: 'rgba(255, 255, 255, 0.08)',
  /** Surface levemente elevada (modais, sheets) */
  surface: '#1c1c1e',
  /** Surface mais clara (rows de lista) */
  surfaceLight: 'rgba(255, 255, 255, 0.05)',

  // ── Borders / glass ───────────────────────────────────────────────────────
  /** Borda glass — topo do card (glint) */
  borderGlintTop: 'rgba(255, 255, 255, 0.22)',
  /** Borda glass — lateral */
  borderGlintSide: 'rgba(255, 255, 255, 0.06)',
  /** Borda glass — base */
  borderGlintBottom: 'rgba(0, 0, 0, 0.4)',
  /** Borda padrão de inputs e containers */
  border: 'rgba(255, 255, 255, 0.10)',
  /** Borda sutil */
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  /** Divisor de lista */
  divider: 'rgba(255, 255, 255, 0.06)',

  // ── Textos ────────────────────────────────────────────────────────────────
  /** Texto principal */
  textPrimary: '#ffffff',
  /** Texto secundário / labels */
  textSecondary: '#9ca3af',
  /** Texto terciário / placeholders */
  textTertiary: '#6b7280',
  /** Texto inverso (em fundos claros) */
  textInverse: '#111827',

  // ── Marca DS Car ─────────────────────────────────────────────────────────
  /** Vermelho DS Car */
  brand: '#e31b1b',
  /** Vermelho claro (tint) */
  brandTint: 'rgba(227, 27, 27, 0.15)',
  /** Vermelho escuro (shade) */
  brandShade: '#b91c1c',

  // ── Utilitários ──────────────────────────────────────────────────────────
  /** Overlay de modal / backdrop */
  overlay: 'rgba(0, 0, 0, 0.6)',
  /** Overlay escuro suave */
  overlayLight: 'rgba(0, 0, 0, 0.4)',
  /** Placeholder de skeleton */
  skeleton: 'rgba(255, 255, 255, 0.10)',
  /** Ativo / selecionado */
  active: '#e31b1b',
  /** Sucesso */
  success: '#16a34a',
  /** Alerta */
  warning: '#f59e0b',
  /** Erro */
  error: '#ef4444',
  /** Info */
  info: '#3b82f6',
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

// ── Semantic Badge Colors ─────────────────────────────────────────────────
export const SemanticColors = {
  success: {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.10)',
    border: 'rgba(74,222,128,0.20)',
  },
  error: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.20)',
  },
  warning: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.20)',
  },
  info: {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.20)',
  },
  neutral: {
    color: 'rgba(255,255,255,0.55)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
  },
} as const;

export type SemanticVariant = keyof typeof SemanticColors;

// ── Typography Presets ────────────────────────────────────────────────────
const MONO_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export const Typography = {
  labelMono: {
    fontSize: 10,
    fontFamily: MONO_FAMILY,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#cc4444',
  },
  mono: {
    fontSize: 14,
    fontFamily: MONO_FAMILY,
    letterSpacing: 0.5,
  },
  plate: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 3,
  },
  osNumber: {
    fontSize: 14,
    fontFamily: MONO_FAMILY,
    fontWeight: '600' as const,
    color: '#cc4444',
  },
} as const;

// ── OS Status Map (Single Source of Truth) ────────────────────────────────
export const OS_STATUS_MAP = {
  reception:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',    label: 'Recepção',            semantic: 'info'    as SemanticVariant },
  initial_survey: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',   label: 'Vistoria Inicial',    semantic: 'info'    as SemanticVariant },
  budget:         { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    label: 'Orçamento',           semantic: 'warning' as SemanticVariant },
  waiting_auth:   { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',    label: 'Aguard. Autorização', semantic: 'warning' as SemanticVariant },
  authorized:     { color: '#34d399', bg: 'rgba(52,211,153,0.15)',    label: 'Autorizada',          semantic: 'success' as SemanticVariant },
  waiting_parts:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',   label: 'Aguard. Peças',       semantic: 'neutral' as SemanticVariant },
  repair:         { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',    label: 'Reparo',              semantic: 'info'    as SemanticVariant },
  mechanic:       { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',    label: 'Mecânica',            semantic: 'info'    as SemanticVariant },
  bodywork:       { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',    label: 'Funilaria',           semantic: 'warning' as SemanticVariant },
  painting:       { color: '#c084fc', bg: 'rgba(192,132,252,0.15)',   label: 'Pintura',             semantic: 'info'    as SemanticVariant },
  assembly:       { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    label: 'Montagem',            semantic: 'warning' as SemanticVariant },
  polishing:      { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',    label: 'Polimento',           semantic: 'info'    as SemanticVariant },
  washing:        { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',    label: 'Lavagem',             semantic: 'info'    as SemanticVariant },
  final_survey:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',   label: 'Vistoria Final',      semantic: 'info'    as SemanticVariant },
  ready:          { color: '#4ade80', bg: 'rgba(74,222,128,0.15)',    label: 'Pronto p/ Entrega',   semantic: 'success' as SemanticVariant },
  delivered:      { color: 'rgba(255,255,255,0.92)', bg: 'rgba(255,255,255,0.08)', label: 'Entregue', semantic: 'neutral' as SemanticVariant },
  cancelled:      { color: '#f87171', bg: 'rgba(248,113,113,0.15)',   label: 'Cancelada',           semantic: 'error'   as SemanticVariant },
} as const;

export type OSStatus = keyof typeof OS_STATUS_MAP;
