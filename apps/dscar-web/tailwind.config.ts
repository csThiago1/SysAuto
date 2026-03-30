import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ─── Paleta DS Car + shadcn/ui semantic aliases ──────────────────────────
      colors: {
        // shadcn/ui CSS variable aliases (obrigatórios para @apply border-border, bg-background, etc.)
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",
        border:       "hsl(var(--border))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // PRIMARY — Vermelho automotivo / vinho
        // Inspirado na identidade de centros automotivos premium.
        // 500 é o tom base para CTAs e destaques.
        // 700–900 para sidebar escura e headers.
        primary: {
          "50":  "#fff1f1",
          "100": "#ffe1e1",
          "200": "#ffc7c7",
          "300": "#ffa0a0",
          "400": "#ff6b6b",
          "500": "#f63c3c",
          "600": "#e31b1b",
          "700": "#c01212",
          "800": "#9e1313",
          "900": "#831717",
          "950": "#470707",
        },

        // SECONDARY — Preto profundo premium
        // Usado como cor de fundo principal do sidebar, navbars e modais escuros.
        secondary: {
          "50":  "#f6f6f6",
          "100": "#e7e7e7",
          "200": "#d1d1d1",
          "300": "#b0b0b0",
          "400": "#888888",
          "500": "#6d6d6d",
          "600": "#5d5d5d",
          "700": "#4f4f4f",
          "800": "#454545",
          "900": "#3d3d3d",
          "950": "#141414",
        },

        // ACCENT — Cinza metálico / alumínio polido
        // Evoca peças automotivas, alumínio, acabamento premium.
        // Usado em bordas, divisores e elementos decorativos.
        accent: {
          "50":  "#f8f9fa",
          "100": "#f0f2f4",
          "200": "#e2e6ea",
          "300": "#cbd2da",
          "400": "#a8b4bf",
          "500": "#8796a5",
          "600": "#6e7f8e",
          "700": "#5a6876",
          "800": "#4c5862",
          "900": "#424c55",
          "950": "#2b3038",
        },

        // NEUTRAL — Cinza para fundos e texto
        // Escala neutra quente para backgrounds de cards, texto e superfícies.
        neutral: {
          "50":  "#fafafa",
          "100": "#f5f5f5",
          "200": "#e8e8e8",
          "300": "#d4d4d4",
          "400": "#a3a3a3",
          "500": "#737373",
          "600": "#525252",
          "700": "#404040",
          "800": "#262626",
          "900": "#171717",
          "950": "#0a0a0a",
        },

        // SEMANTIC — Success (verde motor)
        success: {
          "50":  "#f0fdf4",
          "100": "#dcfce7",
          "200": "#bbf7d0",
          "300": "#86efac",
          "400": "#4ade80",
          "500": "#22c55e",
          "600": "#16a34a",
          "700": "#15803d",
          "800": "#166534",
          "900": "#14532d",
          "950": "#052e16",
        },

        // SEMANTIC — Warning (amarelo âmbar)
        warning: {
          "50":  "#fffbeb",
          "100": "#fef3c7",
          "200": "#fde68a",
          "300": "#fcd34d",
          "400": "#fbbf24",
          "500": "#f59e0b",
          "600": "#d97706",
          "700": "#b45309",
          "800": "#92400e",
          "900": "#78350f",
          "950": "#451a03",
        },

        // SEMANTIC — Error (vermelho alerta — distinto do primary)
        error: {
          "50":  "#fff0f0",
          "100": "#ffdddd",
          "200": "#ffbfbf",
          "300": "#ff9292",
          "400": "#ff5757",
          "500": "#ff2424",
          "600": "#f20000",
          "700": "#cc0000",
          "800": "#a80000",
          "900": "#8b0000",
          "950": "#4c0000",
        },

        // SEMANTIC — Info (azul técnico / diagnóstico)
        info: {
          "50":  "#eff6ff",
          "100": "#dbeafe",
          "200": "#bfdbfe",
          "300": "#93c5fd",
          "400": "#60a5fa",
          "500": "#3b82f6",
          "600": "#2563eb",
          "700": "#1d4ed8",
          "800": "#1e40af",
          "900": "#1e3a8a",
          "950": "#172554",
        },
      },

      // ─── Tipografia ──────────────────────────────────────────────────────────
      // Inter: sans-serif principal — legibilidade em formulários e tabelas
      // Rajdhani: condensada técnica — usada em placas veiculares, badges de OS e números
      fontFamily: {
        sans:  ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        plate: ["var(--font-rajdhani)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:  ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      fontSize: {
        // Escala customizada para ERP (interfaces densas)
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],  // 10px — badges mínimos
        "xs":  ["0.75rem",  { lineHeight: "1rem" }],      // 12px — labels de campo
        "sm":  ["0.875rem", { lineHeight: "1.25rem" }],   // 14px — corpo padrão ERP
        "base":["1rem",     { lineHeight: "1.5rem" }],    // 16px — texto confortável
        "lg":  ["1.125rem", { lineHeight: "1.75rem" }],   // 18px — subtítulos de card
        "xl":  ["1.25rem",  { lineHeight: "1.75rem" }],   // 20px — títulos de seção
        "2xl": ["1.5rem",   { lineHeight: "2rem" }],      // 24px — títulos de página
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],   // 30px — métricas KPI
        "4xl": ["2.25rem",  { lineHeight: "2.5rem" }],    // 36px — hero / splash
        "plate": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "0.08em", fontWeight: "700" }], // Placas
      },

      // ─── Espaçamento e Dimensões ─────────────────────────────────────────────
      spacing: {
        // Sidebar widths
        "sidebar":         "240px",
        "sidebar-compact": "64px",
        // Card e layout padrões
        "card-padding":    "1.25rem",
        "page-padding":    "1.5rem",
      },

      width: {
        "sidebar":         "240px",
        "sidebar-compact": "64px",
      },

      // ─── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        "none":  "0",
        "sm":    "0.25rem",   // inputs internos
        "DEFAULT":"0.375rem", // botões
        "md":    "0.5rem",    // cards
        "lg":    "0.75rem",   // modais, drawers
        "xl":    "1rem",      // badges grandes
        "full":  "9999px",    // chips de status arredondados
      },

      // ─── Sombras ─────────────────────────────────────────────────────────────
      boxShadow: {
        // Cards ERP — sombra sutil para plano de fundo claro
        "card":   "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,0.12), 0 2px 4px -2px rgba(0,0,0,0.08)",
        // Sombra para sidebar overlay mobile
        "sidebar": "4px 0 16px 0 rgba(0,0,0,0.18)",
        // Sombra para dropdowns / menus
        "dropdown": "0 8px 24px -4px rgba(0,0,0,0.14), 0 4px 8px -4px rgba(0,0,0,0.10)",
        // Kanban card
        "kanban": "0 2px 8px 0 rgba(0,0,0,0.10)",
        "kanban-drag": "0 8px 24px 0 rgba(0,0,0,0.20)",
      },

      // ─── Animações ───────────────────────────────────────────────────────────
      transitionDuration: {
        "fast":   "100ms",
        "normal": "200ms",
        "slow":   "300ms",
      },

      keyframes: {
        "slide-in-left": {
          "0%":   { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)",     opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
      animation: {
        "slide-in-left": "slide-in-left 200ms ease-out",
        "fade-in":       "fade-in 150ms ease-in",
        "pulse-red":     "pulse-red 1.5s ease-in-out infinite",
      },

      // ─── Grid / Layout ───────────────────────────────────────────────────────
      gridTemplateColumns: {
        // Layout com sidebar fixa
        "app-layout":         "240px 1fr",
        "app-layout-compact": "64px 1fr",
        // Kanban com colunas fixas
        "kanban-auto": "repeat(auto-fill, minmax(280px, 1fr))",
      },
    },
  },
  plugins: [],
};

export default config;
