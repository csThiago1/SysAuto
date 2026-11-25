import React from "react";
import { Sidebar } from "@/components/dock/Sidebar";
import { MobileTabBar } from "@/components/dock/MobileTabBar";
import { CommandPalette } from "@/components/CommandPalette";
import { RealtimeProvider } from "@/components/RealtimeProvider";

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
      <main
        id="main-content"
        // Sem header, o recorte da status bar (PWA iOS, viewport-fit=cover)
        // passa a ser responsabilidade do proprio conteudo.
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background px-2 pb-20 md:px-6 md:pb-6"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <MobileTabBar />
      <CommandPalette />
      <RealtimeProvider />
    </div>
  );
}
