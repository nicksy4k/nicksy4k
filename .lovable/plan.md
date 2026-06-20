# Receipt Attachment Upload

Replace the free-text `receipt_location` input with a file upload. Files go to a private `receipts` bucket scoped per-user; the storage path is saved in `transactions.receipt_location`. A signed-URL preview/download link is shown when a receipt exists.

## Storage

- Create private bucket `receipts` (not public).
- RLS on `storage.objects` for bucket `receipts`: authenticated users can SELECT / INSERT / UPDATE / DELETE only when the first folder segment equals their `auth.uid()` (i.e. paths are `{user_id}/{transaction-or-uuid}.{ext}`).
- Allowed file types enforced client-side: PDF, JPG, PNG, WEBP, HEIC. Max ~10 MB.

## Upload UI (new.tsx + history.tsx edit dialog)

When "Receipt attached" toggle is on and `receiptType` is `Digital` or `Email`:
- Show a file input (`accept="application/pdf,image/*"`).
- On select: upload to `receipts/{user_id}/{uuid}.{ext}` via `supabase.storage`, store the returned path in `receiptLocation` state.
- Show filename + "View" (opens signed URL in new tab) + "Replace" / "Remove" controls.
- For `Physical` receipt type, keep the existing free-text input (describes where the paper receipt is filed).

On submit: `receipt_location` is either the storage path (digital/email) or the free-text note (physical). No schema change needed — column stays `text`.

## History page

- Detect storage-path values (contain `/` and don't start with `http`) and render a "View receipt" signed-URL link instead of raw text.
- Search still matches the stored string.

## Out of scope

- No thumbnail preview grid.
- No bulk migration of existing free-text values.
- No email-ingestion automation — "Email" type just means the PDF originated from an emailed receipt.

## Technical notes

- All uploads use the browser `supabase` client; RLS enforces ownership.
- Signed URLs generated on demand with 1-hour expiry via `supabase.storage.from('receipts').createSignedUrl(path, 3600)`.
- File validation with a small zod schema (mime type + size) before upload.
