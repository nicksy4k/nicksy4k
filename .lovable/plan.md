Add a "Send feedback" button inside the About card on the Settings > Data tab that opens the user's default email client with a pre-filled message to nicksy4k@gmail.com.

## What will change
- File: `src/routes/settings.tsx`
- Insert a new button or link in the About card content, styled with the existing Midnight Indigo tokens (primary/15 background, primary text, rounded-lg).
- Use a `mailto:nicksy4k@gmail.com?subject=Ledgerly%20Feedback` URL so it opens the user's default mail app.

## Design details
- Position: directly under the developer credit card, above the changelog.
- Icon: `MessageSquare` or `Mail` from `lucide-react`.
- Label: "Send feedback".
- External-link behavior: open in a new context via `target="_blank" rel="noopener noreferrer"` is not needed for mailto; a simple `<a>` with `href` is sufficient.
- Use the same compact card style as the developer credit block (`bg-muted/30 border-border/60`).

## Verification
- Run `bun run build` to confirm no type or import errors.
- Optionally take a Playwright screenshot of the Settings > Data tab to confirm the button renders in the About section.