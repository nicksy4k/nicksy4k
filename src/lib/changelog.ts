import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Download,
  Zap,
  Rocket,
  Wallet,
  MessageSquare,
  UserPlus,
  Heart,
  Palette,
  ScanLine,
  Compass,
  Repeat,
  ShieldCheck,
  Megaphone,
  BarChart3,
  Truck,
  Smartphone,
  Eye,
  HandCoins,
  AlertTriangle,
  CalendarClock,
  FileText,

} from "lucide-react";

export interface ChangelogEntry {
  version: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  icon: LucideIcon;
  highlights: string[];
}

/**
 * Ledgerly changelog — newest first.
 * IMPORTANT: When shipping any user-visible change, prepend a new entry
 * with today's date so the Settings "What's New" card stays accurate.
 */
export const changelog: ChangelogEntry[] = [
  {
    version: "v3.2.1",
    title: "Settle pending transactions from the dashboard",
    date: "2026-08-26",
    icon: FileText,
    highlights: [
      "Pending card transactions now appear in the dashboard's 'Needs your attention' card.",
      "Settle a pending hold directly from the dashboard using the same itemized settlement flow as History.",
      "Pending alerts can be snoozed and stay hidden after refresh using the existing alert preferences.",
    ],
  },
  {
    version: "v3.2.0",
    title: "Link any outgoing to a debt",
    date: "2026-08-26",
    icon: HandCoins,
    highlights: [
      "Outgoings can now be linked to any debt (not just BNPL plans) via a new 'Counts towards a debt' picker in the add/edit form.",
      "Marking a linked outgoing paid logs the repayment against the debt balance automatically — one payment per cycle, and Undo removes just that cycle's payment.",
      "The outgoing's details panel shows which debt it pays down and how much is left, and you're offered to stop the outgoing once the debt is fully repaid.",
    ],
  },
  {

    version: "v3.1.13",
    title: "Demo session log",
    date: "2026-08-25",
    icon: Eye,
    highlights: [
      "Every visit to the shared demo sandbox is now recorded with a timestamp, where the visitor came from and basic device details.",
      "A new admin-only 'Demo session log' card in Settings lists the 25 most recent demo visits.",
    ],
  },
  {

    version: "v3.1.12",
    title: "Dashboard attention card tidy-up",
    date: "2026-08-25",
    icon: AlertTriangle,
    highlights: [
      "Removed the duplicate 'Bill Money' summary from the 'Needs your attention' card so the due-soon total is only shown once.",
      "Mark paid, Mark handled, receipt and snooze buttons are now always visible on tablets and touchscreens, not just on mouse hover.",
    ],
  },
  {
    version: "v3.1.11",
    title: "Snooze or dismiss dashboard alerts",
    date: "2026-08-24",
    icon: AlertTriangle,
    highlights: [
      "Every row in 'Needs your attention' now has a menu to snooze it for 1 day, 3 days or a week, or dismiss it for good.",
      "Your choice is saved to your account, so snoozed alerts stay hidden after a refresh and across devices.",
      "Each toast offers an Undo if you hide something by mistake, and a new due date or offer date brings the alert back.",
    ],
  },
  {
    version: "v3.1.10",
    title: "Action-first dashboard layout",
    date: "2026-08-24",
    icon: AlertTriangle,
    highlights: [
      "The 'Needs your attention' card now sits at the top of the dashboard, above the spending summary and outgoings cards.",
      "Actionable alerts are the first thing you see when you open the app, so nothing urgent gets buried below the fold.",
    ],
  },
  {
    version: "v3.1.9",
    title: "Wider 'Needs your attention' dashboard card",
    date: "2026-08-24",
    icon: AlertTriangle,
    highlights: [
      "The 'Needs your attention' card now spans the full dashboard width on desktop, removing the empty space beside it.",
      "Alerts, due outgoings and expiring offers are laid out in a responsive grid that stays compact on mobile.",
      "Each item is now a small card with hover actions on desktop and a familiar row layout on mobile.",
    ],
  },
  {
    version: "v3.1.8",
    title: "Dashboard Undo now fully reverses a bill payment",
    date: "2026-08-24",
    icon: FileText,
    highlights: [
      "Tapping 'Undo' on the dashboard 'paid' toast now also removes the auto-logged transaction, not just the Bill Money refund.",
      "Stops bills being double-counted in your spending totals.",
    ],
  },
  {
    version: "v3.1.7",
    title: "Shareable loan statements",
    date: "2026-08-19",
    icon: FileText,
    highlights: [
      "Every loan now has a 'Statement' button that produces a printable PDF you can share with the person who owes you.",
      "The statement shows total lent, repaid and outstanding, a running-balance history of every top-up and repayment, and any remaining scheduled payments.",
      "Add an optional message to the statement, or copy a short summary for a quick text message.",
    ],
  },
  {

    version: "v3.1.6",
    title: "Mark a scheduled loan payment as paid",
    date: "2026-08-19",
    icon: HandCoins,
    highlights: [
      "Each instalment in a loan's payment schedule now has a 'Mark paid' action.",
      "Link a repayment you already logged to that instalment — no double counting, and the next due date moves on.",
      "Repayments logged after a plan is set up now count toward it even if they land a day or two before the first due date.",
    ],
  },
  {
    version: "v3.1.5",
    title: "Outgoings due soon on the dashboard",
    date: "2026-08-19",
    icon: CalendarClock,
    highlights: [
      "'Needs your attention' now lists unpaid bills and subscriptions due in the next 7 days.",
      "Rows are colour-coded by Bill Money cover: green fully covered, amber part-covered, red uncovered or overdue.",
      "Tick one to mark it paid using the same confirm step as the Outgoings page, with an Undo in the toast.",
    ],
  },
  {
    version: "v3.1.4",
    title: "Filter History by delivery state",
    date: "2026-08-18",
    icon: Truck,
    highlights: [
      "The History filter now has a Deliveries group: on the way, awaiting dispatch, in transit or delivered.",
      "The 'Track' button on the dashboard alerts card jumps straight to everything still on the way.",
    ],
  },
  {

    version: "v3.1.3",
    title: "One 'Needs your attention' card",
    date: "2026-08-18",
    icon: AlertTriangle,
    highlights: [
      "Deliveries, closing return windows (7 days), expiring warranties (30 days) and ending subscription offers now share a single dashboard card — which stays hidden when there's nothing to act on.",
      "Each alert can still be marked handled, and handled items stay out of the way.",
      "History gained a protections filter (all, active, expiring soon, expired, handled) so you can review every warranty in one place.",
    ],
  },
  {

    version: "v3.1.2",
    title: "Mobile tidy-up: neater spacing and clearer figures",
    date: "2026-08-17",
    icon: Smartphone,
    highlights: [
      "Removed doubled-up page padding on phones so cards use the full width without feeling cramped.",
      "Outgoings summary now shows a clean 2×2 grid of figures, and outgoing rows wrap long names instead of squashing the amount.",
      "Dashboard tiles, credit cards and report filters resize and stack properly on small screens — nothing spills out of its container.",
    ],
  },

  {

    version: "v3.1.1",
    title: "Loan plan fix: correct first payment amount",
    date: "2026-08-17",
    icon: HandCoins,
    highlights: [
      "Repayments logged before a plan's start date no longer count against the first scheduled instalment, so a £50 monthly plan now shows £50 due, not a reduced amount.",
      "The schedule is now built from the balance outstanding when the plan starts, so the number of payments and the projected clear date are accurate.",
    ],
  },

  {
    version: "v3.1.0",
    title: "Repayment plans for money you've lent",
    date: "2026-08-18",
    icon: HandCoins,
    highlights: [
      "Set a repayment plan on any loan: how much each payment is, how often (weekly, fortnightly, every 4 weeks or monthly) and when the first one is due.",
      "Each loan card now shows the next payment, whether it's due, overdue or upcoming, how many payments are left and the date the loan should be fully repaid.",
      "Expand Payment schedule to see every instalment with its date and status — paid, part-paid, due or upcoming.",
      "Logging a repayment prefills the scheduled amount and date, and early or extra payments automatically pull the finish date forward.",
      "Adjust or remove a plan at any time — nothing is locked in, and existing loans can have a plan added retrospectively.",
    ],
  },
  {

    version: "v3.0.0",
    title: "Ledgerly on your home screen",
    date: "2026-08-17",
    icon: Smartphone,
    highlights: [
      "Ledgerly is now installable — add it to your phone's home screen and it opens full-screen with its own app icon, no address bar and no typing the URL.",
      "New bottom tab bar on phones: Home, Outgoings, quick add, History and a More sheet for everything else.",
      "Quick add: tap the centre button to log a spend in seconds (amount, shop, category, source) and itemise it later from History.",
      "Pocket-funded quick adds still record the pocket withdrawal automatically, so balances stay correct.",
      "A one-time hint shows how to install, with the right steps for iPhone and Android.",
      "New Install app button in Settings › Personalise and the mobile More sheet — it triggers the browser install prompt on Android and desktop, and shows the exact Share → Add to Home Screen steps on iPhone.",
    ],
  },
  {
    version: "v2.14.2",
    title: "Faster history, tidier internals",
    date: "2026-08-16",
    icon: Zap,
    highlights: [
      "History now loads 50 transactions at a time with a \u201CLoad more\u201D button, so long ledgers stay quick to open and scroll.",
      "Item price and category suggestions now look at your most recent transactions only, keeping the new-transaction form snappy as your history grows.",
      "The History and Credit pages were split into smaller pieces behind the scenes \u2014 no visible change, but future fixes are safer.",
      "Added tests covering the new suggestion window.",
    ],
  },
  {
    version: "v2.14.1",
    title: "Accurate 4-weekly outgoing totals",
    date: "2026-08-16",
    icon: ShieldCheck,
    highlights: [
      "The 'every cycle' outgoings figure is now cycle-aware: on a 4-weekly cycle there are 13 cycles a year, so monthly bills and annual renewals are spread properly instead of being overstated.",
      "Weekly and fortnightly outgoings are now converted to a per-cycle cost too.",
      "Added test coverage for cycle windows, month-end anchors, due-date rollovers and per-cycle totals.",
      "Codebase-wide formatting and lint clean-up — the project now passes lint with zero errors.",
    ],
  },
  {
    version: "v2.14.0",
    title: "One Outgoings page",
    date: "2026-08-15",
    icon: Repeat,
    highlights: [
      "Commitments and Subscriptions are now a single \u201COutgoings\u201D page with an All / Subscriptions / Bills toggle.",
      "Summary cards condensed into one row \u2014 bills, subscriptions, total and left to pay \u2014 with the cycle dates and \u201Cevery cycle\u201D figure tucked into a compact strip.",
      "One add/edit form for both types, with a switch to turn any row into a subscription (and back).",
      "The old /subscriptions link still works \u2014 it opens the Subscriptions view.",
    ],
  },
  {
    version: "v2.13.3",
    title: "Early BNPL payments land in the right cycle",
    date: "2026-08-15",
    icon: Wallet,
    highlights: [
      "Paying a BNPL installment now defaults to today\u2019s date instead of the scheduled installment date, so early payments reduce your Main Balance straight away.",
      "The scheduled date is still shown, with one tap to use it if you\u2019re back-filling.",
      "A warning appears if you pick a future date, explaining it won\u2019t affect your balance until that cycle.",
    ],
  },

  {
    version: "v2.13.2",
    title: "Clearer commitment totals",
    date: "2026-08-13",
    icon: Wallet,
    highlights: [
      "Cycle totals now include bills you\u2019ve already paid, so the three cycle cards show your full budget footprint instead of dropping paid rows.",
      "\u201CTotal outgoings\u201D gains a paid vs remaining breakdown.",
      "\u201CEvery cycle (all tracked)\u201D moved out of the active-cycle row so it reads Commitments + Subscriptions = Total \u2192 Left to pay.",
      "Colour coding: the amount left to pay turns red while money is outstanding and green once you\u2019re covered.",
    ],
  },
  {
    version: "v2.13.1",
    title: "Subscription payment safety net",
    date: "2026-08-13",
    icon: Repeat,
    highlights: [
      "Marking a subscription as paid now opens the same \u201CConfirm payment reset?\u201D step used on Commitments \u2014 no more silent +28 day jumps.",
      "Choose +1 month, +4 weeks, +1 year for annual plans, or pick an exact renewal date; nothing moves unless you confirm.",
      "Fixed long subscription names, notes and offer badges spilling outside their cards and dialogs.",
    ],
  },
  {
    version: "v2.13.0",
    title: "Delivery & order tracking",
    date: "2026-08-12",
    icon: Truck,
    highlights: [
      "New \u201CExpecting delivery\u201D switch when logging a transaction, with optional courier and tracking number.",
      "History shows colour-coded delivery badges (Awaiting Dispatch, In Transit, Delivered) and a one-tap \u201CMark delivered\u201D button.",
      "Courier and tracking details can be added or corrected later from the Edit transaction dialog.",
      "Dashboard shows a compact \u201COut for delivery\u201D counter — and hides itself entirely when nothing is on the way.",
    ],
  },
  {
    version: "v2.12.10",
    title: "Changelog PDF fix & tidier sign-in page",
    date: "2026-08-11",
    icon: Sparkles,
    highlights: [
      "Print / PDF export of the changelog no longer produces a blank page — it now renders a proper formatted document from anywhere in the app.",
      "Legal and copyright notices moved to the very bottom of the sign-in page.",
    ],
  },
  {
    version: "v2.12.9",
    title: "Analytics tracking fix",
    date: "2026-08-11",
    icon: BarChart3,
    highlights: [
      "Fixed a bug that stopped opt-in analytics from recording anything: page views now register properly.",
    ],
  },
  {
    version: "v2.12.8",
    title: "Opt-in usage analytics",
    date: "2026-08-10",
    icon: BarChart3,
    highlights: [
      "Google Analytics is now available, but strictly opt-in — nothing loads unless you accept the new consent prompt.",
      "Turn it on or off any time from Settings › Personalise.",
      "Only page views and a few product events are recorded — never amounts, item names or anything you've typed.",
      "Privacy Policy and Cookie Notice updated to describe exactly what analytics does.",
    ],
  },
  {
    version: "v2.12.7",
    title: "Announcement banner",
    date: "2026-08-09",
    icon: Megaphone,
    highlights: [
      "Admins can now post a site-wide notice from Settings › Admin — switch it on or off, edit the text and pick an Info, Warning or Critical style.",
      "The notice appears at the top of the dashboard and on the sign-in page, and can be dismissed for the rest of the session.",
    ],
  },
  {
    version: "v2.12.6",
    title: "Legal links work when signed out",
    date: "2026-08-08",
    icon: ShieldCheck,
    highlights: [
      "Privacy Policy, Beta Disclaimer, Cookie Notice and Changelog now open properly from the sign-in page instead of bouncing back to the login screen.",
    ],
  },
  {
    version: "v2.12.5",
    title: "Cookie notice & legal access",
    date: "2026-08-08",
    icon: ShieldCheck,
    highlights: [
      "New Cookie & Analytics Notice page explaining exactly what's kept in your browser, and how to clear it.",
      "Privacy Policy, Beta Disclaimer and Cookie Notice are now linked from the app footer and the sidebar, not just Settings.",
      "Copyright notices added across the app, sign-in page and legal pages.",
    ],
  },
  {
    version: "v2.12.4",
    title: "Proper legal pages",
    date: "2026-08-08",
    icon: ShieldCheck,
    highlights: [
      "The Privacy Policy is now a full document — what's collected, where it lives, who can reach it, how long it's kept, and how to export or delete it.",
      "The Beta Disclaimer spells out accuracy limits, what may change during beta, backup advice and liability.",
      "Both pages are linked from Settings and cross-link to each other, with the 'placeholder' labels removed.",
    ],
  },
  {
    version: "v2.12.3",
    title: "Full recurring outgoings",
    date: "2026-08-07",
    icon: Wallet,
    highlights: [
      "New 'Every cycle (all tracked)' figure on Commitments and Subscriptions — every bill and subscription you track, whether or not it's due in the current window.",
      "Annual subscriptions are spread over 12 so one big renewal doesn't distort the typical cycle.",
      "The Dashboard outgoings card now shows your typical per-cycle spend alongside what's due and unpaid.",
    ],
  },
  {
    version: "v2.12.2",
    title: "Total outgoings per cycle",
    date: "2026-08-07",
    icon: Wallet,
    highlights: [
      "Commitments now shows a single Total outgoings this cycle figure — bills plus subscriptions — alongside what's left to pay.",
      "The same total is mirrored on the Subscriptions page and summarised on the Dashboard.",
      "Cycle figures are now all scoped to the active cycle window, so the numbers add up.",
    ],
  },
  {
    version: "v2.12.1",
    title: "Move existing bills into Subscriptions",
    date: "2026-08-07",
    icon: Repeat,
    highlights: [
      "Commitments that look like subscriptions now get a prompt at the top of the Commitments page — tick the ones you want and move them across in one go.",
      "Any commitment can be moved to Subscriptions (and back again) from its details panel.",
      "Moving a row keeps its amount, due date and paid state, so your cycle totals and Bill Money shortfall don't change.",
    ],
  },
  {
    version: "v2.12.0",
    title: "Subscriptions tracker",
    date: "2026-08-06",
    icon: Repeat,
    highlights: [
      "New Subscriptions page: track recurring charges, renewal dates, categories and monthly or annual billing.",
      "Subscriptions are paid from the same Bill Money pocket as your commitments, so your outgoings total stays as one number.",
      "Record discounted offer prices with the date they end and the price you'll revert to.",
      "You get a reminder a few days before an offer ends — log a new offer, snooze it, or let it renew at full price. If you do nothing, the price updates automatically on the end date.",
    ],
  },
  {
    version: "v2.11.2",
    title: "Pocket-funded loans balance properly",
    date: "2026-08-06",
    icon: Wallet,
    highlights: [
      "Fixed: funding a loan, top-up or debt payment from a pocket only logged the pocket withdrawal, leaving the main balance overstated and nothing in your transactions list.",
      "These now record the outgoing transaction too, tagged with the pocket it came from, so the main balance nets out correctly.",
      "Loan repayments paid into a pocket now record the incoming money as well, so the main balance no longer dips.",
    ],
  },
  {
    version: "v2.11.1",
    title: "Demo dashboard lights up",
    date: "2026-08-05",
    icon: Compass,
    highlights: [
      "Demo sample data is now dated relative to today and always lands inside the active cycle, so the dashboard KPIs populate straight away.",
      "Demo commitments are due within the current week — one already paid, one coming up.",
      "Starting a demo clears any cached settings and data from a previous session for a clean first load.",
    ],
  },
  {
    version: "v2.11.0",
    title: "Demo mode",
    date: "2026-08-06",
    icon: Compass,
    highlights: [
      'New "View Demo Account" button on the sign-in page — explore Ledgerly instantly with realistic sample data.',
      "The demo sandbox is re-seeded on every visit with pockets, income, transactions and commitments.",
      'A clear "Demo sandbox" banner appears while you\'re in the demo, and app settings stay locked.',
      "Admins get a new Admin tab with a kill switch for AI scanner access in the demo (off by default).",
    ],
  },
  {
    version: "v2.10.0",
    title: "AI receipt scanner (early preview)",
    date: "2026-08-05",
    icon: ScanLine,
    highlights: [
      "Upload a photo or PDF of a receipt and have the retailer, date, total and every line item filled in for you.",
      "Review sheet lets you tick, rename, re-price or drop any detected line before it touches your ledger.",
      'Automatic "items vs receipt total" check flags anything the scan missed or double-counted.',
      "The uploaded receipt is attached to the transaction automatically — no second upload.",
      "Limited preview: currently enabled on admin accounts only while we test accuracy and running costs.",
    ],
  },
  {
    version: "v2.9.3",
    title: "Safer, faster transaction entry",
    date: "2026-08-04",
    icon: Sparkles,
    highlights: [
      "Undo when you remove an item row — one tap in the toast restores it in place, on both New transaction and the History edit/settle dialog.",
      "Inline validation highlights the exact field to fix (item name, price, retailer, estimate, dates) instead of a generic error.",
      "New keyboard shortcuts help — press ? or use the Shortcuts button on the transaction form and History dialogs.",
    ],
  },

  {
    version: "v2.9.2",
    title: "New theme: Bubblegum Pink",
    date: "2026-08-02",
    icon: Palette,
    highlights: [
      "Added a fifth theme preset — Bubblegum Pink: light candy-pink surfaces with punchy hot-pink accents, borders and focus rings.",
      "Soft Blush stays as the deep plum option, so you can pick dark or light pink.",
      "Pick either from Settings → Personalise → Theme.",
    ],
  },

  {
    version: "v2.9.1",
    title: "Bubblegum blush & a working fun roll-up",
    date: "2026-08-02",
    icon: Palette,
    highlights: [
      "The Blush theme is now unapologetically hot pink — vivid accents, pink-tinted surfaces and borders, with text contrast kept comfortably readable.",
      "Joy / planned fun categories now genuinely collapse into a single 'Planned fun' slice in the dashboard chart and legend instead of being listed one by one.",
      "The same roll-up applies on Reports, and hiding the category chart in Settings → Personalise now hides it there too.",
    ],
  },

  {
    version: "v2.9.0",
    title: "Make it yours: currency, themes & comfort",
    date: "2026-08-01",
    icon: Palette,
    highlights: [
      "New Settings → Personalise tab: pick your currency (GBP, USD, EUR, ZAR, CAD, AUD and more) or set a custom symbol and position — every amount in the app reformats instantly.",
      "Theme presets: Midnight Indigo (now softer), Blush, Muted Slate and Daylight, applied before the page paints so there's no flash.",
      "Comfort controls: blur amounts for privacy, hide the category pie chart, and flag 'joy' categories so planned fun rolls up as one guilt-free line.",
      "Friendlier dashboard wording with honest, encouraging summaries instead of judgemental ones.",
    ],
  },
  {
    version: "v2.8.3",
    title: "Donation links updated",
    date: "2026-07-31",
    icon: Heart,
    highlights: [
      "Buy Me a Monster and Support on Ko-fi buttons now point to the official Itemized Keeper pages: buymeacoffee.com/itemizedkeeper and ko-fi.com/itemizedkeeper.",
    ],
  },
  {
    version: "v2.8.2",
    title: "About Ledgerly & support the build",
    date: "2026-07-31",
    icon: Heart,
    highlights: [
      'New "The Story Behind Ledgerly" section on the landing page explaining why the app exists and how it\'s built.',
      "Condensed version of the story added to Settings › About.",
      'New "Buy the Dev a Monster" support card with Buy Me a Coffee and Ko-fi links, for anyone who wants to chip in towards hosting costs.',
    ],
  },
  {
    version: "v2.8.1",
    title: "Keyboard-first transaction entry",
    date: "2026-07-30",
    icon: Zap,
    highlights: [
      "Retailer and item name fields are now proper text boxes you can type straight into — the suggestion list no longer pops open on its own.",
      "Adding an item focuses the new name field silently and scrolls it into view.",
      "Enter chaining: name → price → next item, so a whole receipt can be entered without touching the mouse.",
      "Arrow keys browse suggestions, Esc closes the list, Tab keeps whatever you typed, and ⌘/Ctrl + Enter saves the transaction or the edit/settle dialog.",
      "Accessibility polish: labelled remove buttons, visible focus rings, and proper combobox roles.",
    ],
  },
  {
    version: "v2.8.0",
    title: "New beta signup flow",
    date: "2026-07-29",
    icon: UserPlus,
    highlights: [
      "Redesigned signup form collects name, display name, country, and preferred currency so the app can be personalised from day one.",
      "Required checkboxes for the Privacy Policy and Beta Disclaimer — with new placeholder pages at /privacy and /beta-disclaimer that spell out what data is stored and why beta testers should avoid real financial data.",
      "New profiles table stores your details securely with row-level security; automatically created for both email/password and Google sign-ups.",
    ],
  },
  {
    version: "v2.7.0",
    title: "In-app feedback form for beta testers",
    date: "2026-07-29",
    icon: MessageSquare,
    highlights: [
      "New feedback dialog replaces mailto links — pick bug / idea / general, add severity for bugs, and attach a screenshot or PDF (up to 5 MB).",
      "Submissions are saved securely to a private feedback table with row-level security; only the developer can read them.",
      "Auto-captures app version, current page, and browser info so bug reports include useful context without extra typing.",
      "Signed-out visitors on the login page can send feedback too — the form pre-fills your account email when you're signed in.",
    ],
  },
  {
    version: "v2.6.2",
    title: "MCP can see your main balance",
    date: "2026-07-28",
    icon: Wallet,
    highlights: [
      "MCP: list_incomes — assistants can now read your income entries (including cycle carryover).",
      "MCP: get_active_cycle — exposes the current cycle window so assistants filter by the same dates the dashboard uses.",
      "MCP: get_main_balance — computes 'Left to Spend' exactly like the dashboard (income − main expenses − net savings), with a full breakdown so Claude/ChatGPT can explain the number.",
    ],
  },
  {
    version: "v2.6.1",
    title: "More MCP write tools",
    date: "2026-07-28",
    icon: Zap,
    highlights: [
      "MCP: add_items_to_transaction — assistants can append line items to an existing (typically pending) transaction and optionally settle it.",
      "MCP: mark_commitment_paid — assistants can tick off a bill/subscription/BNPL installment for the current cycle.",
      "MCP: create_transaction now supports payment_splits so assistants can record split payments too.",
    ],
  },
  {
    version: "v2.6.0",
    title: "Agent integrations (MCP)",
    date: "2026-07-28",
    icon: Zap,
    highlights: [
      "Ledgerly now exposes an MCP server so AI assistants (ChatGPT, Claude, Codex, Cursor) can act as you.",
      "Sign-in via Supabase OAuth 2.1 with a proper consent screen — no pasting tokens, no admin bypass.",
      "Five starter tools: list transactions, list commitments, list savings pockets, list categories, and log a new transaction. All scoped to your account via RLS.",
      "Google/email sign-in now preserves your intended destination so the OAuth handshake resumes cleanly after login.",
    ],
  },
  {
    version: "v2.5.0",
    title: "Dedicated About tab",
    date: "2026-07-28",
    icon: Sparkles,
    highlights: [
      "New About tab in Settings — app identity, What's New, changelog, privacy, feedback, roadmap, and credits in one place.",
      "Data tab is now purely for account operations: download my data, quick JSON snapshot, and clear all data.",
      "Version pill in the Settings header now jumps straight to the About tab (deep-linkable via #about).",
      "Split feedback into three quick actions: report a bug, share an idea, or send general feedback.",
      "Added a public roadmap teaser so beta testers can see what's being considered next.",
    ],
  },
  {
    version: "v2.4.0",
    title: "Changelog upgrades",
    date: "2026-07-28",
    icon: Sparkles,
    highlights: [
      '"What\'s New" summary card at the top of the About tab.',
      "Version badge and last-updated date in the Settings header.",
      "Dedicated /changelog page — desktop opens a modal, mobile navigates full-screen for easier scrolling.",
      "Export the changelog as CSV or print-ready PDF.",
    ],
  },

  {
    version: "v2.3.0",
    title: "Mobile & Reports polish",
    date: "2026-07-28",
    icon: Sparkles,
    highlights: [
      "Mobile side menu now auto-closes after tapping a link.",
      "Reports export: choose Summary (one row per transaction) or Itemized for both PDF print and .xlsx.",
      "Search in History highlights matches and shows a running total for matched items.",
    ],
  },
  {
    version: "v2.2.0",
    title: "Beta launch kit",
    date: "2026-07-24",
    icon: Download,
    highlights: [
      "New Reports & Analytics page with date/category filters, KPIs and a spend-by-category chart.",
      "Print-ready PDF report and .xlsx spreadsheet export (Transactions, Income, Summary).",
      '"Download my data" — ZIP of every record plus attached receipts.',
      "Privacy & security dialog explaining RLS and private storage in plain language.",
      "Beta badge, disclaimer footer and one-tap feedback link on the login page.",
    ],
  },
  {
    version: "v2.1.0",
    title: "Smarter transactions",
    date: "2026-07-18",
    icon: Zap,
    highlights: [
      "Refunds — process full or partial refunds against any past transaction; refunds post as positive income.",
      "Quick Add grids on New Spend and History for one-tap re-entry of frequent items.",
      "Historical auto-fill: picking a known item pre-fills its last price and category.",
      "Pending / placeholder transactions with amber badges and a Settle flow.",
      "Bi-directional BNPL ↔ Commitment sync — paying one now marks the other.",
      "Google sign-in, guided setup wizard and interactive tutorial.",
    ],
  },
  {
    version: "v2.0.0",
    title: "Midnight Indigo UI refresh",
    date: "2026-07-10",
    icon: Rocket,
    highlights: [
      "Midnight Indigo visual refresh across the entire app.",
      "Smart Suggestion Cleanup wizard for retailers and item names.",
      "Cleaner navigation, dashboard hero, and tabbed settings.",
    ],
  },
  {
    version: "v1.9.0",
    title: "Dynamic Income Routing",
    date: "2026-07-02",
    icon: Wallet,
    highlights: [
      "Dynamic income routing with inline pocket creation.",
      "Automatic remainder calculation for the main balance.",
      "Recurring income support for upcoming paychecks.",
    ],
  },
  {
    version: "v1.8.0",
    title: "BNPL Engine & Cross-Tab Sync",
    date: "2026-06-20",
    icon: Zap,
    highlights: [
      "Full BNPL / debt tracking with installment plans.",
      "Cross-tab synchronization between debts and commitments.",
      "Split payment support across pockets and BNPL plans.",
    ],
  },
];

