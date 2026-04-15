/**
 * Shared Tailwind class constants for consistent form field styling.
 * Use these in all OS form sections to avoid visual drift.
 *
 * These match the design language used across VehicleSection,
 * EntrySection, PrazosSection, etc.
 */

/** Section heading: small caps, wide tracking, muted */
export const FORM_SECTION_TITLE =
  "text-xs font-semibold uppercase tracking-widest text-neutral-500"

/** Subsection heading: slightly less prominent than section title */
export const FORM_SUBSECTION =
  "text-xs font-semibold uppercase tracking-wider text-neutral-400 mt-3 mb-1"

/** Label above a form field */
export const FORM_LABEL =
  "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"

/** Standard text input / select */
export const FORM_INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

/** Input in error state */
export const FORM_INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-red-500 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"

/** Hint/help text below a field */
export const FORM_HINT = "mt-0.5 text-xs text-neutral-400"

/** Validation error message below a field */
export const FORM_ERROR = "mt-0.5 text-xs text-red-500"

/** Warning hint (e.g. "fills status on change") */
export const FORM_WARN = "mt-0.5 text-xs text-amber-600"

/** Wrapper for a form section: vertical stack with gap */
export const FORM_SECTION_WRAPPER = "space-y-2"
