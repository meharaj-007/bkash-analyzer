# Repository Guidelines

## Project Structure & Module Organization

`src/app/` contains routes; `src/components/` contains the dashboard, uploader, table, and charts. `src/lib/` holds PDF parsing, analysis, export, and shared types. `scripts/` generates samples and copies PDF.js assets; `public/` holds browser assets.

## Build, Test, and Development Commands

Run commands from this project directory. `npm ci` installs locked dependencies; `npm run dev` starts local development; `npm run build` produces the production build; `npm run lint` checks ESLint rules.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, PascalCase React components, and camelCase functions. Match nearby quote and semicolon conventions. Keep reusable logic outside page components and use the configured ESLint rules; avoid unrelated formatting changes.

## Testing Guidelines

Run `npm test` for Vitest tests matching `src/**/*.test.ts`, `npm run typecheck`, and lint/build before submitting logic changes. Add synthetic parser fixtures and regression cases for malformed input, amounts, dates, and exports. No numerical coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent history uses imperative subjects and versioned release messages, such as “Release v0.3.0: daily cash-flow chart.” Keep commits focused on one change. In pull requests, explain the problem, resulting behavior, and validation performed; link an issue when applicable. Include screenshots for visible UI changes and call out configuration or migration changes. These are contributor expectations, not a claim of enforced branch rules.

## Configuration & Data

Keep statement processing in the browser. Never commit real statements or passwords. `npm run sample` generates example data; the postinstall script copies PDF.js assets.

## Framework Instructions

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
