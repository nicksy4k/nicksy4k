// ============================================================================
// Google Analytics — strictly opt-in.
//
// Nothing loads until the visitor accepts. Declining means the gtag.js script
// is never injected at all (not merely "consent mode denied"). Every helper
// here no-ops safely when the measurement ID is missing or consent isn't
// granted, so the app never depends on analytics being available.
// ============================================================================

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ledgerly.analytics-consent";

export type ConsentChoice = "granted" | "denied" | "unset";

const MEASUREMENT_ID = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"] as
  | string
  | undefined;

export const analyticsAvailable = Boolean(MEASUREMENT_ID);

// ---------- tiny external store ----------

let consent: ConsentChoice = "unset";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readStored(): ConsentChoice {
  if (typeof window === "undefined") return "unset";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : "unset";
  } catch {
    return "unset";
  }
}

let hydrated = false;

/** Called once on the client to pick up a previously saved choice. */
export function hydrateConsent() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  consent = readStored();
  if (consent === "granted") loadGtag();
  emit();
}

export function setConsent(choice: Exclude<ConsentChoice, "unset">) {
  consent = choice;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
  if (choice === "granted") {
    loadGtag();
  } else if (typeof window !== "undefined" && MEASUREMENT_ID) {
    // If the script was already injected earlier in this session, GA's own
    // opt-out flag stops any further collection.
    (window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = true;
  }
  emit();
}

export function useAnalyticsConsent() {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => consent,
    () => "unset" as ConsentChoice,
  );
  const set = useCallback((choice: Exclude<ConsentChoice, "unset">) => setConsent(choice), []);
  return { consent: value, setConsent: set, available: analyticsAvailable };
}

// ---------- gtag.js ----------

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let scriptLoaded = false;

/**
 * gtag.js only understands `arguments` objects pushed onto dataLayer — a plain
 * array is ignored, which silently drops every config/event. Hence the
 * old-school `function` + `arguments` shim rather than rest params.
 */
const gtag = function () {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
} as (...args: unknown[]) => void;

function loadGtag() {
  if (scriptLoaded || typeof window === "undefined" || !MEASUREMENT_ID) return;
  scriptLoaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // Route changes are tracked manually — the app is client-routed.
    send_page_view: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function enabled() {
  return Boolean(MEASUREMENT_ID) && consent === "granted";
}

/** Page view for a client-side route change. */
export function trackPageView(path: string) {
  if (!enabled()) return;
  gtag("event", "page_view", {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

export type AnalyticsEvent =
  | "sign_up"
  | "login"
  | "transaction_added"
  | "receipt_scan"
  | "feedback_sent"
  | "setup_completed";

/**
 * Fire a product event. Never pass amounts, names, emails or any other
 * personal detail — only the fact that the thing happened.
 */
export function trackEvent(name: AnalyticsEvent, params?: Record<string, string | number | boolean>) {
  if (!enabled()) return;
  gtag("event", name, params ?? {});
}

/** Tag the session so demo traffic can be filtered out of reports. */
export function setDemoSession(isDemo: boolean) {
  if (!enabled()) return;
  gtag("set", "user_properties", { session_type: isDemo ? "demo" : "standard" });
}
