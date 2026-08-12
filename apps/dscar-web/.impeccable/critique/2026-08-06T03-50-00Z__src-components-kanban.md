---
target: Kanban
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-06T03-50-00Z
slug: src-components-kanban
---
Method: dual-agent (A: critique-kanban-A · B: critique-kanban-B)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Instant optimistic move + count badges; skeleton width (280px) doesn't match real columns (220px), reflow on load |
| 2 | Match System / Real World | 4 | 5 phase groups mirror the real shop-floor flow; plate-first cards match how a shop IDs a car |
| 3 | User Control and Freedom | 1 | No undo after a successful move; transitions are largely forward-only |
| 4 | Consistency and Standards | 2 | Phase headers are light-mode-only classes on a dark board; card left-border is triple-purposed |
| 5 | Error Prevention | 4 | Client-side transition validation blocks invalid drops with a toast naming allowed next steps; blocked moves escalate to a wizard |
| 6 | Recognition Rather Than Recall | 3 | Cards are self-describing; but border-color meaning must be recalled (status vs. days-in-shop vs. overdue) |
| 7 | Flexibility and Efficiency | 2 | Delivered/cancelled toggles are smart but no column collapse, phase-jump, filter, or bulk move across 17 columns |
| 8 | Aesthetic and Minimalist Design | 3 | Cards dense but well-ordered; clashing light-mode phase bars are the main dent |
| 9 | Error Recovery | 3 | Rolls back on failure and opens a wizard or toasts; no recovery path for a successful-but-unwanted move |
| 10 | Help and Documentation | 2 | Blocked-transition toast is genuinely helpful inline guidance; nothing explains the border-color system |
| **Total** | | **27/40** | **Acceptable** |

