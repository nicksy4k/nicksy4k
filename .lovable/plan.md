## Goal

Make item entry feel like a fast keyboard-first form: focus lands where you expect, the suggestion list never pops open unasked, and you can complete a whole receipt without touching the mouse.

## 1. Rework `src/components/ui/combobox.tsx` (root cause)

Today the combobox is a **button + popover**. The text field only exists once the popover is open, so `autoFocus` is forced to open the dropdown to have something to focus. That's exactly the behaviour you want gone.

Rebuild it as an **inline typeahead input**:

- The trigger becomes a real `<input>` styled like the other form inputs, always editable, showing the current value.
- A small chevron button sits on the right to open the full list on demand.
- The suggestion list renders in an anchored popover **below** the input, but it opens only when: the user types, presses ArrowDown, or clicks the chevron. Never on focus, never on mount.
- `autoFocus` now just focuses the input — no dropdown.

Keyboard contract:

```text
type            filter + open list
ArrowDown/Up    open list / move highlight
Enter           list open + highlighted -> pick it
                otherwise -> commit typed text as-is
Tab             commit typed text, move to next field
Esc             close list, keep typed text
```

Props stay backwards compatible (`value`, `onChange`, `options`, `placeholder`, `autoFocus`, `className`) plus an optional `onEnterCommit` for form-level "Enter moves on" behaviour, so both `new.tsx` and `history.tsx` pick up the fix with no call-site churn.

## 2. `src/routes/new.tsx` polish

- **Add item / Add another item**: keep the existing `lastAddedId` focus mechanism — with the new combobox it focuses the name field silently. Also scroll the new row into view so it isn't hidden under the sticky header.
- **Enter chaining in the itemize step**: Enter in Item name -> Price; Enter in Price -> if the row is complete, add a new item row and focus its name field. This makes "name, price, Enter, name, price, Enter…" work end to end.
- **Qty**: keep the 1–20 Select but let it be reached by Tab and driven by number keys (native Select behaviour); no layout change.
- **Step 1**: Enter in the retailer field advances to the itemize step when the step is valid, instead of doing nothing.
- **Cmd/Ctrl+Enter** anywhere in the form saves the transaction.
- **Delete-row button**: add an accessible label and a tooltip ("Remove item"); it's currently icon-only.
- **Empty-row guard**: trailing blank rows are already dropped on save — surface a small hint on the Add button when the last row is still empty, rather than stacking blank rows.

## 3. `src/routes/history.tsx` (edit + settle dialogs)

- Same combobox behaviour applies automatically; the settle dialog's `autoFocus` on the first item stops force-opening the list.
- Add the same Enter-chaining between name -> price -> new row inside the dialog's item list.
- **Add item** in the dialog focuses the newly added row's name input.
- **Cmd/Ctrl+Enter** saves the dialog; Esc keeps the existing close behaviour.
- Focus the first meaningful field when each dialog opens (item name for settle, retailer for edit).

## 4. Cross-cutting accessibility touches

- Proper `role="combobox"` / `aria-expanded` / `aria-activedescendant` wiring on the new input, and `aria-label`s on icon-only buttons in the item rows.
- Visible focus rings on the combobox input and chevron matching the rest of the design tokens.

## Technical notes

- Only `src/components/ui/combobox.tsx`, `src/routes/new.tsx`, and `src/routes/history.tsx` change; no schema, store, or business-logic changes.
- The list keeps using `cmdk` internals for filtering/highlighting, driven by a controlled `open` state, so styling stays consistent with other menus.
- A dated entry gets prepended to `src/lib/changelog.ts` for the UX pass.
