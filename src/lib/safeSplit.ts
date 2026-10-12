// Keep-Safe & Play split — a purely visual planning layer over "Left to spend".
// Never writes to the ledger; turning it off restores the standard dashboard.
// Preferences are cached locally and synced to user_settings.safe_split so
// every device sees the same split.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface SafeSplitState {
  enabled: boolean;
  keepPct: number; // 0–100
  /** Locked Keep-Safe target per cycle (key = cycle start). */
  targets: Record<string, number>;
}

const KEY = "ledgerly.safeSplit.v1";
const DEFAULT: SafeSplitState = { enabled: true, keepPct: 40, targets: {} };
let state: SafeSplitState = DEFAULT;
const listeners = new Set<() => void>();

function normalise(raw: unknown): SafeSplitState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SafeSplitState>;
  return { ...DEFAULT, ...r, targets: r.targets ?? {} };
}

if (typeof window !== "undefined") {
  try {
    const local = normalise(JSON.parse(localStorage.getItem(KEY) || "null"));
    if (local) state = local;
  } catch {
    /* ignore */
  }
}

function applyLocal(next: SafeSplitState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function saveRemote(next: SafeSplitState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("user_settings")
      .update({ safe_split: next as unknown as Json })
      .eq("user_id", u.user.id);
  }, 400);
}

function set(next: SafeSplitState) {
  applyLocal(next);
  saveRemote(next);
}

let loadedFor: string | null = null;
/** Pull the account's saved split; seed the account from this device if none yet. */
export async function loadSafeSplitFromAccount() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user || loadedFor === u.user.id) return;
  loadedFor = u.user.id;
  const { data } = await supabase
    .from("user_settings")
    .select("safe_split")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const remote = normalise(data?.safe_split);
  if (remote) applyLocal(remote);
  else if (data) saveRemote(state);
}

export function updateSafeSplit(patch: Partial<SafeSplitState>) {
  set({ ...state, ...patch });
}

export function setCycleTarget(cycleKey: string, amount: number) {
  set({ ...state, targets: { ...state.targets, [cycleKey]: Math.max(0, round(amount)) } });
}

const round = (n: number) => Math.round(n * 100) / 100;

export function useSafeSplit(): SafeSplitState {
  useEffect(() => {
    void loadSafeSplitFromAccount();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => DEFAULT,
  );
}

export interface SplitResult {
  keepSafe: number;
  play: number;
  target: number;
  breached: boolean;
  /** Amount spent out of the buffer below its target. */
  dippedBy: number;
}

/** Hybrid rule: the Keep-Safe target is locked; once breached, play = 0. */
export function computeSplit(balance: number, target: number): SplitResult {
  const b = Math.max(0, balance);
  if (b >= target) return { keepSafe: target, play: round(b - target), target, breached: false, dippedBy: 0 };
  return { keepSafe: round(b), play: 0, target, breached: true, dippedBy: round(target - b) };
}

/** Preview a purchase against the current split. */
export function previewPurchase(balance: number, target: number, amount: number) {
  const before = computeSplit(balance, target);
  const after = computeSplit(balance - amount, target);
  const intoBuffer = round(Math.max(0, amount - before.play));
  return { before, after, intoBuffer, overBalance: amount > Math.max(0, balance) };
}
