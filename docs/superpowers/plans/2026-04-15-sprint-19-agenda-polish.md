# Sprint 19 — Agenda + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Agenda module functionality (full-width layout, time indicator, clickable slots, overflow handling) and apply final visual polish (contrast fix, token migration, padding, tooltips, car model display).

**Architecture:** Ten independent improvements, all fully frontend. No backend changes required — `CalendarOS.make` and `CalendarOS.model` already exist in `packages/types/src/agenda.types.ts`. All tasks can run in parallel.

**Tech Stack:** Next.js 15 · TypeScript strict · Tailwind CSS · shadcn/ui · date-fns · React hooks

---

## File Map

| File | Action |
|------|--------|
| `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx` | Modify — remove max-w-xl, time indicator |
| `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx` | Modify — time indicator, clickable cells, overflow |
| `apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx` | Modify — contrast fix, car model |
| `apps/dscar-web/src/app/(app)/agenda/page.tsx` | Modify — padding fix, clickable slot handler |
| `apps/dscar-web/src/components/Sidebar.tsx` | Modify — tooltip scroll fix |
| `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx` | Modify — token migration |
| `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx` | Modify — token migration |
| `apps/dscar-web/src/app/(app)/dashboard/page.tsx` | Modify — STOREKEEPER grid fix |

---

## Task 1: S19-M2 — DayView: remove max-w-xl

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`

- [ ] **Step 1: Remove max-w-xl from DayView container**

In `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`, line 38:

```tsx
// Before:
<div className="flex-1 overflow-auto max-w-xl mx-auto">

// After:
<div className="flex-1 overflow-auto">
```

- [ ] **Step 2: Verify visual consistency**

Open the agenda in browser, switch to Day view. Confirm it now spans the same full width as Week view. If the content looks too wide, add `max-w-4xl mx-auto` as a softer constraint.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/_components/DayView.tsx
git commit -m "fix(dscar): S19-M2 — DayView full width, remove max-w-xl constraint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: S19-M3 — Current-time indicator in WeekView and DayView

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`

- [ ] **Step 1: Create useCurrentTimePosition hook**

Add this hook at the top of `WeekView.tsx` (it will also be imported by DayView, so either add to both files or extract to a shared file):

```typescript
// Assumption: grid shows 8h–18h (10 hours = START_HOUR to END_HOUR)
// Adjust START_HOUR/END_HOUR if the grid hours change
const START_HOUR = 8
const END_HOUR = 18

function useCurrentTimePosition(): number | null {
  const [position, setPosition] = useState<number | null>(null)

  useEffect(() => {
    function update() {
      const now = new Date()
      const hours = now.getHours() + now.getMinutes() / 60
      if (hours < START_HOUR || hours > END_HOUR) {
        setPosition(null)
        return
      }
      setPosition(((hours - START_HOUR) / (END_HOUR - START_HOUR)) * 100)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  return position
}
```

- [ ] **Step 2: Add time indicator to WeekView**

In `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`, find the hours grid container and add `position: relative`:

```tsx
// The main grid container for the hours rows needs relative positioning:
<div className="relative">
  {/* Existing hour rows */}
  {HOURS.map((hour) => (
    <div key={hour} className="...">
      {/* ... existing content ... */}
    </div>
  ))}

  {/* Current time indicator — only when viewing today's week */}
  {isToday(currentDate) && timePosition !== null && (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ top: `${timePosition}%` }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-primary-600 shrink-0 -ml-1.5" />
        <div className="flex-1 h-[2px] bg-primary-600" />
      </div>
    </div>
  )}
</div>
```

Add to component: `const timePosition = useCurrentTimePosition()`

For WeekView, the indicator should show across ALL day columns when the current week includes today. So `isToday` check should use any day of the week:
```typescript
import { isToday, startOfWeek, endOfWeek } from "date-fns"

const weekContainsToday = isToday(currentDate) ||
  (new Date() >= startOfWeek(currentDate) && new Date() <= endOfWeek(currentDate))
```

- [ ] **Step 3: Add time indicator to DayView**

Same pattern in `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`:

