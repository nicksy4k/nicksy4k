export const FEEDBACK_EMAIL = "nicksy4k@gmail.com";
export const APP_VERSION = "v2.0.0-beta";

export function buildFeedbackMailto(opts?: { subject?: string; kind?: "bug" | "idea" | "general" }) {
  const kind = opts?.kind ?? "general";
  const subject = opts?.subject ?? `Ledgerly Beta feedback${kind !== "general" ? ` — ${kind}` : ""}`;
  const body = [
    `App version: ${APP_VERSION}`,
    `Page: ${typeof window !== "undefined" ? window.location.pathname : "(unknown)"}`,
    `Date: ${new Date().toISOString()}`,
    "",
    "What happened / what did you try?",
    "",
    "",
    "What did you expect?",
    "",
    "",
    "Anything else (screenshots, steps to reproduce)?",
    "",
    "",
    "— Thanks for helping shape Ledgerly!",
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
