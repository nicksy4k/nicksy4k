# Beta polish: feedback, data export, privacy details, beta notice

Four additions across the auth page and Settings, plus one new export utility. All UI reuses the existing Ledgerly design system (Midnight Indigo palette, shadcn components).

## 1. Feedback email address

I need one piece of info from you before building: **the email address** that the "Share feedback / report bugs" mailto link should target. I'll wire it as a constant in `src/lib/support.ts` so you can change it in one place. If you'd rather I use a placeholder like `feedback@ledgerly.app` for now, say so.

## 2. "Share feedback / report bugs" (mailto)

- New tiny helper `src/lib/support.ts` exporting `FEEDBACK_EMAIL` and a `buildFeedbackMailto(subject?, body?)` that prefills subject "Ledgerly Beta feedback" and a body template with app version + a "What happened / What did you expect" scaffold.
- **Landing page** (`src/routes/auth.tsx`): add a "Share feedback" ghost button with a `MessageSquare` icon in the footer strip, right next to the existing legal/privacy text.
- **In-app** (signed-in): 
  - Add a compact "Feedback" icon-button in the top header inside `src/components/AppLayout.tsx`.
  - Add a "Send feedback" row in `src/routes/settings.tsx` under a new "Beta" card, alongside the export and privacy actions.

## 3. "Download my data" export

- New file `src/lib/exportData.ts` that, for the current user, pulls every row from: `transactions`, `incomes`, `recurring_incomes`, `commitments`, `debts`, `debt_items`, `loans`, `savings`, `categories`, `user_settings`.
- Converts each table to CSV (simple RFC-4180 escaping, no new deps) **and** collects the full dataset as a single `ledgerly-export.json`.
- Downloads all receipt files referenced by `transactions.receipt_location` and `receipts.receipt_location` from the private `receipts` bucket via `supabase.storage.from('receipts').download(path)`, placing them under `receipts/<original-path>` in the archive. Skips silently on individual failures and records them in an `export-manifest.txt`.
- Bundles everything into a single ZIP using **JSZip** (new dep, ~100KB, browser-safe) and triggers a browser download named `ledgerly-export-YYYY-MM-DD.zip`.
- UI: new "Download my data" button in Settings → Beta card. Shows a progress toast ("Preparing export…" → "Export ready") and disables the button while running. Errors surface via `toast.error`.

## 4. Privacy & Security details modal

- New component `src/components/PrivacyDetailsDialog.tsx` — a shadcn `Dialog` with three tabbed sections:
  1. **How your data is protected** — plain-language breakdown of Row Level Security (each table is scoped to `auth.uid() = user_id`), encrypted storage at rest, HTTPS in transit, and that receipts sit in a **private** bucket accessible only via authenticated signed requests.
  2. **What we (don't) see** — clarifies the app developer cannot read your financial records through the normal app, and lists the small set of operational data the platform necessarily processes (auth email, timestamps).
  3. **Privacy update history** — a short changelog array (dates + entries) rendered as a timeline. Seeded with today's entry: "Beta launch — RLS across all user tables, private receipts bucket, encrypted at rest." Adding future entries is a one-line edit.
- Trigger it from two places:
  - Landing page footer: replace the current inline privacy blurb with a "Privacy & security details" link that opens the modal (the short summary stays as one line above the link).
  - Settings → Beta card: "Privacy & security details" row.

## 5. Beta access notice on the login page

- Add a prominent `Alert` at the top of the right-hand column in `src/routes/auth.tsx`, above the sign-in card:
  - Icon: `Info` / `Sparkles`
  - Title: **"You're joining the Ledgerly beta"**
  - Body: "Features may change without notice, some flows are still being polished, and occasional bugs are expected. Please share anything you spot — it directly shapes what ships next."
  - Uses the existing accent styling (subtle border + muted background) so it doesn't compete with the sign-in card.
- The existing small "Beta" badge next to the logo stays.

## Files touched

- **New**: `src/lib/support.ts`, `src/lib/exportData.ts`, `src/components/PrivacyDetailsDialog.tsx`
- **Edit**: `src/routes/auth.tsx` (beta notice, feedback button, privacy modal trigger, refined footer), `src/routes/settings.tsx` (new Beta card with 3 actions), `src/components/AppLayout.tsx` (header feedback icon)
- **Dependency**: add `jszip`

## Out of scope

- No new database tables (feedback is mailto-only per your choice).
- No changes to auth, RLS, or receipt storage policies.
- No re-encryption or backend changes — the privacy modal only *describes* what's already true.