```tsx
const timePosition = useCurrentTimePosition()

// In the HOURS grid, wrap in relative container:
<div className="relative">
  {HOURS.map((hour) => (
    <div key={hour} className="flex gap-3 px-4 py-2 border-b border-neutral-100 min-h-[52px]">
      {/* ... existing content ... */}
    </div>
  ))}

  {/* Time indicator */}
  {isToday(currentDate) && timePosition !== null && (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ top: `${timePosition}%` }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-primary-600 shrink-0 ml-8" />
        <div className="flex-1 h-[2px] bg-primary-600" />
      </div>
    </div>
  )}
</div>
```

The `ml-8` on the circle aligns it with the hour column (which is `w-8`).

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/_components/WeekView.tsx apps/dscar-web/src/app/\(app\)/agenda/_components/DayView.tsx
git commit -m "feat(dscar): S19-M3 — current-time indicator in WeekView and DayView

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: S19-M4 — WeekView/DayView: clickable cells for scheduling

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/page.tsx`
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`

- [ ] **Step 1: Add onSlotClick prop to WeekView and DayView interfaces**

In `WeekView.tsx`:
```typescript
interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onSlotClick?: (date: Date, hour: number) => void
}
```

In `DayView.tsx`:
```typescript
interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onSlotClick?: (date: Date, hour: number) => void
}
```

- [ ] **Step 2: Add click handlers to hour cells in WeekView**

In `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`, find the hour cell divs and add:

```tsx
// Find the cell div for each [day, hour] combination:
// Before:
<div key={`${day.toISOString()}-${hour}`} className="min-h-[52px] p-1 space-y-0.5">

// After:
<div
  key={`${day.toISOString()}-${hour}`}
  className="min-h-[52px] p-1 space-y-0.5 cursor-pointer hover:bg-primary-50/30 transition-colors"
  onClick={() => onSlotClick?.(day, hour)}
>
```

Make sure `CalendarEventCard` uses `e.stopPropagation()` to prevent the slot click from firing when clicking an existing card:

```tsx
// In CalendarEventCard.tsx, wrap the card's root element:
<div onClick={(e) => e.stopPropagation()}>
  {/* existing card content */}
</div>
```

- [ ] **Step 3: Add click handlers to hour cells in DayView**

Same pattern in `apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx`:

```tsx
// Find the hour row divs:
// Before:
<div key={hour} className="flex gap-3 px-4 py-2 border-b border-neutral-100 min-h-[52px]">

// After:
<div
  key={hour}
  className="flex gap-3 px-4 py-2 border-b border-neutral-100 min-h-[52px] cursor-pointer hover:bg-primary-50/30 transition-colors"
  onClick={() => onSlotClick?.(currentDate, hour)}
>
```

- [ ] **Step 4: Wire up onSlotClick in agenda/page.tsx**

In `apps/dscar-web/src/app/(app)/agenda/page.tsx`:

```tsx
// Add state:
const [schedulingSlot, setSchedulingSlot] = useState<{ date: Date; hour: number } | null>(null)

function handleSlotClick(date: Date, hour: number) {
  setSchedulingSlot({ date, hour })
}

// Pass to views:
<WeekView
  currentDate={currentDate}
  events={events}
  onSlotClick={handleSlotClick}
/>
<DayView
  currentDate={currentDate}
  events={events}
  onSlotClick={handleSlotClick}
/>

// Update SchedulingDialog open condition:
// Before: only opened via CalendarHeader button
// After: also opened when schedulingSlot is set
<SchedulingDialog
  open={schedulingOpen || schedulingSlot !== null}
  onOpenChange={(open) => {
    setSchedulingOpen(open)
    if (!open) setSchedulingSlot(null)
  }}
  initialDate={schedulingSlot?.date ?? currentDate}
  initialHour={schedulingSlot?.hour}
/>
```

- [ ] **Step 5: Add initialDate and initialHour props to SchedulingDialog**

Read `SchedulingDialog.tsx` to understand its current props. Add:

```typescript
interface SchedulingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  initialHour?: number
}
```

