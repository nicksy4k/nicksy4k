# 🚀 Ledgerly: Personal Expense Tracker

Ledgerly is a custom-built, highly personalized financial tracking engine designed to manage daily expenses, recurring commitments, and specific budget pockets. 

It is currently in active real-world Beta testing to stress-test UI logic, transaction sorting, and automated bill-logging cycles.

## 🛠️ Tech Stack
* **Builder:** Lovable
* **Front-End:** React, Vite, TypeScript
* **Database & Auth:** Supabase
* **Styling:** Tailwind CSS

## 🎯 Core Features (Live)
* **Dynamic Dashboard:** Real-time metrics for current cycle spend, active tracking, and visual breakdown charts.
* **Commitments Engine:** Automated tracking for recurring bills with a chronological, color-coded "waterfall" warning system.
* **Savings & Pockets:** A digital envelope system for micro-budgeting (e.g., Food Budget, Bill Money) with internal transfer capabilities.
* **Transaction History:** A searchable, fully itemized ledger.

---

## 🗺️ Master Development Roadmap

### Phase 1: Core Engine & Functionality
- [ ] **The Mega Ledger Upgrade:** Add an "Edit" pencil icon, a `Quantity` multiplier (`Price × Quantity`), and backend support for negative values (promos/discounts).
- [ ] **Commitment Categorization:** Add Category dropdowns to new/existing commitments so they don't default to "Subscriptions," ensuring auto-logged items inherit the correct tag.
- [ ] **Receipt Uploads:** Integrate Supabase storage to attach receipt photos/PDFs to transaction IDs.
- [ ] **"Money Owed" Tracker:** Build a dedicated tab for personal loans and IOUs.

### Phase 2: Quality of Life & UI Polish
- [ ] **Dashboard Cycle Sync:** Force Dashboard total cards to calculate "This Cycle" based on payment reset dates, rather than all-time totals.
- [ ] **History Analytics:** Add custom date/period filters and dynamic charts to the History tab.
- [ ] **Global Alphabetical Dropdowns:** Force all selection menus (Categories, Pockets) to sort A-Z automatically.
- [ ] **Mobile Bug Fix:** Clean up the CSS overflow wrapper on the Savings tab to remove the floating scrollbar artifact.
- [ ] **"Next Cycle" Divider:** Insert a visual break-line in the Commitments tab to separate immediate bills from future ones.

### Phase 3: "The Launch" Polish
- [ ] **First-Time Setup Wizard:** Build an onboarding flow for setting up income dates, opening balances, and initial pockets.
- [ ] **Auth UI Messages:** Add pop-up snackbar alerts for Sign In/Sign Up errors and email verification prompts.
