# Return & Warranty Alerts — confirmed scope

## Database (will run as a migration)

Add to `transactions`:
- `protection_type` text — "Return Window" | "Warranty" | null
- `protection_duration` text — "14 Days" / "30 Days" / "90 Days" / "1 Year" / "2 Years" / "Custom Date"
- `expiration_date` date — calculated client-side from `date + duration`, or user-picked for Custom Date
- `dismissed_at` timestamptz — set when the user marks an alert handled

Partial index `(user_id, expiration_date)` where not dismissed, for fast dashboard sort.

Also: strip the deprecated `return_window_expiry` key from any existing `items` JSON.

## New shared module `src/lib/protection.ts`

Constants for types/durations, `computeExpiration(date, duration)`, and `protectionStatus(type, expiration)` returning `ok | warn | expired` (warn = <7d for Return, <30d for Warranty).

## New shared component `src/components/ProtectionFields.tsx`

- Toggle "Add protection / warranty" (default off)
- When on: Type dropdown + Duration dropdown + date input (auto-filled & disabled for presets; editable for Custom Date)
- Live recomputes expiration when transaction date or duration changes
- Inline error if Custom Date < transaction date

## `src/routes/new.tsx`

- Remove the per-item "Return / warranty expiry" input entirely
- Add `<ProtectionFields>` below the receipt block in step 1
- Persist `protection_type / protection_duration / expiration_date` on save (null when toggle off)

## `src/routes/history.tsx`

- Remove "Return by" column from the items table
- Remove per-item return field in the edit dialog
- Add `<ProtectionFields>` to the edit dialog
- Drop `return_window_expiry` from drafts

## `src/lib/types.ts` + `src/lib/store.ts`

- Remove `return_window_expiry` from `LineItem`
- Add the four new optional fields to `Transaction`
- Persist them in `add` / accept in `update`
- New `dismiss(id)` action that sets `dismissed_at = now()`

## Dashboard card `src/routes/index.tsx`

Replace the existing alerts memo + JSX with transaction-level alerts:

- Source: transactions where `protection_type` is set AND `expiration_date >= today - 1 day` AND `dismissed_at` is null
- Sort by `expiration_date` ascending; show up to 6
- Each row: retailer + short summary, type badge, days-left chip color-coded (green / amber / red + "Expired" badge), Receipt button (signed URL via existing storage logic, only when receipt is a storage path), and a small "Mark handled" dismiss button
- Empty state copy + link to `/new`

Ready to build — please switch to build mode and I'll execute the writes.
