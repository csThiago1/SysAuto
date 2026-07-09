import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DS Car",
  },
  icons: {
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
      className={`dark ${montserrat.variable} ${rajdhani.variable}`}
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
