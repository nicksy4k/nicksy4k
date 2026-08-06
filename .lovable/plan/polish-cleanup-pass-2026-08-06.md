Polish & cleanup pass

Goal: get the codebase back to a clean lint/test baseline, then confirm the app still renders correctly.

Plan

1. Run `bun run format` to auto-fix every Prettier/prettier error reported by `bun run lint`.
2. Re-run `bun run lint` to confirm zero errors/warnings.
3. Re-run `bun run test` to confirm no regressions from the formatting changes.
4. Smoke-test the live preview on the dashboard and settings pages to catch any visual drift.
5. After cleanup is approved, the next feature candidate is a subscriptions tracker (separate plan).

Notes

- The only failing check is `lint` (Prettier formatting errors across files such as `AdminDemoCard.tsx`, `AppLayout.tsx`, `ChangelogDialog.tsx`, `ChangelogList.tsx`, `ConnectedAccountsCard.tsx`, etc.).
- Tests currently pass: 39/39.
- No functional code changes are intended in this pass; only formatting.
