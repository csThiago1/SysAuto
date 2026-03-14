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
};

export default nextConfig;
