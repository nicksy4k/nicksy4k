# AI Receipt Scanner

Upload a photo or PDF of a receipt, let AI read it, and pre-fill the New Spend / Settle Pending forms with retailer, date, total and every line item — you just review and save.

## What you'd see

**On the New transaction page (step 1)** and **in the Settle Pending dialog**, a new "Scan receipt" button next to the existing receipt upload:

1. Tap it → pick a photo (camera roll or camera) or a PDF.
2. A "Reading receipt…" state appears (a few seconds).
3. A **review sheet** slides up showing what the AI found:
   - Retailer, date, total — each editable inline.
   - A checklist of every detected line item: name, price, quantity, and a suggested category.
   - Each row has a checkbox (all ticked by default) so you can drop junk rows like "BAG CHARGE" or loyalty lines.
   - A live "Items total vs receipt total" bar. If they don't match, an amber note shows the difference so you can spot a missed item.
   - Low-confidence fields (blurry text) are flagged with a subtle amber outline so your eye goes straight to them.
4. "Use these items" → the form fills in: retailer combobox, date, total, and one line-item row per ticked item.
5. Nothing is saved until you hit Save, exactly as today. You can still edit/add/remove rows normally.

The scanned file itself is stored in your existing private `receipts` bucket and attached to the transaction, so the scan doubles as the receipt attachment — no double upload.

Failure handling: if the AI can't read the receipt, you get a clear message and the form is untouched (never a half-filled mess). If it reads the retailer/total but no items, it fills what it found and says so.

## AI service

No new provider or API key needed — Lovable AI is already available to the app and handles image + PDF input. Cost is a small per-scan charge against your existing workspace credits, so a rate cap (e.g. 30 scans/day per user) protects against runaway usage.

## Smart touches worth including

- **Category auto-fill**: after extraction, each item name is run through the existing history-based category suggester (`src/lib/suggestions.ts`) before falling back to the AI's guess — so your own naming habits win.
- **Price sanity**: prices are normalised (strip currency symbols, handle "2 @ £1.50" multi-buy lines into qty 2 × 1.50), negatives treated as discounts.
- **Retailer matching**: the extracted retailer is matched against retailers you've used before, so "ASDA STORES 4021" becomes your existing "Asda" rather than a new spelling.
- **Settle flow**: when scanning from a pending transaction, the retailer/date are kept as-is and only the items + true total are applied.

## Technical approach

1. **Server function** `src/lib/api/receipt-scan.functions.ts` — `scanReceipt`, protected with `requireSupabaseAuth`:
   - Input: the storage path of the already-uploaded file in `receipts` (so the raw file never round-trips through the client twice).
   - Creates a short-lived signed URL, sends it to the Lovable AI Gateway (`openai/gpt-5.6-sol`) with a structured-output schema: `{ retailer, date, currency, total, items: [{ name, price, quantity, category, confidence }] }`.
   - Prompt pins the user's currency and their existing category list so the AI picks from real categories.
   - Streams the gateway call inside the handler (avoids the ~2 min buffered-request cutoff on large PDFs).
   - Returns parsed, validated (zod) data; surfaces 429/402 gateway errors as readable messages.
2. **Rate limiting**: a small `receipt_scans` table (user_id, created_at) with RLS, counted in the handler before calling the model.
3. **UI**: new `src/components/ReceiptScanDialog.tsx` (upload → progress → review table), reusing `ReceiptUpload`'s upload logic. It calls back with a normalised payload; `new.tsx` and the settle dialog map that onto their existing form state — no changes to save logic or the database schema for transactions.
4. **Normalisation helpers** in `src/lib/receiptParse.ts` (currency stripping, multi-buy expansion, retailer fuzzy match against past transactions) with vitest coverage.
5. **Changelog**: prepend a dated v2.10.0 entry to `src/lib/changelog.ts`.

## Out of scope for v1

Bulk/multi-page batch scanning, auto-saving without review, and email-forwarded receipts — all natural follow-ups once the single-receipt flow feels right.
