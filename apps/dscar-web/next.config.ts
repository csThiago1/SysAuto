import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["@paddock/ui", "@paddock/types", "@paddock/auth"],
    experimental: {
        typedRoutes: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.amazonaws.com",
            },
        ],
    },
    // Em dev: proxia /media/* para Django (uploads locais de logos, fotos, etc.)
    // Em prod: URLs de mídia são absolutas (S3), então este rewrite nunca casa.
    async rewrites() {
        return [
            {
                source: "/media/:path*",
                destination: "http://localhost:8000/media/:path*",
            },
        ];
    },
};

export default nextConfig;
