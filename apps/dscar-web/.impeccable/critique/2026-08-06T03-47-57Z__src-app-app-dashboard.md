---
target: Dashboard
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-06T03-47-57Z
slug: src-app-app-dashboard
---
Method: dual-agent (A: critique-dash-A · B: critique-dash-B)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No "atualizado às…" timestamp; KPI period is unstated |
| 2 | Match System / Real World | 4 | Plate font, seguradora/particular pill, shop-native vocabulary throughout |
| 3 | User Control and Freedom | 2 | No date-range picker, fixed 6-month chart window, no dismiss/undo |
| 4 | Consistency and Standards | 2 | Three different card shells; status shown as StatusBadge in one place, inline pill in another |
| 5 | Error Prevention | 3 | Read-only board, little to mis-enter; overdue proactively surfaced |
| 6 | Recognition Rather Than Recall | 3 | Icons+labels help, but no baseline/comparison so numbers carry no memory context |
| 7 | Flexibility and Efficiency | 2 | Only ⌘K; KPIs aren't clickable, no export, no period toggle |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, dark, uncluttered; empty states handled without noise |
| 9 | Error Recovery | 2 | ErrorBoundary present but no observable error UI; not exercised |
| 10 | Help and Documentation | 1 | Zero contextual help; new/empty shop gets all-zeros with no guidance |
| **Total** | | **25/40** | **Acceptable** |

