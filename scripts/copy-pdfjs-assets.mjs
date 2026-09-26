// pdf.js needs its worker (and the standard font data) served as static files.
// Keep public/pdf in sync with the installed pdfjs-dist version.
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist");
const dest = join(root, "public", "pdf");

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(join(src, "build", "pdf.worker.min.mjs"), join(dest, "pdf.worker.min.mjs"));
await cp(join(src, "standard_fonts"), join(dest, "standard_fonts"), { recursive: true });
console.log("pdf.js assets copied to public/pdf");
