import React from "react";
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-neutral-50 px-6 pt-4 pb-6">{children}</main>
    </div>
  );
}
