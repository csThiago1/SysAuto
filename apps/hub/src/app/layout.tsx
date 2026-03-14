import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "Paddock Solutions Hub",
    description: "Portal central de acesso — Paddock Solutions",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" className={inter.variable}>
            <body className="min-h-screen bg-background font-sans antialiased">
                <SessionProvider>
                    {children}
                    <Toaster richColors position="top-right" />
                </SessionProvider>
            </body>
        </html>
    );
}
