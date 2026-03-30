"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
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

function SelectTrigger({ className, children, ...props }: React.HTMLAttributes<HTMLButtonElement>): React.ReactElement {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded border border-neutral-200 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-neutral-400" />
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }): React.ReactElement {
  const { value } = React.useContext(SelectContext);
  return <span className={value ? "text-neutral-900" : "text-neutral-400"}>{value || placeholder}</span>;
}

function SelectContent({ className, children }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement | null {
  const { open, setOpen } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div
        className={cn(
          "absolute left-0 top-full z-50 mt-1 w-full rounded border border-neutral-200 bg-white shadow-dropdown",
          "animate-fade-in",
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
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center px-3 py-2 text-sm",
        "hover:bg-neutral-50",
        value === selectedValue && "bg-primary-50 text-primary-700 font-medium",
        className
      )}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
