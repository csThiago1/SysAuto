"use client";

import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";
import { useUIStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div
      className={cn(
        "grid min-h-screen bg-neutral-100 transition-[grid-template-columns] duration-normal",
        sidebarCollapsed
          ? "grid-cols-[64px_1fr]"
          : "grid-cols-[240px_1fr]"
      )}
    >
      <Sidebar />
      <div className="flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