export const currentVersion = changelog[0].version;
export const currentVersionDate = changelog[0].date;

const LAST_SEEN_KEY = "ledgerly:changelog:lastSeen";

export function getLastSeenVersion(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SEEN_KEY);
}

export function markChangelogSeen(version: string = currentVersion) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, version);
}

/** True when the newest entry is unseen. */
export function hasUnseenChanges(): boolean {
  const seen = getLastSeenVersion();
  return seen !== currentVersion;
}

/* ---------- Exports ---------- */

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function changelogToCsv(): string {
  const header = ["Version", "Date", "Title", "Highlight"].join(",");
  const rows: string[] = [header];
  for (const e of changelog) {
    for (const h of e.highlights) {
      rows.push([e.version, e.date, e.title, h].map(csvEscape).join(","));
    }
  }
  return rows.join("\n");
}

export function downloadChangelogCsv() {
  if (typeof window === "undefined") return;
  const blob = new Blob([changelogToCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledgerly-changelog-${currentVersion}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the changelog into a hidden iframe and prints that document.
 * Self-contained so it works from anywhere (dialog, settings, /changelog).
 */
export function printChangelog() {
  if (typeof window === "undefined") return;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const body = changelog
    .map(
      (e) => `<section>
        <h2>${escapeHtml(e.version)} — ${escapeHtml(e.title)} <span class="muted">(${fmt(e.date)})</span></h2>
        <ul>${e.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
      </section>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Ledgerly changelog ${escapeHtml(currentVersion)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:#111; font-size:11pt; }
      h1 { font-size: 18pt; margin: 0 0 2px; }
      h2 { font-size: 12pt; margin: 14px 0 4px; page-break-after: avoid; }
      .muted { font-weight: 400; color: #666; }
      header { border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; }
      header p { margin: 2px 0; color: #444; font-size: 10pt; }
      ul { margin: 0 0 0 18px; padding: 0; }
      li { margin: 2px 0; }
      section { page-break-inside: avoid; }
    </style></head>
    <body>
      <header>
        <h1>Ledgerly changelog</h1>
        <p>${escapeHtml(currentVersion)} · Updated ${fmt(currentVersionDate)}</p>
        <p class="muted">Generated ${new Date().toLocaleString("en-GB")}</p>
      </header>
      ${body}
    </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}
