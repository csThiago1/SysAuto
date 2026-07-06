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

/** Label above a form field */
export const FORM_LABEL =
  "label-mono text-muted-foreground mb-0.5"

/** Standard text input / select */
export const FORM_INPUT =
  "flex h-9 w-full rounded-lg border border-input bg-muted/30 px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring disabled:opacity-50"

/** Input in error state */
export const FORM_INPUT_ERROR =
  "flex h-9 w-full rounded-lg border border-error-500 bg-muted/30 px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-error-500/40 disabled:opacity-50"

/** Native select — usar com o wrapper NativeSelect (chevron próprio) */
export const FORM_SELECT =
  "flex h-9 w-full appearance-none rounded-lg border border-input bg-muted/30 px-3 pr-8 py-1 text-sm transition-colors hover:border-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring disabled:opacity-50 cursor-pointer"

/** Hint/help text below a field */
export const FORM_HINT = "mt-0.5 text-xs text-muted-foreground/70 font-mono"

/** Validation error message below a field */
export const FORM_ERROR = "mt-0.5 text-xs text-error-400 font-mono"

/** Warning hint (e.g. "fills status on change") */
export const FORM_WARN = "mt-0.5 text-xs text-warning-600"

/** Wrapper for a form section: vertical stack with gap */
export const FORM_SECTION_WRAPPER = "space-y-2"
