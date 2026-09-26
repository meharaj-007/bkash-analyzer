import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>; the deploy workflow sets this.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Fully static site: no server, so nothing can receive a statement.
  output: "export",
  basePath,
};

export default nextConfig;
