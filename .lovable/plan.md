## Goal
Make pocket movements visible in both history views so it's obvious where income was routed and how a transaction was funded.

## 1. Income history — show pocket routing

In `src/routes/income.tsx`, the "Income history" list currently shows only source, amount, category, notes. Pocket routing is stored as separate `savings` deposit rows tagged in `notes`:

- One-off income splits → `"Routed from income: <source>"`
- Recurring income allocations → `"Auto-routed from <source>"`

Build a lookup keyed by `date + source` from `savingsItems` (kind `"deposit"`) matching either note pattern, then render a compact routing line under each income entry:

```text
→ Pocket · Food  £300   Bills  £200   · Main  £79
```

- Order pockets by deposit `created_at`.
- Compute `mainRemainder = income.amount − Σ matched deposits`; hide the "Main" chip when it's zero or negative.
- Reuse `colorForKey` for the pocket swatch, `fmt()` for amounts.
- Only render the line when at least one matched deposit exists.

## 2. Transaction history — surface splits in the collapsed row

In `src/routes/history.tsx`, `payment_splits` are already rendered inside the expanded `CollapsibleContent`, so they're hidden until the row is opened. Add a one-line summary directly under the retailer/date in the always-visible row so pocket funding is scannable:

```text
Paid with · Pocket Food £30 · Main £70
```

- Render only when `t.payment_splits?.length > 0`.
- Use the same label mapping already in place (main / pocket:<name> / bnpl / other), colored swatch for pocket splits.
- Keep the existing expanded "Paid with" block as-is (it stays the detailed source of truth).
- Skip for pending transactions (no splits yet).

## Out of scope
- No schema changes — income splits stay stored as savings deposits with the existing note conventions.
- No edits to the split editors or save flows.
- No dashboard/report changes.

## Files touched
- `src/routes/income.tsx` — build savings→income match map, render pocket chips under each history row.
- `src/routes/history.tsx` — add collapsed-row split summary line.
