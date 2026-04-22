"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => undefined,
  open: false,
  setOpen: () => undefined,
});

function Select({ value = "", onValueChange = () => undefined, children }: SelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white",
        "focus:outline-none focus:ring-1 focus:ring-primary-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", open && "rotate-180")} />
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }): React.ReactElement {
  const { value } = React.useContext(SelectContext);
  return <span className={value ? "text-white" : "text-white/30"}>{value || placeholder}</span>;
}

function SelectContent({ className, children }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement | null {
  const { open, setOpen } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div
        className={cn(
          "absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-white/10 bg-[#1c1c1e] shadow-lg",
          "animate-fade-in overflow-hidden",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

function SelectItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { onValueChange, setOpen, value: selectedValue } = React.useContext(SelectContext);
  const isSelected = value === selectedValue;
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-white/80",
        "hover:bg-white/5 transition-colors",
        isSelected && "bg-primary-500/10 text-primary-400",
        className
      )}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
      {!isSelected && <span className="w-3.5 shrink-0" />}
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