Detector: clean (`detect.mjs` exit 0, zero findings). Browser evidence: unavailable (dev server can't start — missing Docker backend stack); assessment based on source + restyle-r1 (most recent) and older screenshots.

## Design Specificity Verdict

**LLM assessment:** Authored for a Brazilian auto body-shop in its details, not its skeleton. The bones (KPI row → chart → two tables) are generic-admin shape, but the specifics are genuinely domain-native: `font-plate` Mercosul-style plate rendering, a Seguradora/Particular pill on every OS row (the real economic split of this business), "Dias na Oficina"/"OS Atrasadas"/"Ticket médio" vocabulary, R$ + pt-BR dates, brand red on the billing bar. With real data the dashboard would clearly read as built-for-this-shop; in the current all-zero state the specificity doesn't surface, because it's data-borne rather than structural.

**Deterministic scan:** `detect.mjs` returned zero findings on `src/app/(app)/dashboard` (exit 0). No AI-slop markers triggered. Nothing to reclassify as false positive since nothing was flagged.

**Visual evidence:** No live browser overlay — dev server fails to start (broken instrumentation hook, needs the full Docker stack this critique didn't spin up). Screenshots (restyle-r1, most recent) show a polished, internally consistent dark dashboard with designed empty states (a real improvement over an older screenshot that showed a raw gray placeholder box where the chart is now). No overflow, no cutoff, no contrast failures visible at either 1280 or 390px.

## Overall Impression

The dashboard is calmer and more finished than its component code suggests — good empty states, correct responsive KPI grid, real domain vocabulary. But the current live code (`KpiStrip`, not the heavier `StatCard` the screenshots show) flattens the primary numbers visually while giving the biggest, most central block of screen to a mostly-empty chart — the least urgent thing on the page. The single biggest opportunity: decide what a manager's 8am glance is actually for (today's fires vs six months of billing trend) and rebuild the hierarchy around that, with real baselines so a zero means something.

## What's Working

1. **License-plate + Seguradora/Particular treatment** — cheap to build, high authenticity payoff; lets shop staff scan the recent-OS table the way they actually think (by plate, by who's paying).
2. **OverdueOSList** — color-scoped red container, per-row days-overdue, and a genuinely reassuring green "Nenhuma OS atrasada" empty state. The one place emotional pacing is handled correctly.
3. **Role-based split (Consultant vs Manager)** — right data for the right person; no cross-contaminated clutter.

## Priority Issues

- **[P1] KPI period ambiguity + no baseline** — Why it matters: "FATURAMENTO MÊS"/"ENTREGAS (MÊS)" never state which month, freshness, or a comparison, so a manager can't tell if a number is current, stale, or good/bad. Fix: add an explicit period label and a delta vs. last month/target on each KPI. Suggested command: `/impeccable clarify`
- **[P1] Zero indistinguishable from broken** — Why it matters: an empty/new-shop state renders as legitimate-looking zeros across every KPI plus "Sem faturamento" — a shop with migrated history can't tell "genuinely slow month" from "pipeline broke." Fix: distinguish "sem dados" from real R$0, or always show last-known/comparison context. Suggested command: `/impeccable clarify`
- **[P1] Container & status inconsistency** — Why it matters: three different card shells (`KpiStrip` borderless vs. `border border-border shadow-sm` tables vs. legacy `shadow-card`) and two status renderings (StatusBadge vs. inline pill) fracture the design language on the most-viewed screen in the app. Fix: one card primitive, one status component everywhere. Suggested command: `/impeccable layout`
- **[P2] Tables don't follow the documented mobile pattern** — Why it matters: RecentOSTable/ConsultantDashboard/TeamProductivityTable/OverdueOSList are raw `<table>` with `overflow-x-auto` instead of the mandated desktop-table + mobile-card + ScrollFade pattern from CLAUDE.md, risking cramped/overflowing tables at 390px. Fix: apply the financeiro/contas-pagar gold-standard pattern. Suggested command: `/impeccable adapt`
- **[P2] Clickable table row isn't keyboard-accessible** — Why it matters: RecentOSTable's row uses `onClick` on a bare `<tr>` with no role/tabIndex/keydown, so keyboard and screen-reader users cannot open an OS from the recent list (sibling components correctly use `<Link>`). Fix: wrap the row's primary cell in a `<Link>`. Suggested command: `/impeccable audit`

## Persona Red Flags

**Alex (Power User)**: No date-range/period control, stuck on a fixed 6-month chart. KPIs are dead ends — not clickable, no drill-through to a filtered OS list, so he re-navigates to `/os` and filters manually every morning. No export, no density toggle. Only ⌘K helps. High friction on a screen used daily.

**Sam (Accessibility-Dependent)**: Urgency is color-only in several places (`days_in_shop > 14` red, overdue red, KPI `valueClass` red) with text present but hue carrying the signal. `text-foreground/60`/`/70` table text and 11px muted labels on a dark surface are likely below WCAG AA. Icon-only pastilles have no aria-label; the Recharts bar chart has no accessible data-table alternative. The non-keyboard `<tr onClick>` locks Sam out of the recent-OS list entirely.

## Minor Observations

- OverdueOSList's `new Date(date + "T12:00:00")` noon-hack dodges a timezone midnight-shift — pragmatic but fragile.
- Overdue threshold (>14 dias) is applied on the Consultant board but RecentOSTable's "Dias" column has no threshold/highlight at all — inconsistent staleness signaling.
- `formatCurrency(..., { compact: true })` on Faturamento/Ticket médio may frustrate an owner reconciling exact cash (shows "R$ 12k" not "R$ 12.345,67").
- BillingByTypeChart renders a single undifferentiated series with a hardcoded `fill="#ea0e03"` despite its name promising a by-type breakdown — service-mix (funilaria/pintura/polimento/lavagem) is the shop's actual P&L story and isn't wired up yet.
- On desktop, the KPI card with a one-line label has its icon/value vertically misaligned versus the two-line-label cards (cosmetic).

## Questions to Consider

- Is a 6-month billing chart the manager's real 8am question, or is it "what's on fire today"? The chart owns center stage while the one actionable list (overdue OS) sits bottom-right — should the layout invert?
- A KPI with no baseline is trivia — why ship four bare numbers instead of four numbers-with-direction?
- Does the single-series "BillingByTypeChart" quietly admit the by-type data isn't wired up yet, or is that always the intended view?
