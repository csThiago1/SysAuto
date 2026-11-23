import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Barlow_Condensed, Outfit, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// ─── Fontes DS Car ────────────────────────────────────────────────────────────
// Outfit no lugar da Fieldwork Hum do manual da marca (paga, sem licença web).
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
  weight: ["600", "700"],
});

// Torre de tempos: números, títulos e placar em condensada (a do site institucional).
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-cond",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "DS Car ERP",
    template: "%s · DS Car",
  },
  description: "Sistema de gestão DS Car Centro Automotivo",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DS Car",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // maximumScale 1 evita zoom acidental em inputs no iOS sem bloquear pinch (viewport-fit pro notch)
  viewportFit: "cover",
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
      className={`dark ${outfit.variable} ${rajdhani.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            try {
              var t = localStorage.getItem('dscar-theme') || 'dark';
              document.documentElement.classList.remove('dark', 'light');
              document.documentElement.classList.add(t);
            } catch(e) {}
          })()
        `}</Script>
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
