Update `src/routes/auth.tsx` to set beta-tester expectations with a small badge and a legal/privacy footer.

## Changes

1. **Beta badge**
   - Import the existing `Badge` component from `src/components/ui/badge.tsx`.
   - Add a compact "Beta" badge next to the "Ledgerly" logo/title in the top header.
   - Keep it subtle: use the outline variant and small text so it does not compete with the logo.

2. **Legal & privacy footer**
   - Add a small, muted text block beneath the login card on the right column.
   - Use `text-xs` and `text-muted-foreground` for a professional legal footer look.
   - Include two sections:
     - **Beta disclaimer:** exact copy provided — "Ledgerly is currently in Beta. Disclaimer: This app is a personal tracking tool and should not be relied upon for absolute accuracy or as a professional financial manager. All data and calculations rely entirely on manual user input."
     - **Privacy & security:** a review-safe version of the provided text — "Privacy & Security: Your financial records are secured with Row Level Security (RLS) and encrypted storage, so they are only accessible to you." (This avoids the absolute "100% secure" and "completely unreadable" claims.)

3. **Layout check**
   - Ensure the footer block respects the existing responsive grid and column spacing.
   - Verify the badge does not cause the header to wrap awkwardly on mobile.

## Files to edit
- `src/routes/auth.tsx`
- No new files required.