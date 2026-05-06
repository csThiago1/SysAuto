import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileSidebar } from "@/components/MobileSidebar";
import { CommandPalette } from "@/components/CommandPalette";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileSidebar />
        <main id="main-content" className="flex-1 overflow-auto bg-background px-6 pt-4 pb-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
