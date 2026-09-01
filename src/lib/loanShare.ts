/**
 * Pure helpers for shareable loan-statement links. No React, no Supabase —
 * safe to import from server functions, the public route and tests.
 */

export type LoanShareRecord = {
  token: string;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type ShareState = "active" | "revoked" | "expired";

/** Expiry choices offered in the UI, in days (0 = never expires). */
export const SHARE_EXPIRY_OPTIONS = [
  { value: "0", label: "Never expires", days: 0 },
  { value: "7", label: "Expires in 7 days", days: 7 },
  { value: "30", label: "Expires in 30 days", days: 30 },
] as const;

export function shareState(share: LoanShareRecord, now: Date = new Date()): ShareState {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

export function isShareUsable(share: LoanShareRecord, now: Date = new Date()): boolean {
  return shareState(share, now) === "active";
}

/** Full URL for a share token. `origin` has no trailing slash. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/s/${token}`;
}

/** Human label for the link's expiry, e.g. "Expires 14 Sep 2026". */
export function expiryLabel(share: LoanShareRecord): string {
  if (!share.expires_at) return "Never expires";
  const d = new Date(share.expires_at);
  return `Expires ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** ISO timestamp `days` from `from`, or null when days <= 0. */
export function expiryFromDays(days: number, from: Date = new Date()): string | null {
  if (!days || days <= 0) return null;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** URL-safe, unguessable token. Uses Web Crypto (available on the Worker). */
export function generateShareToken(length = 28): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}

export function isValidTokenShape(token: string): boolean {
  return /^[a-z0-9]{16,64}$/.test(token);
}
