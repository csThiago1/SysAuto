/**
 * DS Car Mobile — Design Tokens
 * Tema escuro glass, inspirado no dark mode da Apple.
 * Use sempre estas constantes em vez de hex hardcoded.
 */

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
