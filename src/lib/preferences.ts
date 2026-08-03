// ============================================================================
// Personalisation preferences — currency, theme, and comfort controls.
//
// One tiny external store (localStorage-backed, Supabase-synced) so the first
// paint is already personalised and every consumer stays in lockstep.
// Money values in the database are ALWAYS plain numbers; changing currency
// only changes how they're rendered — nothing is converted or rewritten.
// ============================================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CURRENCIES,
  CUSTOM_CURRENCY,
  currencySymbol,
  formatMoney,
  setActiveMoney,
  type MoneyFormat,
} from "@/lib/money";

export { CURRENCIES, CUSTOM_CURRENCY };

// ---------- themes ----------

export interface ThemeDef {
  id: string;
  name: string;
  blurb: string;
  /** Preview swatches: [surface, primary, chart-a, chart-b] */
  swatches: [string, string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: "midnight",
    name: "Midnight Indigo",
    blurb: "The signature look — softened for longer sessions.",
    swatches: ["oklch(0.20 0.02 270)", "oklch(0.62 0.15 272)", "oklch(0.62 0.13 220)", "oklch(0.74 0.11 170)"],
  },
  {
    id: "blush",
    name: "Soft Blush",
    blurb: "Warm plum surfaces with a gentle rose accent.",
    swatches: ["oklch(0.21 0.02 350)", "oklch(0.70 0.13 350)", "oklch(0.74 0.11 25)", "oklch(0.72 0.10 320)"],
  },
  {
    id: "bubblegum",
    name: "Bubblegum Pink",
    blurb: "Bright candy pink — light, warm and unapologetic.",
    swatches: ["oklch(0.98 0.015 345)", "oklch(0.62 0.24 350)", "oklch(0.62 0.19 15)", "oklch(0.60 0.18 320)"],
  },
  {
    id: "slate",
    name: "Muted Slate",
    blurb: "Low-contrast greys. The calmest of the dark themes.",
    swatches: ["oklch(0.22 0.01 250)", "oklch(0.66 0.08 240)", "oklch(0.70 0.07 200)", "oklch(0.74 0.07 160)"],
  },
  {
    id: "daylight",
    name: "Daylight",
    blurb: "A light, airy theme for bright rooms.",
    swatches: ["oklch(0.98 0.005 270)", "oklch(0.55 0.14 272)", "oklch(0.58 0.12 230)", "oklch(0.60 0.11 170)"],
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

// ---------- store ----------

export interface Prefs extends MoneyFormat {
  theme: string;
  joyCategories: string[];
  blurAmounts: boolean;
  hideCategoryChart: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  currency: "GBP",
  customSymbol: "¤",
  symbolPosition: "before",
  theme: "midnight",
  joyCategories: [],
  blurAmounts: false,
  hideCategoryChart: false,
};

const CACHE_KEY = "ledgerly.prefs.v1";
export const THEME_CACHE_KEY = "ledgerly.theme";

let state: Prefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

function coerce(raw: Partial<Prefs> | null | undefined): Prefs {
  const p = raw ?? {};
  const known = new Set([...CURRENCIES.map((c) => c.code), CUSTOM_CURRENCY]);
  return {
    currency: p.currency && known.has(p.currency) ? p.currency : DEFAULT_PREFS.currency,
    customSymbol: (p.customSymbol || DEFAULT_PREFS.customSymbol).slice(0, 4),
    symbolPosition: p.symbolPosition === "after" ? "after" : "before",
    theme: p.theme && THEME_IDS.includes(p.theme) ? p.theme : DEFAULT_PREFS.theme,
    joyCategories: Array.isArray(p.joyCategories) ? p.joyCategories : [],
    blurAmounts: !!p.blurAmounts,
    hideCategoryChart: !!p.hideCategoryChart,
  };
}

function emit() {
  for (const l of listeners) l();
}

function readCache(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return coerce(JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as Partial<Prefs>);
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeCache(p: Prefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    localStorage.setItem(THEME_CACHE_KEY, p.theme);
  } catch {
    /* ignore */
  }
}

export function applyThemeClass(theme: string) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  for (const id of THEME_IDS) el.classList.remove(`theme-${id}`);
  el.classList.add(`theme-${THEME_IDS.includes(theme) ? theme : "midnight"}`);
  el.style.colorScheme = theme === "daylight" ? "light" : "dark";
}

function setLocal(next: Prefs) {
  state = next;
  setActiveMoney(next);
  writeCache(next);
  applyThemeClass(next.theme);
  emit();
}

if (typeof window !== "undefined") {
  state = readCache();
  setActiveMoney(state);
  applyThemeClass(state.theme);
}

export function getPrefs(): Prefs {
  return state;
}

export function activeSymbol(p: Prefs = state): string {
  return currencySymbol(p);
}

export { formatMoney };

// ---------- hydration from Supabase ----------

let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;

