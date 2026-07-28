## Add "Transactions only" export option

Currently the Reports export always includes every itemized line. Add a toggle so users can export/print a condensed version with one row per transaction (retailer, date, category, total) — no item breakdown.

### UI (`src/routes/reports.tsx`)
- Add a "Detail level" control near the Print / Spreadsheet buttons with two options:
  - **Summary** — one row per transaction
  - **Itemized** — current behavior (one row per item)
- Persist the choice in local state; pass it into both export paths.

### Spreadsheet (`src/lib/reportExport.ts`)
- When mode is `summary`, build the "Transactions" sheet with columns: Date, Retailer, Category, Payment method, Total (and Refunded if applicable). Skip per-item rows.
- Income and Summary sheets stay the same.

### Print layout (`src/components/PrintableReport.tsx`)
- Accept a `mode` prop.
- In `summary` mode, render the transactions table with one row per transaction and drop the nested item list. Keep the income table and category breakdowns unchanged.

No schema changes, no business-logic changes — presentation only.
