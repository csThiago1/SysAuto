/**
 * Shared Tailwind class constants for consistent form field styling.
 * Use these in all OS form sections to avoid visual drift.
 *
 * These match the design language used across VehicleSection,
 * EntrySection, PrazosSection, etc.
 */

/** Section heading: small caps, wide tracking, muted */
export const FORM_SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-widest text-muted-foreground"

/** Subsection heading: slightly less prominent than section title */
export const FORM_SUBSECTION =
  "label-mono text-muted-foreground mt-3 mb-1"

/**
 * Label acima do campo.
 *
 * `block` nao e decoracao: 26 dos 28 rotulos da aba Dados eram <span>/<label>
 * INLINE, e margin-bottom nao tem efeito em elemento inline nao-substituido.
 * Medido, o vao real era de 0 a 5px por mais que a margem dissesse outra coisa.
 * (Nao da pra colocar `display: block` no .label-mono: a mesma classe veste
 * dezenas de <th>, que precisam continuar table-cell.)
 *
 * mb-1.5 (6px): o par rotulo+campo e UM grupo — respira pouco por dentro e
 * muito por fora (gap-y-5 nas linhas), e a leitura agrupa sozinha.
 */
export const FORM_LABEL =
  "label-mono text-muted-foreground mb-1.5 block"

/**
 * Standard text input / select.
 *
 * No ESCURO: sem borda em repouso — o campo se separa do card por tom, e a
 * moldura so aparece no foco. Numa tela com 30+ campos, uma caixa desenhada em
 * cada um transforma consulta de dados num muro de retangulos.
 *
 * No CLARO: a borda VOLTA. O truque tonal nao sobrevive ao papel — `muted`
 * (85% de luminosidade) sobre `card` (97%) e quase o mesmo tom, e os campos
 * literalmente sumiam. Aqui a moldura e o que torna o campo visivel.
 */
export const FORM_INPUT =
  "flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring dark:border-transparent dark:bg-muted/40 dark:placeholder:text-muted-foreground/40 dark:hover:bg-muted/60 dark:focus:bg-muted/60 disabled:opacity-50"

/** Input in error state */
export const FORM_INPUT_ERROR =
  "flex h-9 w-full rounded-md border border-error-600 dark:border-error-500 bg-error-500/5 px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-error-500/40 disabled:opacity-50"

/** Native select — usar com o wrapper NativeSelect (chevron próprio) */
export const FORM_SELECT =
  "flex h-9 w-full appearance-none rounded-md border border-input bg-muted/50 px-3 pr-8 py-1 text-sm transition-colors hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring dark:border-transparent dark:bg-muted/40 dark:hover:bg-muted/60 dark:focus:bg-muted/60 disabled:opacity-50 cursor-pointer"

/** Hint/help text below a field */
export const FORM_HINT = "mt-0.5 text-xs text-muted-foreground/70 font-mono"

/** Validation error message below a field */
export const FORM_ERROR = "mt-0.5 text-xs text-error-700 dark:text-error-400 font-mono"

/** Warning hint (e.g. "fills status on change") */
export const FORM_WARN = "mt-0.5 text-xs text-warning-600"

/** Wrapper for a form section: vertical stack with gap */
export const FORM_SECTION_WRAPPER = "space-y-2"
