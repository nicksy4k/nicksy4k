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

export function printChangelog() {
  if (typeof window !== "undefined") window.print();
}
