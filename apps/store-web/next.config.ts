import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["@paddock/types", "@paddock/auth"],
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
