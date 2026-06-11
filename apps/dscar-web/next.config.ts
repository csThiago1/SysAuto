import path from "path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

// R2_PUBLIC_URL pode ser domínio custom (media.homolog.paddock.solutions)
// ou URL pública R2 padrão (pub-xxxxx.r2.dev). Nunca incluir "https://".
const r2Hostname = process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, "") ?? "";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
    transpilePackages: ["@paddock/types", "@paddock/auth", "@paddock/utils"],
    experimental: {
        typedRoutes: true,
        optimizePackageImports: [
            "lucide-react",
            "recharts",
            "date-fns",
            "@dnd-kit/core",
            "@dnd-kit/sortable",
            "@dnd-kit/utilities",
        ],
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.amazonaws.com",
            },
            {
                protocol: "https",
                hostname: "**.r2.dev",
            },
            // Custom domain do R2 (ex: media.homolog.paddock.solutions)
            ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname }] : []),
        ],
    },
    // Headers de segurança aplicados a todas as respostas.
    // TODO: avaliar adição de Content-Security-Policy estrita após auditoria
    // de todos os domínios externos consumidos (Sentry, R2, Keycloak, etc.).
    // CSP mal configurada quebra telas em produção, então ficou de fora por ora.
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains; preload",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(self), microphone=(), geolocation=(self)",
                    },
                ],
            },
        ];
    },
    // Em dev: proxia /media/* para Django (uploads locais de logos, fotos, etc.)
    // Em prod: URLs de mídia são absolutas (S3/R2), então este rewrite não é
    // necessário — e expor um proxy para localhost:8000 em produção é inseguro.
    async rewrites() {
        if (isProd) {
            return [];
        }
        return [
            {
                source: "/media/:path*",
                destination: "http://localhost:8000/media/:path*",
            },
        ];
    },
};

// Sentry wrapper.
// Defina SENTRY_ORG e SENTRY_PROJECT no ambiente (ex: Vercel, .env.local) para
// que o upload de source maps funcione. Sem essas variáveis, o build segue
// normalmente, apenas sem upload automático para o Sentry.
export default withSentryConfig(
    withBundleAnalyzer(nextConfig),
    {
        silent: true,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        widenClientFileUpload: true,
        tunnelRoute: "/monitoring",
        disableLogger: true,
    },
);
