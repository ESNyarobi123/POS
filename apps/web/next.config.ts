import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@gulio/ui",
    "@gulio/contracts",
    "@gulio/config",
    "@gulio/barcode",
  ],
  reactStrictMode: true,
};

export default nextConfig;
