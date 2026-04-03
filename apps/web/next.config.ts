import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

void initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  typedRoutes: true,
  turbopack: {
    root: fileURLToPath(new URL("./", import.meta.url)),
  },
};

export default nextConfig;
