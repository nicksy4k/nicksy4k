# Print / Save as PDF for a single transaction

Add a "Print / Save as PDF" action to every transaction row on the History page. Choosing it opens the browser print dialog showing a clean, receipt-style document for just that transaction — the user can then print it or choose "Save as PDF" in the dialog (no PDF library needed).

## How it works

The app already has a print mechanism: elements with the `print-only` class are hidden on screen but become the only visible content when `window.print()` runs (`src/styles.css`). We reuse that so the whole page is hidden and only the receipt prints.

## Changes

1. **New component `src/components/PrintableReceipt.tsx`**
   - Renders inside a `print-only` wrapper, styled with the existing `print-*` CSS classes.
   - Shows: "Ledgerly Receipt" header with generated timestamp, date, retailer, per-item table (item, category, quantity, price, notes), total paid, amount refunded (if any), payment method(s) from `payment_splits`, transaction notes, and receipt/protection info (receipt location, return-by / warranty dates) when present.
   - Uses the existing `fmt`, `mainExpensePortion`, and the same `paymentMethodLabel` logic as `PrintableReport` for consistency.

2. **`src/routes/history.tsx`**
   - Add a printer icon button (with `aria-label="Print or save as PDF"`) alongside the existing edit/refund actions on each transaction row (both desktop and mobile list layouts).
   - Clicking sets `printing` state to that transaction; the matching `<PrintableReceipt transaction={printing} />` renders, then `window.print()` is triggered (via a small effect once the receipt is mounted), and the state clears after the dialog closes (`afterprint` listener).

3. **Changelog**
   - Prepend a dated entry to `src/lib/changelog.ts` (per project rule).

## Verification

- Typecheck + relevant Vitest suites.
- Drive the preview with Playwright: click the print button on a transaction and confirm the receipt content renders (mock `window.print` to capture invocation).

## Technical details

- No new dependencies, no new routes, no database changes — reuses the existing `print-only` / `@media print` CSS.
- Print dialog is browser-native; "Save as PDF" is the user's browser option.