Pre-populate the date/hour fields when these props are provided.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/
git commit -m "feat(dscar): S19-M4 — clickable time slots open SchedulingDialog with pre-filled date/hour

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: S19-M5 — WeekView: "+N mais" overflow for >2 events per cell

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`

- [ ] **Step 1: Add overflow handling to event cells**

In `apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx`, find where events are rendered per cell. The current code renders all events without limit.

Read the `WeekView.tsx` to identify:
- The `hourEvents` filtering
- The cell div that contains them

- [ ] **Step 2: Slice events and add overflow link**

```tsx
// Find the cell rendering (inside the hours grid):
// Before:
<div className="flex-1 space-y-0.5">
  {hourEvents.map((e, i) => (
    <CalendarEventCard key={`${e.os.id}-${i}`} event={e} />
  ))}
</div>

// After:
<div className="flex-1 space-y-0.5 overflow-hidden">
  {hourEvents.slice(0, 2).map((e, i) => (
    <CalendarEventCard key={`${e.os.id}-${i}`} event={e} />
  ))}
  {hourEvents.length > 2 && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        // Switch to DayView for that day:
        // This requires passing a prop or using context
        onSwitchToDayView?.(day)  // prop added below
      }}
      className="text-[10px] font-medium text-primary-600 hover:underline w-full text-left pl-1"
    >
      +{hourEvents.length - 2} mais
    </button>
  )}
</div>
```

- [ ] **Step 3: Fix cell min-height**

```tsx
// Change min-h-[52px] to min-h-[64px] to accommodate the overflow link:
<div
  className="min-h-[64px] p-1 space-y-0.5 overflow-hidden ..."
>
```

- [ ] **Step 4: Add onSwitchToDayView prop**

In the WeekView interface:
```typescript
interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onSlotClick?: (date: Date, hour: number) => void
  onSwitchToDayView?: (date: Date) => void
}
```

In `agenda/page.tsx`, pass the handler:
```tsx
<WeekView
  currentDate={currentDate}
  events={events}
  onSlotClick={handleSlotClick}
  onSwitchToDayView={(date) => {
    setCurrentDate(date)
    setViewMode("day")
  }}
/>
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/_components/WeekView.tsx apps/dscar-web/src/app/\(app\)/agenda/page.tsx
git commit -m "feat(dscar): S19-M5 — WeekView overflow shows +N more, switches to DayView

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: S19-M6 — CalendarEventCard: fix WCAG contrast

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx`

- [ ] **Step 1: Read CalendarEventCard.tsx**

Read `apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx` to see the `EVENT_CONFIG` object with colors for each event type.

- [ ] **Step 2: Update event colors to WCAG AA compliant tokens**

```tsx
// Current EVENT_CONFIG (approximate):
const EVENT_CONFIG = {
  entry: { bg: "bg-blue-500", text: "text-white" },
  delivery: { bg: "bg-emerald-500", text: "text-white" },   // FAILS: 2.7:1 ratio
  scheduled_delivery: { bg: "bg-orange-500", text: "text-white" },
}

// Updated EVENT_CONFIG with design system tokens:
const EVENT_CONFIG = {
  entry: {
    bg: "bg-info-600",            // #2563eb — ratio 4.6:1 ✓ WCAG AA
    text: "text-white",
  },
  delivery: {
    bg: "bg-success-700",         // #15803d — ratio 5.1:1 ✓ WCAG AA
    text: "text-white",
  },
  scheduled_delivery: {
    bg: "bg-warning-700",         // #b45309 — ratio 4.7:1 ✓ WCAG AA
    text: "text-white",
  },
}
```

- [ ] **Step 3: Fix all-day row background**

Find any `bg-emerald-50/40` used for the delivery all-day row and update to `bg-success-50/60`.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/_components/CalendarEventCard.tsx
git commit -m "fix(dscar): S19-M6 — CalendarEventCard colors pass WCAG AA contrast

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: S19-M11 — Agenda: fix double padding

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/page.tsx`

- [ ] **Step 1: Read agenda/page.tsx outer container**

Read `apps/dscar-web/src/app/(app)/agenda/page.tsx` and find the outermost container div. It currently has `p-4` creating double padding with the layout's own padding.

- [ ] **Step 2: Remove or standardize outer padding**

```tsx
// Find the outer container. Check what the layout (apps/dscar-web/src/app/(app)/layout.tsx)
// provides. If the layout already provides padding:
// Before:
<div className="p-4 flex flex-col h-full gap-4">
// After:
<div className="flex flex-col h-full gap-4">

// If removing all padding breaks alignment, use p-6 to match other pages:
<div className="p-6 flex flex-col h-full gap-4">
```

