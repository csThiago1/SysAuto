/**
 * Shared Tailwind class constants for consistent form field styling.
 * Use these in all OS form sections to avoid visual drift.
 *
 * These match the design language used across VehicleSection,
 * EntrySection, PrazosSection, etc.
 */

/** Section heading: small caps, wide tracking, muted */
export const FORM_SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-widest text-white/50"

/** Subsection heading: slightly less prominent than section title */
export const FORM_SUBSECTION =
  "label-mono text-white/40 mt-3 mb-1"

/** Label above a form field */
export const FORM_LABEL =
  "label-mono text-white/50 mb-0.5"

/** Standard text input / select */
export const FORM_INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

/** Input in error state */
export const FORM_INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-error-500 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-error-500 disabled:opacity-50"

/** Hint/help text below a field */
export const FORM_HINT = "mt-0.5 text-xs text-white/30 font-mono"

/** Validation error message below a field */
export const FORM_ERROR = "mt-0.5 text-xs text-error-400 font-mono"

/** Warning hint (e.g. "fills status on change") */
export const FORM_WARN = "mt-0.5 text-xs text-amber-600"

/** Wrapper for a form section: vertical stack with gap */
export const FORM_SECTION_WRAPPER = "space-y-2"
