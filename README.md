# bKash Statement Analyzer

> **Not affiliated with bKash Limited.** This is an independent open-source
> project. It is not made, endorsed or supported by bKash Limited, and
> "bKash" is a trademark of its owner.

Drop in the password-protected statement PDF that bKash emails you and get a
dashboard of where your money actually went. The PDF is decrypted, parsed and
analysed **entirely in the browser tab** — there is no upload, no API route, no
database, and nothing is written to storage. Closing the tab discards everything.

**Live demo:** https://meherajulmahmmud.github.io/bkash-analyzer/ — click
**Try the sample statement** to explore it without using your own data.

## Your data stays in the tab

- The site is a static export hosted on GitHub Pages. There is no server that
  could receive a statement.
- A Content Security Policy (`connect-src 'self'`) stops the page from sending
  requests to any other origin, so even a compromised dependency cannot upload
  your data. You can check this yourself: open your browser's developer tools,
  load a statement, and watch the Network tab. The only requests are the site's
  own files.
- No cookies or analytics. The only thing the site stores is your light/dark
  theme choice, in `localStorage`; statement data is never stored.

## Sample statement

`public/sample/sample-statement.pdf` is a **synthetic** statement for demos,
tests and development. Everything in it is made up:

| | |
|---|---|
| Password | `01000000000` |
| Account holder | `SAMPLE CUSTOMER` |
| Period | 01 Jun 2026 to 31 Aug 2026, 72 transactions |
| Mobile numbers | the unassigned `010` prefix (`01000000xxx`) |
| Merchants and billers | "Sample Grocery Shop", "Sample Electricity Co", … |
| TRX IDs | `SMP` + 7 random characters |

It copies only the *text structure* of a bKash "Customer App Statement" (column
headers, date and time cells, cover labels) so the parser can read it. It has no
bKash branding, every page says it is synthetic, and the fees are simplified
stand-ins, not bKash's tariff. It is encrypted with 40-bit RC4, like the real
statements.

Regenerate it after changing `scripts/sample-statement/data.mjs`:

```bash
npm run sample
```

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000, drop the PDF in, and enter the password when
asked. For a bKash customer statement the password is the account holder's
11-digit bKash mobile number (e.g. `01XXXXXXXXX`).

`npm install` runs `scripts/copy-pdfjs-assets.mjs`, which copies the pdf.js
worker and standard font data into `public/pdf/` (git-ignored). Without those
files the PDF will not open.

```bash
npm test           # parser + analysis tests against the sample statement
npm run lint
npm run typecheck
npm run build      # static site in out/
```

## What it shows

- **Hero + tiles** — net position, money in, money out, fees paid, cashback and
  interest earned, opening/closing/lowest balance.
- **Written insights** — biggest outflow category, top counterparty, heaviest
  month, transaction rhythm, detected recurring payments, fee burden.
- **Charts** — balance over time, monthly in vs out, outflow and inflow by
  transaction type, top recipients, fees by service, and a weekday × hour
  activity heatmap. Every chart has a table view, so no value is reachable by
  hover alone.
- **Transactions** — sortable, searchable, filterable table of every row.
- **Export** — the parsed rows as CSV or JSON, scoped to the current filter.

Filters (date range, direction, transaction type, free-text search) sit in one
row above everything and scope the entire dashboard at once.

**Theme** — System, Light or Dark from the toggle in the header. The choice is
remembered and applied before the page paints, so there is no flash of the wrong
theme; "System" follows your OS setting live.

## How the parsing works

`src/lib/parse.ts` drives pdf.js directly rather than relying on plain text
extraction, because the statement is a table and reading order alone loses which
column a number belongs to:

1. pdf.js decrypts the PDF (bKash uses 40-bit RC4 with a user password).
2. Text items on each page are grouped into rows by their `y` position.
3. The `Out / In / Charge / Fee / Balance` header row is located per page and its
   **right edges** recorded — the amount columns are right-aligned, so an amount
   is assigned to the column whose right edge it sits nearest.
4. A row beginning with a `DD-Mon-YY` cell starts a transaction; the rows below
   it (time, wrapped merchant names, wrapped details) fold into that transaction.
5. Details are split into counterparty, mobile number and TRX ID.

The parsed totals are checked against the Overview totals printed on page 1 of
the statement; any mismatch is surfaced as a warning banner rather than silently
accepted. Note that bKash's printed "Total Out" includes charges, so the check
compares `sum(out) + sum(fees)` against it.

## Layout

```
src/lib/parse.ts            PDF → Statement (pdf.js, runs in the browser)
src/lib/parse.test.ts       Tests against the synthetic sample statement
src/lib/analyze.ts          Statement → aggregates and written insights
src/lib/format.ts           Taka, date and axis formatting
src/lib/export.ts           CSV / JSON download, built client-side
src/components/             Dashboard, filters, transaction table
src/components/charts       Hand-rolled SVG chart kit (no chart library)
scripts/sample-statement/   Synthetic statement data and PDF generator
```

## Deployment

`.github/workflows/ci.yml` runs lint, typecheck, tests and a static build on
every push and pull request, and deploys `main` to GitHub Pages. To enable it on
a fork, set **Settings → Pages → Source** to **GitHub Actions**.

## Contributing

Bug reports and pull requests are welcome. **Never attach or commit a real
statement**, and never paste real names, numbers or TRX IDs into issues. If a
statement fails to parse, describe the layout difference, or add a case to the
sample generator that reproduces it. `.gitignore` blocks every PDF except the
synthetic sample.

## Notes and limits

- Built against the "Customer App Statement" format. A statement with a
  different column layout may parse into fewer rows; the totals warning is there
  to catch that.
- Recurring-payment detection groups by counterparty and keeps groups of three or
  more whose median gap falls between 3 and 45 days.
- "Earned back" counts cashback, interest and rewards only. Remittance rows say
  "including Govt. Incentive" in their type but are ordinary inflow, so they are
  excluded.
- Colours follow a validated categorical palette: money in is slot 1, money out
  (fees included) is slot 2, and the heatmap uses a single-hue sequential ramp.

## License

[MIT](LICENSE)
