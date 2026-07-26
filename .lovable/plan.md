Plan: Ledgerly UI 2.0 Refresh
================================

Goal
----
Improve the overall layout and design of the app with a phased approach:
1. Phase 1 — targeted fixes for the worst UX friction (sidebar, forms, Settings).
2. Phase 2 — full visual refresh to a Midnight Indigo palette, applied consistently across all routes.

Scope is driven by your feedback: sidebar/navigation, forms/input flows, and the Settings page are the priorities. The palette is locked to Midnight Indigo (deep navy with indigo accents). Revert/rollback is handled by Lovable’s built-in History, not by building a version switcher in the app.


Phase 1: Targeted Fixes (fix what hurts first)
-----------------------------------------------

### 1. Sidebar / Navigation
Current state: `AppLayout.tsx` renders 10 items in a single flat list. On desktop it fills the sidebar; on mobile it becomes a horizontally scrolling strip. This is hard to scan and the most important actions blend in with less-used pages.

Changes:
- Group nav items into logical sections:
  - Core: Dashboard, + New Spend
  - Money in: Income, Savings & Pockets
  - Money out: Commitments, Credit & Debt, History
  - Plan & review: Reports, Past Cycles
  - App: Settings
- Keep the two most important actions visually prominent: **+ New Spend** as a primary button-style link and **Dashboard** as the home anchor.
- Convert the mobile nav to a bottom tab bar or a compact sheet rather than horizontal scrolling. Use icon + label with the active item highlighted.
- On desktop, keep the sidebar but tighten spacing, use subtle section labels, and make the active item a filled pill instead of a tinted background.
- Add a collapsible mini-sidebar option (icon-only) for larger screens if users want more room.

### 2. Settings page declutter
Current state: `settings.tsx` is one long vertical stack of cards (Cycle, Expense categories, Income categories, Retailer suggestions, Item suggestions, Storage, About). Each card is full width and visually equal, so the page feels like a wall of options.

Changes:
- Introduce a tabbed or sub-navigation layout inside Settings:
  - Cycle & account
  - Categories (expense + income together)
  - Suggestions (retailers + items)
  - Data & privacy (export, clear, about)
- Move the less frequently used “Suggestion manager” and “About” sections behind tabs so the first view is Cycle + Categories.
- Improve the category input: add a clearer “Add” affordance, inline empty state, and compact badge grid with clearer remove buttons.
- Add a small sticky summary on the right (desktop) showing total categories, hidden items, last export date if available.

### 3. New Transaction / Forms
Current state: `new.tsx` is a two-step form with a lot of stacked cards. Step 1 has Receipt, Protection, Notes, Pending toggle. Step 2 has Quick Add, repeating item cards, Payment Split editor. The calculated total and payment section are below the fold, making it easy to lose context.

Changes:
- Make the stepper sticky or more prominent so the user always knows where they are.
- In Step 2, introduce a compact “order summary” row (total, item count, balance impact) that stays visible while scrolling.
- Convert each item card from a full Card to a more compact row-based layout on larger screens, with item name, price, quantity, and category inline. Keep the card layout only on mobile.
- Add clearer visual grouping: Item list → Summary → Payment. Use a sticky or floating Save button at the bottom on mobile.
- Simplify the Pending toggle: when on, dim the rest of the form so it’s obvious you’re in fast-entry mode.
- Ensure the Payment Split Editor uses the same field style and labels as the rest of the form.


Phase 2: Full Visual Refresh (Midnight Indigo)
----------------------------------------------

### 1. Palette & tokens
Apply the Midnight Indigo palette to `src/styles.css`:
- Background: deep navy (#0a0a1a / #141432)
- Surfaces: slightly lighter navy (#1e1e5a)
- Primary accent: electric indigo (#4f46e5)
- Text: crisp white/very light gray for foreground, softer muted gray for secondary text
- Keep destructive/error, warning, and success semantics but recolor them to fit the cooler palette.

Update the chart colors so they still work against the dark navy background.

### 2. Typography
Current: Space Grotesk headings + Inter body. Keep the pairing but adjust weights:
- Headings use a slightly heavier weight for clearer hierarchy.
- Numbers and monetary values use tabular figures by default.
- Reduce uppercase/tracked label usage slightly; too many uppercase labels make the app feel noisy.

### 3. Dashboard hierarchy
Current: `index.tsx` has a 4-column stat grid, a 2+1 column chart section, then a 2+1 bottom section. The visual weight of every card is the same, so the eye has no clear starting point.

Changes:
- Elevate “Left to spend” as the hero metric: larger number, more prominent card, possibly with a subtle trend indicator.
- Move secondary stats (income, items, expenses) into a smaller, more subdued row.
- Make “Spending by category” the primary chart and give it the dominant column. Pull “Return/warranty alerts” into a narrower, scrollable feed.
- Add a “This cycle” header that is more visually tied to the cards below it.
- Consider a subtle card lift/hover state to make the UI feel responsive.

### 4. Component polish across all routes
- Replace flat card headers with cleaner, more consistent header/title/subtitle patterns.
- Standardize button hierarchy: primary for the main action, secondary for related actions, ghost for destructive/cancel.
- Improve empty states with small illustrations or clearer prompts rather than plain text in a card.
- Add consistent hover states and focus rings using the indigo accent.


Success Criteria
----------------
- Sidebar is scannable on both desktop and mobile; the user can reach the top 3 actions in one click/tap.
- Settings first view shows only the most-used controls; advanced options are one click away.
- New Transaction form keeps the total and save action visible while adding items.
- The Midnight Indigo palette is applied consistently and all charts remain readable.
- No regressions in existing functionality: auth, data entry, splits, commitments, reports, etc.


Rollback / Versioning
-----------------------
I will not build a runtime “version 1.0 / 2.0” switcher in the app because that adds permanent complexity for a temporary need. Instead, I will pause after each phase so you can review the preview. If you dislike a change, use the Lovable History tab or the revert button under any AI message to restore the project to that exact state. This gives you a clean rollback without carrying dead code.


Next Step
---------
Approve this plan and I’ll start with Phase 1 (navigation, settings, forms). After that’s reviewed, I’ll proceed to Phase 2 (Midnight Indigo visual refresh).