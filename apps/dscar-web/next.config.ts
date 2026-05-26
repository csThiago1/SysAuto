import path from "path";
import type { NextConfig } from "next";

const withBundleAnalyzer = process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

// R2_PUBLIC_URL pode ser domínio custom (media.homolog.paddock.solutions)
// ou URL pública R2 padrão (pub-xxxxx.r2.dev). Nunca incluir "https://".
const r2Hostname = process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, "") ?? "";

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
    transpilePackages: ["@paddock/types", "@paddock/auth", "@paddock/utils"],
    experimental: {
        typedRoutes: true,
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
    // Em dev: proxia /media/* para Django (uploads locais de logos, fotos, etc.)
    // Em prod: URLs de mídia são absolutas (S3/R2), então este rewrite nunca casa.
    async rewrites() {
        return [
            {
                source: "/media/:path*",
                destination: "http://localhost:8000/media/:path*",
            },
        ];
    },
};

export default withBundleAnalyzer(nextConfig);
