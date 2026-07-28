
## Goal

Turn the Reports page into something that can produce a shareable, printable statement that mirrors the layout of your Google Sheets tracker (transactions table + income table + category breakdown), plus a spreadsheet download that opens cleanly in Google Sheets or Excel.

## What you'll get on `/reports`

Two new buttons in the header of the Reports page, next to the existing filters:

- **Download PDF** — opens a print-ready view and triggers the browser's Save as PDF.
- **Download spreadsheet (.xlsx)** — downloads a multi-sheet workbook. Google Sheets opens `.xlsx` files directly (File → Import, or drag into Drive), so this doubles as the "Google Sheets export".

Both use the same date range and category filters already on the page, so whatever you're currently viewing is what gets exported.

## PDF report layout

Rendered as a dedicated print stylesheet on the existing Reports page (no new route). Sections, in order, matching your Sheet:

1. **Header** — "Ledgerly Report", date range, generated timestamp.
2. **Summary tiles** — Income, Spent, Left (same maths as the dashboard for that window).
3. **Transactions table** — Date, Item, Retailer, Category, Payment method (from `payment_splits`), Amount, Notes. One row per item, so multi-item receipts expand like your Sheet.
4. **Income table** — Date, Source, Amount, Notes (from `incomes` in the window, including carryover rows).
5. **Category breakdown** — two small tables mirroring your two pie charts: "Expenses without Bills" and "Where my money goes" (percentages + amounts).

Print CSS handles page breaks, hides the app chrome (sidebar/header), and forces a white background so it saves cleanly to PDF from any browser (Chrome/Safari/Firefox all support Save as PDF from the print dialog). No extra PDF library needed.

## Spreadsheet layout (.xlsx)

Built client-side with `xlsx` (SheetJS) — one small dependency, no server work. Sheets in the workbook:

- **Transactions** — one row per item, columns matching the PDF.
- **Income** — same shape as the income table.
- **Summary** — Income / Spent / Left, plus the two category breakdown blocks.
- **Raw** — full JSON-flat dump of transactions with splits/refunds, for anyone who wants to pivot themselves.

Currency cells use a `£#,##0.00` number format so Sheets/Excel treat them as numbers, not text.

## What this reuses

- Existing filter state, `matchedAmount`, `categoryBreakdown`, and `mainExpensePortion` from `src/routes/reports.tsx` — the PDF and xlsx both read from the same in-memory arrays, so numbers match the on-screen view exactly.
- Existing `incomes` query pattern from the dashboard for the income table (scoped to the same date range).

## What this does not do

- **No direct push to your Google Drive / Sheets account.** That would need a per-user Google OAuth connection. If you want that later, it's a follow-up (App User Connector for Google Sheets, "Save to my Drive" button). For now, downloading `.xlsx` and opening it in Sheets is one click and needs no auth.
- No change to how data is stored or calculated — this is purely a new export surface.

## Technical notes

- New file `src/lib/reportExport.ts` — pure helpers: `buildWorkbook(filtered, incomes, breakdown)` returning a Blob, and `printReport()` calling `window.print()`.
- New file `src/components/PrintableReport.tsx` — hidden-on-screen, visible-on-print component rendered inside `/reports`, driven by the same filtered arrays.
- `src/styles.css` — add a `@media print` block that hides sidebar/header/buttons and shows `.print-only`.
- Add `xlsx` (SheetJS community build) to dependencies.
- Extend the `/reports` query to also fetch `incomes` in the window (single extra Supabase call, same filters).
