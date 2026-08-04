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

## Access control — admin only for now

The scanner ships behind a proper, reversible gate so beta testers can't spend your credits.

- A new `user_roles` table (the secure pattern: roles live in their own table, never on the profile) plus a `has_role()` check. Your account gets the `admin` role seeded by email.
- A single `feature_flags` config in `src/lib/features.ts` that says: *receipt scanning requires role `admin`*. One line changes it to "any signed-in user" or "role `beta`" later.
- **UI**: the "Scan receipt" button is hidden entirely (not just disabled) unless the check passes — no teasing, no dead button.
- **Server**: the scan server function re-checks the role before touching the AI Gateway and returns "Not available on your account" otherwise. The UI gate is convenience; the server gate is the real lock, so no one can call it directly.

Unlocking later is: grant a `beta` role (or flip the flag to allow all), optionally add a per-user daily scan cap or a Bring-Your-Own-Key field that the server prefers over `LOVABLE_API_KEY`. The BYOK hook is designed for now (the handler resolves "which key do I use for this user") but not built.

## AI service and cost per scan

No new provider or API key needed — Lovable AI is already available and handles image + PDF input.

**Rough cost per scan: about 0.1–0.3 credits**, i.e. roughly 3–10 scans per credit.

Where that comes from: a single receipt photo is ~1,000–2,500 input tokens once tiled, plus a short prompt, and the structured JSON output for a big Asda shop (40–60 items) is ~800–1,500 output tokens. Long multi-page PDFs or very long till receipts sit at the top of that range; a takeaway receipt at the bottom. It is an estimate, not a quote — after the first few real scans we can read the actual per-request credit cost from the gateway logs and tune (e.g. a cheaper model tier, or downscaling images client-side before upload, which typically halves input tokens with no accuracy loss on receipts).


## Smart touches worth including

- **Category auto-fill**: after extraction, each item name is run through the existing history-based category suggester (`src/lib/suggestions.ts`) before falling back to the AI's guess — so your own naming habits win.
- **Price sanity**: prices are normalised (strip currency symbols, handle "2 @ £1.50" multi-buy lines into qty 2 × 1.50), negatives treated as discounts.
- **Retailer matching**: the extracted retailer is matched against retailers you've used before, so "ASDA STORES 4021" becomes your existing "Asda" rather than a new spelling.
- **Settle flow**: when scanning from a pending transaction, the retailer/date are kept as-is and only the items + true total are applied.

## Technical approach

1. **Roles + flag**
   - Migration: `app_role` enum, `user_roles` table (with GRANTs + RLS), `has_role(_user_id, _role)` security-definer function, and a seed granting `admin` to the account with email `nicksy4k@gmail.com`.
   - `src/lib/features.ts`: `FEATURES.receiptScan = { requiredRole: "admin" }` plus a `useCanScanReceipts()` hook (queries the user's roles once, cached).
2. **Server function** `src/lib/api/receipt-scan.functions.ts` — `scanReceipt`, protected with `requireSupabaseAuth`:
   - First line of the handler: `has_role(userId, 'admin')` via the request-scoped client; reject with a friendly message if false.
   - Input: the storage path of the already-uploaded file in `receipts` (so the raw file never round-trips through the client twice).
   - Creates a short-lived signed URL, sends it to the Lovable AI Gateway (`openai/gpt-5.6-sol`, Responses API, streamed and consumed server-side) with a strict structured-output schema: `{ retailer, date, currency, total, items: [{ name, price, quantity, category, confidence }] }`.
   - Prompt pins the user's currency and their existing category list so the AI picks from real categories.
   - Returns parsed, validated (zod) data; surfaces 429/402 gateway errors as readable messages.
3. **Rate limiting**: a small `receipt_scans` table (user_id, created_at) with RLS, counted in the handler before calling the model — in place from day one so it's ready when the feature opens up.
4. **UI**: new `src/components/ReceiptScanDialog.tsx` (upload → progress → review table), reusing `ReceiptUpload`'s upload logic. Its trigger button renders only when `useCanScanReceipts()` is true. It calls back with a normalised payload; `new.tsx` and the settle dialog map that onto their existing form state — no changes to save logic or the transactions schema.
5. **Normalisation helpers** in `src/lib/receiptParse.ts` (currency stripping, multi-buy expansion, retailer fuzzy match against past transactions) with vitest coverage.
6. **Changelog**: prepend a dated v2.10.0 entry to `src/lib/changelog.ts` (noted as admin-only preview).

## Out of scope for v1

Bulk/multi-page batch scanning, auto-saving without review, and email-forwarded receipts — all natural follow-ups once the single-receipt flow feels right.
