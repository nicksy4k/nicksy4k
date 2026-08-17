# Add an "Install app" button

Make installing Ledgerly a deliberate action you can trigger any time, instead of relying on the one-time nudge.

## What you'll get

- A reusable **Install app** control that adapts to the device:
  - Android / Chrome / Edge: fires the browser's native install prompt straight away.
  - iPhone / iPad: opens a short sheet with the exact Share → Add to Home Screen steps and the Share icon shown inline.
  - Already installed (running standalone): shows a quiet "Installed" state instead of a dead button.
- Placed in two spots:
  - **Settings → Personalise**, as a small "Install Ledgerly" card explaining the benefits (own icon, full-screen, no address bar).
  - **More sheet** on mobile, as a row at the top so it's reachable in two taps.
- The existing one-time bottom nudge stays, but dismissing it no longer hides installing for good — the button is always there.

## Notes

- Install only works on the published site (itemizedkeeper.co.uk), not inside the Lovable editor preview, so the button explains that when the prompt isn't available.
- Desktop Chrome/Edge will also offer install; the button is not hidden on desktop.

## Technical details

- New `src/lib/pwaInstall.ts`: a `useInstallPrompt()` hook that captures `beforeinstallprompt` at mount, exposes `{ canPrompt, promptInstall, platform, isStandalone }`, and listens for `appinstalled` to flip state.
- New `src/components/InstallAppButton.tsx`: button + iOS instructions dialog, accepts a `variant`/`className` so it can render as a card action or a list row.
- New `src/components/InstallAppCard.tsx` (thin wrapper) rendered in the Personalise tab of `src/routes/settings.tsx`.
- `src/components/MobileNav.tsx`: add the install row to the More sheet.
- `src/components/InstallHint.tsx`: refactor to consume the shared hook so both surfaces share one deferred prompt event.
- Changelog: fold into the v3.0.0 entry (unreleased) rather than a new version.
