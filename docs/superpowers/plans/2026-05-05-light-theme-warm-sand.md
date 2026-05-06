# Light Theme (Warm Sand) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Warm Sand" light theme with toggle in the sidebar footer, persisted via localStorage, with zero flash on reload.

**Architecture:** CSS variables define both themes in globals.css (`:root` = dark default, `.light` override). A ThemeProvider context manages state + localStorage sync. An inline `<script>` in layout.tsx applies the class before first paint. The toggle button lives in the Sidebar footer.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS (darkMode: "class"), React Context, localStorage, lucide-react icons.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/globals.css` | Modify | Add `.light` CSS variable block |
| `src/components/ThemeProvider.tsx` | Create | Theme context + hook |
| `src/components/ThemeToggle.tsx` | Create | Sun/Moon button component |
| `src/components/Providers.tsx` | Modify | Wrap children with ThemeProvider |
| `src/app/layout.tsx` | Modify | Add anti-flash script, remove hardcoded `dark` |
| `src/components/Sidebar.tsx` | Modify | Add ThemeToggle to footer |
| `src/components/ui/dialog.tsx` | Modify | Use theme-aware colors (bg-card, text-foreground) |

---

### Task 1: Add Light Theme CSS Variables

**Files:**
- Modify: `apps/dscar-web/src/app/globals.css:8-50`

- [ ] **Step 1: Add `.light` class variable block after `:root`**

After line 50 (closing `}` of `:root`), add the light theme override:

```css
/* ─── Light Theme — Warm Sand ─────────────────────────────────────────────── */
.light {
  --background:          30 100% 99%;
  --foreground:          25 30% 18%;

  --card:                0 0% 100%;
  --card-foreground:     25 30% 18%;

  --popover:             0 0% 100%;
  --popover-foreground:  25 30% 18%;

  --primary:             0 76% 42%;
  --primary-foreground:  0 0% 100%;

  --secondary:           30 30% 94%;
  --secondary-foreground:25 20% 27%;

  --muted:               30 30% 94%;
  --muted-foreground:    30 20% 40%;

  --accent:              30 30% 94%;
  --accent-foreground:   25 20% 27%;

  --destructive:         0 72% 51%;
  --destructive-foreground: 0 0% 100%;

  --border:              30 30% 90%;
  --input:               30 30% 90%;
  --ring:                0 76% 42%;

  --sidebar-bg:          30 100% 99%;
  --sidebar-bg-hover:    30 30% 94%;
  --sidebar-text:        25 20% 35%;
  --sidebar-text-active: 0 76% 42%;
  --sidebar-accent:      0 76% 42%;
  --sidebar-border:      30 30% 90%;
}
```

- [ ] **Step 2: Update `.label-mono` and `.section-divider` to use CSS variable instead of hardcoded hex**

Replace lines 119 and 128:

```css
  /* Label mono — fintech terminal style */
  .label-mono {
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: hsl(var(--primary));
    line-height: 1;
  }

  /* Section divider — LABEL ────────── */
  .section-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: hsl(var(--primary));
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    line-height: 1;
  }
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: hsl(var(--border));
  }
```

- [ ] **Step 3: Update scrollbar-thin for light theme compatibility**

Replace the scrollbar-thumb rules:

```css
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.3);
  }
```

- [ ] **Step 4: Verify CSS is valid**

Run: `cd apps/dscar-web && npx tailwindcss --content './src/**/*.{ts,tsx}' --output /dev/null 2>&1 | head -5`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/app/globals.css
git commit -m "feat(theme): add Warm Sand light theme CSS variables"
```

---

### Task 2: Create ThemeProvider Context

**Files:**
- Create: `apps/dscar-web/src/components/ThemeProvider.tsx`

- [ ] **Step 1: Create ThemeProvider with context, localStorage sync, and class management**

```tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => undefined,
});

const STORAGE_KEY = "dscar-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ThemeProvider.tsx
git commit -m "feat(theme): create ThemeProvider context with localStorage persistence"
```

---

### Task 3: Create ThemeToggle Component

**Files:**
- Create: `apps/dscar-web/src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create the toggle button component**

```tsx
"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={[
        "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
        "transition-colors duration-150",
        "border border-border bg-muted/50 text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
      ].join(" ")}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ThemeToggle.tsx
