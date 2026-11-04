# Groceries and snacks on Insights: track the category, not each item

## What changes for you
- **Price Check and Price Alerts** stop listing everyday grocery and snack items (bread, milk, crisps, chocolate, etc.). They keep showing things where the price really matters, like energy drinks, plushies, takeaways and other repeat buys.
- **New "Groceries & Snacks" card** on Insights, with one row for each:
  - This cycle's total vs your average over recent cycles (e.g. "Groceries £126 · avg £118 · +7%", "Snacks £14 · avg £19 · −26%")
  - Number of shops and average spend per shop
  - Split by shop (Asda, Tesco, ...), so you can see where the money goes
- **Habit Spotlights** stay as they are. Energy drinks bought in an Asda shop still count towards your energy drinks tracker.
- **Ask Ledgerly** can still answer about one item if you ask directly (e.g. "how much was bread last time?"). It just won't bring up grocery or snack item prices unless you ask.

## Technical details
- `src/lib/insights.ts`: add `CATEGORY_TRACKED = ["groceries", "snacks"]` plus `isCategoryTracked(it)` (matches Groceries/Food and Snacks/Sweets/Confectionery categories). `priceChecks()` (and so `priceAlerts`) skips these items by default, with an option to include them. Add `categoryStats(txs, cycles, group)` returning per-cycle total, average, number of shops, average spend per shop and per-shop split, excluding auxiliary lines (postage, fees, etc.).
- `src/routes/insights.tsx`: render the Groceries & Snacks card and use the filtered price checks.
- `src/lib/api/insights-ai.functions.ts`: pass both summaries and tell the assistant to share grocery and snack item prices only when asked.
- Tests for the category filter and per-cycle averages, a changelog entry, and the preference saved to memory.
