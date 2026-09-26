/**
 * Path prefix the site is served under: "" locally, "/<repo>" on GitHub Pages.
 * Set NEXT_PUBLIC_BASE_PATH at build time; next.config.ts reads the same value.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