  const [profileRes, settingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("currency, currency_symbol, symbol_position, theme")
      .eq("id", uid)
      .maybeSingle(),
    supabase
      .from("user_settings")
      .select("joy_categories, blur_amounts, hide_category_chart")
      .eq("user_id", uid)
      .maybeSingle(),
  ]);

  const prof = profileRes.data;
  const sett = settingsRes.data;
  if (!prof && !sett) return;

  setLocal(
    coerce({
      ...state,
      ...(prof
        ? {
            currency: prof.currency || state.currency,
            customSymbol: prof.currency_symbol || state.customSymbol,
            symbolPosition: (prof.symbol_position as "before" | "after") || state.symbolPosition,
            theme: prof.theme || state.theme,
          }
        : {}),
      ...(sett
        ? {
            joyCategories: (sett.joy_categories as string[]) ?? [],
            blurAmounts: !!sett.blur_amounts,
            hideCategoryChart: !!sett.hide_category_chart,
          }
        : {}),
    }),
  );
}

/** Called when the signed-in user changes so preferences don't leak across accounts. */
export function resetPreferences() {
  hydrated = false;
  setLocal(DEFAULT_PREFS);
}

async function persist(patch: Partial<Prefs>) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;

  const profilePatch: {
    currency?: string;
    currency_symbol?: string;
    symbol_position?: string;
    theme?: string;
  } = {};
  if (patch.currency !== undefined) profilePatch.currency = patch.currency;
  if (patch.customSymbol !== undefined) profilePatch.currency_symbol = patch.customSymbol;
  if (patch.symbolPosition !== undefined) profilePatch.symbol_position = patch.symbolPosition;
  if (patch.theme !== undefined) profilePatch.theme = patch.theme;

  const settingsPatch: {
    joy_categories?: string[];
    blur_amounts?: boolean;
    hide_category_chart?: boolean;
  } = {};
  if (patch.joyCategories !== undefined) settingsPatch.joy_categories = patch.joyCategories;
  if (patch.blurAmounts !== undefined) settingsPatch.blur_amounts = patch.blurAmounts;
  if (patch.hideCategoryChart !== undefined) settingsPatch.hide_category_chart = patch.hideCategoryChart;

  await Promise.all([
    Object.keys(profilePatch).length
      ? supabase.from("profiles").update(profilePatch).eq("id", uid)
      : Promise.resolve(),
    Object.keys(settingsPatch).length
      ? supabase
          .from("user_settings")
          .upsert({ user_id: uid, ...settingsPatch }, { onConflict: "user_id" })
      : Promise.resolve(),
  ]);
}

// ---------- React bindings ----------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getPrefs, () => DEFAULT_PREFS);

  useEffect(() => {
    void hydrate();
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setLocal(coerce({ ...state, ...patch }));
    void persist(patch);
  }, []);

  return { prefs, update };
}

/** Currency-aware formatter + symbol for components. */
export function useMoney() {
  const { prefs } = usePreferences();
  const fmt = useCallback((n: number) => formatMoney(n, prefs), [prefs]);
  return { fmt, symbol: currencySymbol(prefs), prefs };
}
