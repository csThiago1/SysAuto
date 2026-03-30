import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppHeader } from "@/components/AppHeader";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-neutral-100">
      <Sidebar />
      <div className="flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
