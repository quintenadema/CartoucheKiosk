import { randomUUID } from "node:crypto";

// Vercel's deployment URL changes even when the same commit is redeployed.
const deploymentVersion = process.env.VERCEL_URL || randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_DEPLOYMENT_VERSION: deploymentVersion },
  async rewrites() {
    return [{ source: "/version", destination: "/api/version" }];
  },
};

export default nextConfig;
