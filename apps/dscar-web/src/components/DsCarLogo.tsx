/**
 * DsCarLogo — Logo placeholder DS Car Centro Automotivo
 *
 * Usar até a entrega do logo definitivo pelo cliente.
 * Props permitem adaptar para sidebar compacta, header e splash screen.
 *
 * Ícone: Wrench (lucide-react) — ferramenta automotiva, direto ao ponto.
 * Alternativa: Car ou Gauge dependendo do contexto.
 */

import { Wrench } from "lucide-react";

interface DsCarLogoProps {
  /** Exibe apenas o ícone (modo sidebar compacta) */
  iconOnly?: boolean;
  /** Tamanho do ícone em px */
  size?: number;
  /** Variante de cor — dark para fundos escuros, light para fundos claros */
  variant?: "dark" | "light";
  /** className adicional no wrapper */
  className?: string;
}

export function DsCarLogo({
  iconOnly = false,
  size = 24,
  variant = "dark",
  className = "",
}: DsCarLogoProps): React.ReactElement {
  const isLight = variant === "light";

  return (
    <div
      className={`flex items-center gap-2.5 select-none ${className}`}
      aria-label="DS Car Centro Automotivo"
    >
      {/* Ícone — losango vermelho + wrench branco */}
      <div
        className="flex items-center justify-center rounded-sm bg-primary-600 shrink-0"
        style={{ width: size + 8, height: size + 8 }}
      >
        <Wrench
          size={size - 4}
          strokeWidth={2.5}
          className="text-foreground"
          aria-hidden
        />
      </div>

      {/* Wordmark */}
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-plate font-bold tracking-widest uppercase text-sm ${
              isLight ? "text-foreground" : "text-secondary-950"
            }`}
          >
            DS Car
          </span>
          <span
            className={`text-2xs font-sans tracking-wide uppercase ${
              isLight ? "text-primary-300" : "text-primary-600"
            }`}
          >
            Centro Automotivo
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SVG inline puro (para uso em email, PDF, contexts sem React) ─────────────
//
// Copie este SVG quando precisar de um asset estático (og:image, favicon base, etc.)
//
// <svg width="160" height="40" viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg">
//   <!-- Fundo do ícone: losango vermelho -->
//   <rect x="0" y="4" width="32" height="32" rx="4" fill="#C01212"/>
//   <!-- Wrench simplificado (path manual) -->
//   <g transform="translate(4, 8) scale(0.9)" stroke="white" stroke-width="2.5"
//      stroke-linecap="round" stroke-linejoin="round" fill="none">
//     <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77
//              a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91
//              a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
//   </g>
//   <!-- Wordmark DS CAR -->
//   <text x="40" y="18" font-family="system-ui,sans-serif" font-size="14"
//         font-weight="800" letter-spacing="3" fill="#141414" text-anchor="start">
//     DS Car
//   </text>
//   <!-- Sub-label -->
//   <text x="40" y="31" font-family="system-ui,sans-serif" font-size="8"
//         font-weight="500" letter-spacing="2" fill="#C01212" text-anchor="start">
//     CENTRO AUTOMOTIVO
//   </text>
// </svg>
