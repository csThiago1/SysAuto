"use client";

/**
 * TabPlaceholder — Placeholder para tabs implementadas no Sprint 8.
 */

import React from "react";
import { Construction } from "lucide-react";

interface TabPlaceholderProps {
  label: string;
  sprint?: string;
}

export function TabPlaceholder({
  label,
  sprint = "Sprint 8",
}: TabPlaceholderProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white/5 shadow-card p-8 flex flex-col items-center justify-center text-white/50">
      <Construction className="h-8 w-8 mb-3 text-white/30" />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-white/40 mt-1">Disponível no {sprint}</p>
    </div>
  );
}
