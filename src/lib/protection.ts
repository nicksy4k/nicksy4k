import { addDays, addYears, differenceInCalendarDays, parseISO } from "date-fns";

export type ProtectionType = "Return Window" | "Warranty";

export const PROTECTION_TYPES: ProtectionType[] = ["Return Window", "Warranty"];

export const PROTECTION_DURATIONS = [
  "14 Days",
  "30 Days",
  "90 Days",
  "1 Year",
  "2 Years",
  "Custom Date",
] as const;

export type ProtectionDuration = (typeof PROTECTION_DURATIONS)[number];

/** Returns ISO date (yyyy-mm-dd) for transactionDate + duration, or null for Custom Date. */
export function computeExpiration(
  transactionDate: string,
  duration: ProtectionDuration,
): string | null {
  if (!transactionDate) return null;
  const base = parseISO(transactionDate);
  let result: Date;
  switch (duration) {
    case "14 Days": result = addDays(base, 14); break;
    case "30 Days": result = addDays(base, 30); break;
    case "90 Days": result = addDays(base, 90); break;
    case "1 Year": result = addYears(base, 1); break;
    case "2 Years": result = addYears(base, 2); break;
    case "Custom Date": return null;
  }
  return result.toISOString().slice(0, 10);
}

export type ProtectionStatus = "ok" | "warn" | "expired";

export function protectionStatus(
  type: ProtectionType,
  expirationDate: string,
  now: Date = new Date(),
): { status: ProtectionStatus; daysLeft: number } {
  const days = differenceInCalendarDays(parseISO(expirationDate), now);
  if (days < 0) return { status: "expired", daysLeft: days };
  const warnThreshold = type === "Warranty" ? 30 : 7;
  if (days < warnThreshold) return { status: "warn", daysLeft: days };
  return { status: "ok", daysLeft: days };
}
