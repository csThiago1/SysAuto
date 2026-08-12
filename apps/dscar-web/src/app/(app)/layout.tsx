import React from "react";
import { DockNav } from "@/components/dock/DockNav";
import { MobileTabBar } from "@/components/dock/MobileTabBar";
import { CommandPalette } from "@/components/CommandPalette";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>
      <main
        id="main-content"
        // Sem header, o recorte da status bar (PWA iOS, viewport-fit=cover)
        // passa a ser responsabilidade do proprio conteudo.
        className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-2 pb-24 md:px-6 max-md:pb-20"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <DockNav />
      <MobileTabBar />
      <CommandPalette />
    </div>
  );
}
