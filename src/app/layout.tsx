import type { Metadata, Viewport } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "bKash Statement Analyzer",
  description:
    "Read your password-protected bKash statement PDF and turn it into spending insights — entirely in your browser, nothing uploaded.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

const REPO_URL = "https://github.com/meharaj-007/bkash-analyzer";

// The page may only talk to its own origin (connect-src 'self'), so even a
// compromised dependency cannot send statement data anywhere. Next.js inlines
// its bootstrap scripts in a static export, hence 'unsafe-inline'. Dev mode
// needs eval and a websocket for hot reload, so the policy is production-only.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The head script may set data-theme before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {process.env.NODE_ENV === "production" ? (
          <meta httpEquiv="Content-Security-Policy" content={CSP} />
        ) : null}
      </head>
      <body>
        {children}
        <footer
          className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Independent open-source project. Not affiliated with, endorsed by or
          connected to bKash Limited. &ldquo;bKash&rdquo; is a trademark of its
          owner. ·{" "}
          <a href={REPO_URL} className="underline">
            Source on GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
