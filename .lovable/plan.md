## Goal
Replace the plain `title` attributes on the four commitment status icons with rich Shadcn `Tooltip` popovers that explain exactly why the row shows its current state for the active cycle.

## Where
`src/routes/commitments.tsx` — the status icon block (lines ~199–225) inside the commitments list.

## Tooltip content per state

- **Solid green tick — Paid**
  - Title: "Paid this cycle"
  - Body: "Marked paid on {last_paid_date}. Next due {next_due_date}."

- **Outlined green tick — Covered (not due this cycle)**
  - Title: "Covered — not due this cycle"
  - Body: "Next due {next_due_date}, which falls after the current cycle ends on {resetDate}. No action needed until then."

- **Yellow dot — Unpaid · funded**
  - Title: "Funded by Bill Money"
  - Body: "Due {next_due_date} (this cycle). Enough Bill Money is currently allocated via the waterfall to cover it — mark paid when the charge lands."

- **Red dot — Unpaid · shortfall**
  - Title: "Shortfall"
  - Body: "Due {next_due_date} (this cycle). Bill Money has already been exhausted by earlier bills in the waterfall — top up or reprioritise."

Dates formatted with the existing `format(parseISO(...), "d MMM yyyy")` helper. Missing `last_paid_date` falls back to "date unknown".

## Implementation

1. Import `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@/components/ui/tooltip` (already in the project).
2. Wrap the whole `<ul>` (or the list `CardContent`) in a single `<TooltipProvider delayDuration={150}>`.
3. Replace each of the four icon `<span>`s with:
   ```tsx
   <Tooltip>
     <TooltipTrigger asChild><span …>{icon}</span></TooltipTrigger>
     <TooltipContent side="left" className="max-w-xs">
       <p className="font-medium">{title}</p>
       <p className="text-xs text-muted-foreground mt-1">{body}</p>
     </TooltipContent>
   </Tooltip>
   ```
4. Keep the existing `aria-label`s for a11y; drop the redundant `title` attributes to avoid a native + custom tooltip double-up.
5. Because the icon lives inside a `<button>` (the row itself), use `onClick={(e) => e.stopPropagation()}` on the `TooltipTrigger` wrapper span so hovering/tapping the icon does not open the details drawer. Trigger uses `asChild` on a `<span>` (not a nested button) to stay valid HTML.

## Out of scope
No behavioural changes to the waterfall, rollover, or paid logic. Purely presentational.