git commit -m "feat(theme): create ThemeToggle component with sun/moon icons"
```

---

### Task 4: Wire ThemeProvider into Providers

**Files:**
- Modify: `apps/dscar-web/src/components/Providers.tsx`

- [ ] **Step 1: Import and wrap with ThemeProvider**

Replace the full file content:

```tsx
"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { Toaster } from "sonner";
import { ThemeProvider } from "./ThemeProvider";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps): React.ReactElement {
  const queryClient = getQueryClient();

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/Providers.tsx
git commit -m "feat(theme): wire ThemeProvider into app Providers"
```

---

### Task 5: Add Anti-Flash Script to Layout

**Files:**
- Modify: `apps/dscar-web/src/app/layout.tsx`

- [ ] **Step 1: Replace the layout with anti-flash script and dynamic class**

```tsx
import type { Metadata } from "next";
import { Montserrat, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// ─── Fontes DS Car ────────────────────────────────────────────────────────────
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
  weight: ["600", "700"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "DS Car ERP",
    template: "%s · DS Car",
  },
  description: "Sistema de gestão DS Car Centro Automotivo",
  robots: { index: false, follow: false },
};

// Script inline para evitar flash de tema incorreto
const themeScript = `
(function() {
  var t = localStorage.getItem('dscar-theme') || 'dark';
  document.documentElement.classList.add(t);
})()
`;

// ─── Layout raiz ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${rajdhani.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Key changes:
- Removed hardcoded `dark` from `className`
- Added inline `<script>` that reads localStorage and applies class before paint
- `suppressHydrationWarning` already present (handles class mismatch between server/client)

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/app/layout.tsx
git commit -m "feat(theme): add anti-flash script and remove hardcoded dark class"
```

---

### Task 6: Add ThemeToggle to Sidebar Footer

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx:672-708`

- [ ] **Step 1: Import ThemeToggle at the top of the file**

Add import near other component imports:

```tsx
import { ThemeToggle } from "./ThemeToggle";
```

- [ ] **Step 2: Add ThemeToggle button in the footer, between the user info and the logout button**

Find the footer section (around line 672–708). Replace the inner content of the footer `<div>` so that the ThemeToggle appears to the right of the user name, before the logout button:

Replace this block (lines 697–704):

```tsx
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
```

With:

```tsx
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
```

- [ ] **Step 3: Update footer hardcoded colors to use theme-aware classes**

Replace the footer wrapper (line 673):

```tsx
      <div className="border-t border-border p-4">
```

Replace the inner card div (lines 674–679):

```tsx
        <div
          className={[
            "flex items-center rounded-lg bg-muted/50",
            "hover:bg-muted transition-colors duration-150",
            collapsed ? "p-2 justify-center" : "p-2 gap-2.5",
          ].join(" ")}
        >
```

Replace user name text (line 687):

```tsx
                <div className="text-[13px] font-semibold text-foreground/85 whitespace-nowrap overflow-hidden text-ellipsis">
```

Replace role/company text (lines 691–694):

```tsx
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 size={10} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    DS Car{roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                </div>
```

- [ ] **Step 4: Verify the app builds**

Run: `cd apps/dscar-web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (or only lint warnings)

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(theme): add ThemeToggle to sidebar footer with theme-aware colors"
```

---

### Task 7: Make Dialog Component Theme-Aware

**Files:**
- Modify: `apps/dscar-web/src/components/ui/dialog.tsx:69-84`

- [ ] **Step 1: Replace hardcoded dark colors with semantic tokens**

Replace the `DialogContent` inner div className (lines 69–74):

```tsx
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border border-border bg-card p-6 shadow-lg",
          "animate-fade-in",
          className
        )}
```

Replace the close button className (line 78):

```tsx
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
```

Replace DialogDescription text color (line 108):

```tsx
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/src/components/ui/dialog.tsx
git commit -m "feat(theme): make Dialog component theme-aware with semantic tokens"
```

---

### Task 8: Smoke Test Both Themes

- [ ] **Step 1: Start dev server and verify dark theme (default)**

Run: `cd apps/dscar-web && npm run dev`

Open browser at localhost:3000. Verify:
- App loads in dark theme (same as before)
- No console errors about hydration mismatch
- All text readable

- [ ] **Step 2: Click the theme toggle in the sidebar footer**

Verify:
- Theme switches to Warm Sand (cream background, terracotta text)
- Sidebar becomes light with cream bg and subtle border
- Cards have white background with warm borders
- Toggle icon changes from Sun to Moon
- No layout shift or flash

- [ ] **Step 3: Reload the page**

Verify:
- Theme persists (still light after reload)
- No flash of dark theme before light appears

- [ ] **Step 4: Toggle back to dark**

Verify:
- Returns to original dark appearance
- Persists on reload

- [ ] **Step 5: Final commit with any adjustments**

If any tweaks were needed:
```bash
git add -A
git commit -m "fix(theme): adjust theme-aware styles after smoke test"
```

---

## Summary

After completing all 8 tasks, the app will have:
- A complete Warm Sand light theme defined via CSS variables
- A ThemeProvider context managing theme state
- A toggle in the sidebar footer (Sun/Moon icon)
- localStorage persistence with zero-flash on reload
- Dialog component ready for both themes
- Foundation for subsequent plans (error handling, token migration, a11y)
