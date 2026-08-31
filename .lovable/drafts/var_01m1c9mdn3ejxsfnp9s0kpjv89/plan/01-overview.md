# Ledgerly 3.3 — Phase 2 roadmap

Phase 1 audit polish (v3.2.2) is shipped: loading skeletons, icon-button labels, shared split maths, retired-route SEO cleanup, and 95 passing tests.

This plan covers the next release, 3.3. It keeps the four ideas from the audit that add the most value, in the order we should build them. The AI receipt scanner stays admin-only for now.

## What we are building

1. **Forecast / Safe-to-spend** — one headline number on the dashboard that tells the user what they can actually spend today after upcoming outgoings and pocket allocations.
2. **Budgets per category** — set a target for any spending category, see progress against it for the current cycle, and get warned before it runs out.
3. **Insights / trends** — answer "what changed?" with cycle-over-cycle comparisons and subscription creep alerts.
4. **Global search** — a Cmd+K command palette to jump to any transaction, outgoing, debt, or setting.

## Out of scope for 3.3

- Opening the AI receipt scanner to all users. It remains admin-only and demo-gated via the existing feature flag.
- Offline capture, bank CSV import, and PWA service-worker caching. These are larger releases on their own.

## Success criteria

- Dashboard loads with a single, scannable "safe to spend" figure.
- Budgets page lets users add, edit, and delete per-category targets tied to their cycle type.
- Insights surface at least one actionable comparison (e.g., "Entertainment is up 25% vs last cycle").
- Search opens from any page and navigates to the selected record in one click.
- Every new feature has tests and a changelog entry.
