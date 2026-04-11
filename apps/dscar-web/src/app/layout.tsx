import type { Metadata } from "next";
import { Montserrat, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// ─── Fontes DS Car ────────────────────────────────────────────────────────────
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
  weight: ["600", "700"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "DS Car ERP",
    template: "%s · DS Car",
  },
  description: "Sistema de gestão DS Car Centro Automotivo",
  robots: { index: false, follow: false },
};

// ─── Layout raiz ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${rajdhani.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