- [ ] **Step 3: Compare with another page**

Verify: OS list page (`service-orders/page.tsx`) uses what padding? Match that.

```tsx
// Read service-orders/page.tsx outer container for reference:
// If it uses p-6 or if layout provides padding, match that pattern.
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/page.tsx
git commit -m "fix(dscar): S19-M11 — agenda page padding matches other pages

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: S19-B2 — Sidebar tooltip scroll fix

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx tooltip calculation**

Read `apps/dscar-web/src/components/Sidebar.tsx` and find the `showTooltip` function that calculates tooltip position using `getBoundingClientRect()`.

- [ ] **Step 2: Add scroll offset to tooltip position**

The tooltip position is computed relative to the `<aside>` element, but the `<nav>` inside can scroll. The tooltip div needs to account for the nav's scroll offset:

```typescript
// Find the showTooltip handler. It likely does:
function showTooltip(e: React.MouseEvent, label: string) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const sidebarRect = sidebarRef.current?.getBoundingClientRect()

  // Current (broken when nav is scrolled):
  setTooltip({
    top: rect.top - (sidebarRect?.top ?? 0) + rect.height / 2,
    label,
  })

  // Fixed: add nav scroll offset:
  const navEl = sidebarRef.current?.querySelector("nav")
  const scrollOffset = navEl?.scrollTop ?? 0
  setTooltip({
    top: rect.top - (sidebarRect?.top ?? 0) + scrollOffset + rect.height / 2,
    label,
  })
}
```

- [ ] **Step 3: Test scroll behavior**

Expand several nav groups to force the nav to scroll. Hover over items at different scroll positions. Verify tooltip is aligned to the hovered item.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "fix(dscar): S19-B2 — sidebar tooltip position accounts for nav scroll offset

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: S19-B3 — CalendarEventCard: show car model instead of first name

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx`

- [ ] **Step 1: Verify make/model fields in CalendarOS type**

Read `packages/types/src/agenda.types.ts` to confirm `CalendarOS` has `make: string` and `model: string` fields. (They already exist — no backend change needed.)

- [ ] **Step 2: Update CalendarEventCard display**

In `apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx`, find where `event.os.customer_name.split(" ")[0]` is used to display the first name:

```tsx
// Before:
<span className="truncate">{event.os.customer_name.split(" ")[0]}</span>
// OR:
{event.os.customer_name.split(" ")[0]}

// After:
<span className="truncate">
  {[event.os.make, event.os.model].filter(Boolean).join(" ") || event.os.customer_name.split(" ")[0]}
</span>
```

This shows "Honda Civic" if make+model available, falls back to first name otherwise.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/agenda/_components/CalendarEventCard.tsx
git commit -m "feat(dscar): S19-B3 — CalendarEventCard shows car model instead of first name

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: S19-B4 — Migrate raw Tailwind colors to design system tokens

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`
- Modify: `apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx`

- [ ] **Step 1: Audit raw color usage**

```bash
cd apps/dscar-web && grep -rn "bg-emerald-\|bg-violet-\|bg-blue-\|text-emerald-\|text-violet-\|text-blue-" src/app/\(app\)/dashboard --include="*.tsx"
```

- [ ] **Step 2: Migrate ManagerDashboard.tsx**

In `apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx`:

```tsx
// Token migration mapping:
// bg-emerald-50  → bg-success-50
// text-emerald-600 → text-success-600
// bg-blue-50     → bg-info-50
// text-blue-600  → text-info-600
// bg-violet-50   → bg-accent-100
// text-violet-600 → text-accent-600
// bg-red-50      → bg-error-50  (already uses bg-error-50 in one place)
// text-red-600   → text-error-600

// Before:
<StatCard
  label="Faturamento Mês"
  value={formatCurrency(data.billing_month, { compact: true })}
  icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
  iconBg="bg-emerald-50"
/>
<StatCard
  label="Entregas (mês)"
  value={data.delivered_month}
  icon={<Truck className="h-5 w-5 text-blue-600" />}
  iconBg="bg-blue-50"
