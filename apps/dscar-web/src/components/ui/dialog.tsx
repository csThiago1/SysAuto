"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ─── Contexts ────────────────────────────────────────────────────────────────

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => undefined,
});

/** Provides the generated title ID from DialogContent down to DialogTitle. */
const DialogTitleIdContext = React.createContext<string>("");

// ─── Dialog (root) ───────────────────────────────────────────────────────────

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({
  open = false,
  onOpenChange = () => undefined,
  children,
}: DialogProps): React.ReactElement {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

// ─── DialogTrigger ───────────────────────────────────────────────────────────

function DialogTrigger({
  children,
  asChild: _asChild,
  className,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── DialogPortal ─────────────────────────────────────────────────────────────

function DialogPortal({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null {
  const { open } = React.useContext(DialogContext);
  if (!open) return null;
  return <>{children}</>;
}

// ─── DialogOverlay ───────────────────────────────────────────────────────────

function DialogOverlay({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 animate-fade-in",
        className
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  );
}

// ─── DialogContent ───────────────────────────────────────────────────────────

function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  const { onOpenChange } = React.useContext(DialogContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const dialogId = React.useId();
  const titleId = `${dialogId}-title`;

  // Escape key closes dialog
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  // Focus trap + auto-focus + body scroll lock
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // Remember the element that had focus before the dialog opened
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog container itself
    el.focus();

    const handleTab = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    el.addEventListener("keydown", handleTab);

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      el.removeEventListener("keydown", handleTab);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border border-border bg-card p-6 shadow-lg",
          "animate-fade-in focus:outline-none",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>
        <DialogTitleIdContext.Provider value={titleId}>
          {children}
        </DialogTitleIdContext.Provider>
      </div>
    </DialogPortal>
  );
}

// ─── DialogHeader ─────────────────────────────────────────────────────────────

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  );
}

// ─── DialogFooter ─────────────────────────────────────────────────────────────

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  );
}

// ─── DialogTitle ──────────────────────────────────────────────────────────────

function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  const titleId = React.useContext(DialogTitleIdContext);
  return (
    <h2
      id={titleId || undefined}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

// ─── DialogDescription ───────────────────────────────────────────────────────

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
