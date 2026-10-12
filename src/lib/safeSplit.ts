// Keep-Safe & Play split — a purely visual planning layer over "Left to spend".
// Never writes to the ledger; turning it off restores the standard dashboard.
import { useSyncExternalStore } from "react";

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

if (typeof window !== "undefined") {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw) state = { ...DEFAULT, ...raw, targets: raw.targets ?? {} };
  } catch {
    /* ignore */
  }
}

function set(next: SafeSplitState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function updateSafeSplit(patch: Partial<SafeSplitState>) {
  set({ ...state, ...patch });
}

export function setCycleTarget(cycleKey: string, amount: number) {
  set({ ...state, targets: { ...state.targets, [cycleKey]: Math.max(0, round(amount)) } });
}

const round = (n: number) => Math.round(n * 100) / 100;

export function useSafeSplit(): SafeSplitState {
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