Detector: 1 finding (`side-tab` warning, `KanbanCard.tsx:66`, exit 2) — **investigated and overturned as a false positive** (see below). Browser evidence: unavailable (dev server can't start — missing Docker backend stack); assessment based on source + `kanban-1.png`/`kanban-scrolled.png` (board was near-empty in both, so populated-card evidence comes from source, not screenshots).

## Design Specificity Verdict

**LLM assessment:** More than a Trello clone. The 17 OS statuses are chunked into 5 labeled phase groups (Entrada / Produção / Acabamento / Saída / Canceladas) — a deliberate domain model, not a flat column list. Cards lead with the plate in tracked mono type, carry a `days_in_shop` badge, an overdue-days urgency chip, insurer logo, and a pending-requirements dot. `VALID_TRANSITIONS`-gated drag with a `TransitionWizard` fallback for blocked moves is real shop-floor workflow logic, not generic CRUD. The generic seam: column chrome itself (`bg-muted/30` box, count pill, "Vazia") is stock Kanban, and the phase-header color system was clearly designed for a light theme and dropped onto the dark board unchanged.

**Deterministic scan:** `detect.mjs` flagged one `side-tab` warning — a "thick colored border on one side of a card" at `KanbanCard.tsx:66` (`border-l-4`). **Overturned as a false positive on independent investigation of both assessments.** The border is the top rung of a graduated, data-driven system (`getDaysInShopBorderColor` in `packages/utils/src/service-order.utils.ts:356`): no border ≤7 days in shop, thin amber 8–14d, thin orange 15–21d, thin red >21d, and only escalates to the flagged thick `border-l-4` when an OS is actually past its `estimated_delivery_date`. It encodes real, live OS state — not decoration — and matches a convention this codebase documents explicitly elsewhere (CLAUDE.md's 3px colored left status-stripe on mobile list cards). The detector can't see the conditional logic behind the class string; keep the pattern.

**Visual evidence:** No live browser overlay — dev server fails to start. Both screenshots show a nearly-empty board (1 active order), so the border-color system, card density, and the light-mode phase-header clash are confirmed from source, not seen in a populated screenshot. What the screenshots do show clearly: the "Nova OS" primary CTA and "Ver Lista" toggle are off-screen at first paint, reachable only by scrolling right — a real discoverability gap independent of any detector rule.

## Overall Impression

The phase-group chunking and transition-safety logic are the two smartest decisions in this surface — they turn a 17-column wall into something a shop-floor user could plausibly scan and trust. But the execution has two real gaps: the phase-header color palette is unmistakably a light-theme leftover sitting on a dark board (the loudest thing on the screen, and it doesn't belong), and keyboard drag is wired up via dnd-kit but then silently killed by a competing `onKeyDown` handler — so the one built-in accessible path to changing status doesn't work. Biggest opportunity: decide once what the card's left border means (pick status, not a three-way fight with days-in-shop and overdue), and re-theme the phase bars for dark mode.

## What's Working

1. **Phase-group chunking** (`KANBAN_PHASE_GROUPS`) — collapses 17 raw statuses into 5 legible stages; the single clearest anti-generic decision on this surface.
2. **Transition safety** (`handleDragEnd`) — validates client-side before any request, names the allowed next steps in the toast on a blocked drop, and escalates genuinely blocked moves to a guided wizard instead of a dead-end error.
3. **Domain-loaded cards** — plate-as-anchor, days-in-shop, overdue chip, insurer logo, pending-requirements dot all read as built for this shop, not a generic task card.

## Priority Issues

- **[P1] Phase-header colors are light-mode-only on a dark board** — Why it matters: `bg-blue-50 text-blue-700 border-blue-200`-style classes render as a glaring bright bar (the "ENTRADA" header in `kanban-1.png`) over otherwise-dark chrome — it's the loudest element on the screen and reads unfinished, inverting the intended visual weight (chrome louder than cards). Fix: theme-aware phase palette (`dark:` variants or token tints, e.g. `bg-blue-500/10 text-blue-300`) so headers are quiet tints. Suggested command: `/impeccable colorize`
- **[P1] Keyboard drag is dead; the one accessible path to changing status doesn't work** — Why it matters: dnd-kit's `KeyboardSensor` is wired up and `{...listeners}` are spread onto the card (Space/Enter = pick up), but an explicit `onKeyDown` on the same element overrides Enter to navigate instead — keyboard/AT users (Sam) can never actually start a drag. Fix: separate a dedicated drag handle carrying `{...listeners}` from the card body's Enter-to-navigate, or provide an accessible status-change menu as the real a11y path. Suggested command: `/impeccable audit`
- **[P2] Card left-border color is triple-purposed** — Why it matters: `isOverdue ? red : (getDaysInShopBorderColor(...) || statusCfg.border)` means days-in-shop silently overrides the status color, so the same visual channel encodes three unrelated meanings and the status border is frequently not shown at all. Fix: pick one meaning for the stripe (status, matching this codebase's own list-card convention) and let age/overdue live only in their existing badges. Suggested command: `/impeccable layout`
- **[P2] 17 fixed-width columns with no collapse or phase-jump navigation** — Why it matters: at 390px only ~1.7 columns are visible (confirmed in `kanban-scrolled.png`) and the primary "Nova OS" CTA plus "Ver Lista" are off-screen at first paint — a shop-floor phone/tablet user has to scroll blind to find a stage or the create button. Fix: sticky phase-jump strip and/or collapsible columns. Suggested command: `/impeccable adapt`
- **[P3] No undo after a successful move** — Why it matters: an accidental-but-valid forward drag succeeds silently with no recourse (transitions are largely one-directional), so recovery means leaving the board for the OS detail view. Fix: a "Movido para X · Desfazer" toast that posts the reverse transition when valid. Suggested command: `/impeccable harden`

## Persona Red Flags

**Sam (Accessibility-Dependent)**: Keyboard drag is unreachable (see P1) — no non-pointer way to change an OS's status from this board at all. Screen-reader context is thin: the card's `aria-label` is just "OS #n — plate" with no status or column read out, so a SR user hears a flat list of plates with no sense of pipeline stage. Count badges and the pending-requirements warning dot aren't associated with accessible text beyond a hover `title`.

**Casey (Distracted Mobile User)**: 17 fixed-width columns with single-file horizontal scroll and no collapse/phase-jump means finding a stage means scrolling blind. The primary "Nova OS" create action is off-screen on first paint (confirmed in the screenshots) — a real discoverability cost on the exact device this board is likely used from on the shop floor. One genuine positive: touch drag uses a 200ms delay + distance tolerance, so scroll-vs-drag is correctly disambiguated.

## Minor Observations

- Every empty column shows an identical "Vazia" placeholder — on the current near-empty board this reads as visual noise; consider showing it only on hover/drag-over.
- `getDaysOverdue` uses `estimated_delivery_date` while the border/badge escalation uses `days_in_shop` — worth confirming these two signals can't disagree on the same card.
- Skeleton column width (280px) doesn't match real column width (220px), causing a small reflow on load.
- Drag overlay uses a subtle `rotate-1` + `shadow-xl` lift — a nice tactile touch worth keeping.
- Overdue is triple-encoded on one card (thick border + urgency pill + clock badge) — reinforcing rather than decorative, but the thick border is the most redundant of the three if a quieter card is ever wanted.

## Questions to Consider

- If a status change means a car physically moved bays, should dragging be the primary way to change status — or a shortcut into a confirm step, with the wizard as the real commit point?
- The 17 statuses are already chunked into 5 phases for column grouping — would a 5-column phase-level board with expand-on-tap beat the current 17-column horizontal scroll, especially on tablet?
- The left-border color currently fights itself across three meanings — if a painter glancing at a tablet across the shop only gets to read one signal there, is it status, or how overdue the car is?
