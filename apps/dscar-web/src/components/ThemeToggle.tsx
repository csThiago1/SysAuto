"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle(): React.ReactElement {
  const { theme, mounted, toggleTheme } = useTheme();

  // Render a placeholder with fixed size to avoid layout shift before mount
  if (!mounted) {
    return (
      <div className="w-7 h-7 rounded-md border border-border bg-muted/50 flex-shrink-0" />
    );
  }

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
