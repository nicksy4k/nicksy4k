Add a global "matched items total" summary directly above the History search results when a query is active.

### What will change

In `src/routes/history.tsx`:

1. **Roll up a matched-items total**  
   Add a `useMemo` that iterates over the already-filtered transactions and sums the line totals of items whose `item_name` includes the current search needle (case-insensitive). It also counts how many items and how many transactions are involved.

2. **Render the summary above the results**  
   Insert a small banner between the filter bar and the results list. It appears only when a search is active and at least one item name matches.

   Example copy:  
   `12 matching items across 4 transactions · Total: £123.45`

3. **Re-use existing helpers**  
   - `fmt` for GBP formatting.  
   - The same item-name match logic already used inside the transaction card map.

### Assumption

The total will reflect the full line-item cost (`price × quantity`) to match the existing per-card "Matched X of Y items · £Z" subtotal. If you want the total net of split payments (only the portion that actually left the main balance), I can switch to that instead.

### Out of scope

- No changes to search filtering, category filtering, or date filtering.  
- No changes to the per-card matched-items preview or the "View rest of transaction" toggle.  
- No new dependencies or schema changes.