// ─── DS Car Design Tokens ────────────────────────────────────────────────────
// Espelho do globals.css do dscar-web. Fonte da verdade: apps/dscar-web/src/app/globals.css

export const colors = {
  // Primary — vermelho DS Car
  primary: {
    50:  '#fff1f1',
    100: '#ffe1e1',
    200: '#ffc7c7',
    300: '#ffa0a0',
    400: '#ff6b6b',
    500: '#f63c3c',
    600: '#e31b1b', // ← CTA principal, botões, selecionado
    700: '#c01212',
    800: '#9e1313',
    900: '#831717',
    950: '#470707',
  },

  // Secondary — preto profundo (sidebar, tab bar)
  secondary: {
    50:  '#f6f6f6',
    100: '#e7e7e7',
    200: '#d1d1d1',
    300: '#b0b0b0',
    400: '#888888',
    500: '#6d6d6d',
    600: '#5d5d5d',
    700: '#4f4f4f',
    800: '#454545',
    900: '#3d3d3d',
    950: '#141414', // ← tab bar, sidebar background
  },

  // Accent — cinza metálico
  accent: {
    400: '#8fa3b1',
    500: '#7896a7',
  },

  // Semantic
  background:   '#f9fafb',
  surface:      '#ffffff',
  border:       '#e5e7eb',
  textPrimary:  '#111827',
  textSecondary:'#6b7280',
  textMuted:    '#9ca3af',

  // Status OS
  status: {
    recepcao:       '#3b82f6', // azul
    vistoria:       '#8b5cf6', // violeta
    orcamento:      '#f59e0b', // âmbar
    aprovado:       '#10b981', // verde
    emExecucao:     '#f97316', // laranja
    aguardandoPeca: '#ec4899', // rosa
    concluido:      '#6b7280', // cinza
    entregue:       '#1f2937', // cinza escuro
  },

  // States
  success: '#10b981',
  warning: '#f59e0b',
  error:   '#e31b1b',
  info:    '#3b82f6',

  white: '#ffffff',
  black: '#000000',
};

// Aliases rápidos
export const C = {
  primary:   colors.primary[600],    // #e31b1b
  primaryDk: colors.primary[700],    // #c01212
  secondary: colors.secondary[950],  // #141414
  accent:    colors.accent[500],     // #7896a7
  bg:        colors.background,
  surface:   colors.surface,
  border:    colors.border,
  text:      colors.textPrimary,
  textSub:   colors.textSecondary,
  textMuted: colors.textMuted,
  white:     colors.white,
};
