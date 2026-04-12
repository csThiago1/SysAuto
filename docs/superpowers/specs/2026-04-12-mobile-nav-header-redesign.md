# Mobile Navigation & Header Redesign — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** `apps/mobile` — tab bar + OS screen header only

---

## Problem

The current mobile UI uses a frosted-glass tab bar with a sliding red bubble indicator and a dark flat header showing only text (greeting + company name). Both feel generic and low-energy for a service-industry app used on the shop floor.

---

## Approved Design

### Tab Bar — T2: Dark Floating Pill

| Property | Value |
|---|---|
| Background | `#141414` |
| Border radius | `22` |
| Position | `bottom: 10`, `left: 10`, `right: 10` |
| Shadow | `shadowColor: '#000'`, `opacity: 0.35`, `radius: 20`, `elevation: 12` |
| Inactive icon | `rgba(255,255,255,0.28)` opacity, outline variant |
| Active icon | `rgba(255,255,255,0.95)`, filled variant |
| Active indicator | 3 px red line below icon — `#e31b1b`, `shadowOpacity: 0.8`, `shadowRadius: 6` |
| Central "Nova OS" | Red pill `#e31b1b`, `borderRadius: 16`, `+` icon (white), drop shadow |

**Removed from current `FrostedNavBar`:** frosted BlurView, sliding bubble, label expansion animation, `containerWidth` tracking, flex-ratio calculations.

**Preserved:** spring press-scale, haptic feedback, hidden-route detection.

---

### Header — A2 + L1: Compact with Real Logo

| Property | Value |
|---|---|
| Background | `LinearGradient` — `['#1c1c1e', '#2a0e0e']`, `start: {x:0,y:0}`, `end: {x:1,y:1}` |
| Padding | `14px` horizontal, compact top |
| Logo | `dscar-logo.png` (80×44, white PNG, already at `apps/mobile/assets/`) |
| Logo position | Left |
| Greeting | Right — small `rgba(255,255,255,0.4)` text "Bom dia 👋" above bold white name |
| Stat chips | Below logo row: "N Abertas" (red), "N Prontas" (green), "N Atrasadas" (yellow) |
| Chip style | Semi-transparent fill + matching border, `borderRadius: 20`, compact |

**Removed from current `DarkHeader`:** company name subtitle, `SyncIndicator` in header, flat `#0f172a` background, overlay hack.

**Chip colors (match T2 mockup):**
- Open: `#fca5a5` text, `rgba(252,165,165,0.1)` bg, `rgba(252,165,165,0.35)` border
- Ready: `#86efac` text, `rgba(134,239,172,0.1)` bg, `rgba(134,239,172,0.35)` border
- Overdue: `#fcd34d` text, `rgba(252,211,77,0.1)` bg, `rgba(252,211,77,0.35)` border

---

## Files Changed

| File | Change |
|---|---|
| `apps/mobile/src/components/navigation/FrostedNavBar.tsx` | Full rewrite — T2 dark pill |
| `apps/mobile/app/(app)/os/index.tsx` | Replace `DarkHeader` → `OSHeader`, add LinearGradient, clean dead code |
| `apps/mobile/package.json` | Add `expo-linear-gradient` |

---

## Out of Scope

- Other screens' headers (busca, perfil, etc.)
- Tab bar label animations — not part of T2
- Animation of stat chips
- `SyncIndicator` relocation (can be added to list area in a future sprint)