/>
<StatCard
  label="Ticket Médio"
  value={formatCurrency(data.avg_ticket, { compact: true })}
  icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
  iconBg="bg-violet-50"
/>

// After:
<StatCard
  label="Faturamento Mês"
  value={formatCurrency(data.billing_month, { compact: true })}
  icon={<DollarSign className="h-5 w-5 text-success-600" />}
  iconBg="bg-success-50"
/>
<StatCard
  label="Entregas (mês)"
  value={data.delivered_month}
  icon={<Truck className="h-5 w-5 text-info-600" />}
  iconBg="bg-info-50"
/>
<StatCard
  label="Ticket Médio"
  value={formatCurrency(data.avg_ticket, { compact: true })}
  icon={<TrendingUp className="h-5 w-5 text-accent-600" />}
  iconBg="bg-accent-100"
/>
```

Note: `formatCurrency` with `{ compact: true }` requires S17-M12 to be complete.

- [ ] **Step 3: Migrate TeamProductivityTable.tsx**

If this wasn't already done in S17-A5 (table migration), update `text-emerald-700` → `text-success-700`:

```tsx
// Before:
<span className="font-semibold text-emerald-700">{m.delivered_month}</span>

// After:
<span className="font-semibold text-success-700">{m.delivered_month}</span>
```

- [ ] **Step 4: Verify remaining raw colors**

```bash
cd apps/dscar-web && grep -rn "bg-emerald-\|bg-violet-\|bg-blue-\|text-emerald-\|text-violet-" src/app/\(app\)/dashboard --include="*.tsx"
```

Expected: 0 results (or only intentional design choices).

- [ ] **Step 5: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/
git commit -m "refactor(dscar): S19-B4 — migrate raw Tailwind color classes to design system tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: S19-B5 — Dashboard STOREKEEPER grid fix

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Identify STOREKEEPER fallback grid**

In `apps/dscar-web/src/app/(app)/dashboard/page.tsx`, lines 130–155, the legacy/STOREKEEPER fallback renders:
- `StatCard` for "OS em Aberto" (always shown)
- `StatCard` for "Entregas Hoje" (always shown)
- `topStatuses.map(...)` → 0–2 additional StatCards

The grid is `grid grid-cols-2 lg:grid-cols-4` but there are only 2 guaranteed cards.

- [ ] **Step 2: Adapt grid to card count**

```tsx
// Before (line 130):
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

// After — uses dynamic class based on total count:
<div className={cn(
  "grid gap-4",
  topStatuses.length === 0
    ? "grid-cols-2"
    : topStatuses.length === 1
    ? "grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 lg:grid-cols-4"
)}>
```

Add import: `import { cn } from "@/lib/utils"`

- [ ] **Step 3: Also fix the loading skeleton**

The loading skeleton at lines 58–60 uses `grid grid-cols-2 lg:grid-cols-4` with 4 skeleton cards. Since we don't know the count at load time, keep 4 skeletons but use `grid grid-cols-2 lg:grid-cols-4` — this is fine for the loading state.

- [ ] **Step 4: TypeScript check**

```bash
cd apps/dscar-web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/dashboard/page.tsx
git commit -m "fix(dscar): S19-B5 — STOREKEEPER dashboard grid adapts to actual card count

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Sprint 19 Completion Checklist

- [ ] DayView occupies full width (no `max-w-xl`)
- [ ] Red horizontal line visible in WeekView and DayView when viewing today
- [ ] Time indicator updates position every minute
- [ ] Clicking empty hour slot in WeekView opens SchedulingDialog with date+hour pre-filled
- [ ] Same behavior in DayView
- [ ] WeekView cells with >2 events show "+N mais" link
- [ ] Clicking "+N mais" switches to DayView for that day
- [ ] `bg-emerald-500` removed from CalendarEventCard
- [ ] All CalendarEventCard color combinations pass WCAG AA (≥ 4.5:1 ratio)
- [ ] Agenda page padding matches other pages
- [ ] Sidebar tooltip aligns correctly when nav is scrolled
- [ ] CalendarEventCard shows "Make Model" (or first name as fallback)
- [ ] No raw `emerald/violet/blue` classes in dashboard components
- [ ] STOREKEEPER dashboard shows `grid-cols-2` when only 2 cards
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → no warnings
