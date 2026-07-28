import type { LucideIcon } from "lucide-react";
import { Sparkles, Download, Zap, Rocket, Wallet } from "lucide-react";

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
      rows.push(
        [e.version, e.date, e.title, h].map(csvEscape).join(","),
      );
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
