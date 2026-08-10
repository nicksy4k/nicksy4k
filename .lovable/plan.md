# Google Analytics: connect, track, and stay honest about it

Current state, verified: there is **no** Google Analytics in the app — no gtag script, no measurement ID, no tracking code anywhere in `src/`. A Google Analytics connection ("Nick's Google Analytics") exists in your workspace but is **not linked to this project**, so no measurement ID reaches the app. So: not set up yet, nothing is being measured.

Also worth knowing: Lovable already gives you basic visitor analytics for the published site with no setup. GA is the right call if you want events and funnels, which is what you picked.

## 1. Link the connection

Link the existing Google Analytics connection to this project. That injects the measurement ID as a browser-readable env var, no secrets in code.

## 2. Consent-gated tracking

Nothing loads until the visitor agrees.

- A small cookie/analytics consent bar appears bottom of screen for anyone who hasn't chosen yet: short sentence, "Accept" and "Decline", and a link to the Cookie Notice.
- Choice stored locally and remembered. Declining means the GA script is never injected at all — not just "consent mode off".
- A matching "Analytics" toggle in Settings › Personalise so the choice can be changed later.
- Styling matches the existing announcement banner so it doesn't look bolted on.

## 3. What gets tracked

Page views on every route change (the app is client-routed, so this needs wiring by hand), plus these events:

- `sign_up` — new account created
- `login` — sign-in, with method (email / Google / demo)
- `transaction_added`
- `receipt_scan`
- `feedback_sent`
- `setup_completed` — setup wizard finished

Events carry no amounts, no names, no email addresses — just the fact that the thing happened. GA is configured with IP anonymisation and no ad personalisation signals.

Demo-account sessions are tagged so you can filter them out of your reports.

## 4. Update the legal pages (required)

Three places currently state the app runs no third-party analytics. Those become inaccurate the moment GA goes live, so they're rewritten:

- **Cookie Notice** — section 4 rewritten to describe Google Analytics: what it measures, that it's opt-in, that it sets its own cookies, how to withdraw consent. A new row in "what's stored" for the consent choice and GA's cookies.
- **Privacy Policy** — analytics line replaced; Google added to the third-party services list with a link to Google's privacy terms.
- **Privacy details dialog** (shown at sign-up) — same correction.

## Technical notes

- New `src/lib/analytics.ts`: reads `VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY` via `import.meta.env`, injects gtag.js only after consent, exposes `trackEvent()` and `trackPageView()`. No-ops safely when the ID is absent or consent is declined, so the app never breaks.
- Route-change page views hooked in `src/routes/__root.tsx` via a router subscription.
- New `src/components/ConsentBanner.tsx`, mounted once in the root shell; consent state in a small hook alongside the existing preferences helpers.
- Frontend only — no schema, RLS, or server-function changes. GA's Data API is not used.

## Changelog

Prepend a dated v2.12.8 entry covering opt-in analytics, the consent banner, the Settings toggle, and the updated legal pages.
