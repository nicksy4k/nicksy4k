# Groceries on Insights: track the shop, not the loaf

## What changes for you
- **Price Check and Price Alerts** stop listing everyday grocery items (bread, milk, etc.). They keep showing things where the price really matters: energy drinks, plushies, takeaways and other non-grocery repeat buys.
- **New "Groceries" card** on Insights showing:
  - This cycle's grocery total vs your average over recent cycles (e.g. "£126 this cycle · avg £118 · +7%")
  - Number of shops and average spend per shop
  - Split by shop (Asda, Tesco, ...), so you can see where it goes
- **Habit Spotlights** stay as they are. Energy drinks bought in an Asda shop still count towards your energy drinks tracker.
- **Ask Ledgerly** can still answer about one item if you ask directly (e.g. "how much was bread last time?"). It just won't bring grocery item prices up unless you ask.

## Technical details
- `src/lib/insights.ts`: add `isGroceryItem(it)` (category matches Groceries/Food). `priceChecks()` (and so `priceAlerts`) skips these by default, with an option to include them. Add `groceryStats(txs, cycles)` returning the per-cycle total, average, number of shops, average basket and per-retailer split, all excluding auxiliary lines (postage, fees, etc.).
- `src/routes/insights.tsx`: render the Groceries card and use the filtered price checks.
- `src/lib/api/insights-ai.functions.ts`: pass the grocery summary and tell the assistant to share grocery item prices only when asked.
- Tests for the grocery filter and per-cycle average, plus a changelog entry.
