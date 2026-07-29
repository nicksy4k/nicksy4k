## Beta feedback form → your inbox

Replace the current `mailto:` flow with a proper in-app form that submits server-side and sends a formatted email to `nicksy4k@gmail.com` — plus stores submissions in the database so nothing gets lost if email delivery hiccups.

### Prerequisites (one-time, you do this)

Sending real email from the app requires a sender domain you own. You already own `itemizedkeeper.co.uk`, so we'll delegate a subdomain (e.g. `notify.itemizedkeeper.co.uk`) to Lovable Emails. When we start, I'll open the email setup dialog — you follow the DNS steps once, and after that the form works end-to-end. Until DNS verifies, submissions still save to the database so nothing is lost.

### What gets built

**1. Database + storage**
- New `feedback` table: `id`, `user_id` (nullable — login page allows anonymous), `type` (bug/idea/general), `severity` (low/med/high, only for bugs), `subject`, `message`, `email` (for anonymous submissions), `app_version`, `route`, `user_agent`, `attachment_path`, `created_at`, `email_sent`, `email_sent_at`.
- RLS: users can insert their own rows; anonymous inserts allowed with rate limit via a check; only service role can read (so testers can't see each other's feedback).
- New private storage bucket `feedback-attachments` (5 MB limit, images + PDFs); path scoped by user id / anon session.

**2. Feedback form component** — `src/components/FeedbackDialog.tsx`
- Type selector (Bug / Idea / General), severity (shown only for Bug), subject, message, optional screenshot/file attachment (drag-drop + click).
- Auto-collects and displays app version, current route, and signed-in email (read-only preview so testers see exactly what's shared).
- Client-side validation with `zod` (subject 3–120 chars, message 10–4000 chars, file ≤ 5 MB, mime allowlist).
- Success/error toast; disables submit while sending.

**3. Wiring existing entry points**
- Replace `mailto:` in the header/footer/settings Feedback buttons with a trigger that opens `FeedbackDialog`.
- Add a Feedback button to the login page (`src/routes/auth.tsx`) that opens the same dialog in anonymous mode (requires manual email field).
- Keep `src/lib/support.ts` around but repurpose `buildFeedbackMailto` as a fallback link inside the dialog ("or email us directly").

**4. Server endpoint** — `POST /api/feedback` (TSS route)
- Validates input with `zod` server-side.
- Inserts row into `feedback`.
- Enqueues a Lovable email to `nicksy4k@gmail.com` with:
  - Subject: `[Ledgerly Beta] {type}{severity?} — {subject}`
  - React Email template rendering all fields, attachment link (signed URL, 7-day expiry), reply-to = tester's email so you can reply directly.
- Marks `email_sent = true` on success; returns 200 either way (submission is saved even if email step fails, so you can retry from the DB).
- Rate limit: max 5 submissions / 10 min per user or IP (simple check against `feedback` timestamps).

**5. Email infrastructure**
- Run email domain setup, then `setup_email_infra`, then `scaffold_transactional_email`.
- Add a `feedback-notification.tsx` React Email template in `src/lib/email-templates/` styled to match Ledgerly (Midnight Indigo).

**6. Changelog**
- Prepend `v2.6.3` entry to `src/lib/changelog.ts` covering the new in-app feedback form.

### Technical notes
- `attachment_path` stored as bucket key; server generates a fresh signed URL when composing the email so the link in your inbox stays clean.
- Anonymous submissions from the login page: server uses the publishable-key client to insert (RLS allows anon insert with `user_id IS NULL AND email IS NOT NULL`), then the transactional send route runs internally with service-role credentials (same pattern documented for contact-form triggers).
- No changes to existing MCP tools, cycle logic, or transaction flows.

### Out of scope
- Admin UI to browse submissions in-app (you'll read them from your inbox or the DB for now — happy to add a `/admin/feedback` page later if useful).
- Marketing/newsletter capability.
