import { describe, it, expect } from "vitest";
import { habitStats, pulse, priceChecks } from "../insights";
import type { Transaction } from "../types";

const tx = (date: string, retailer: string, items: [string, number, number?][], extra: Partial<Transaction> = {}) =>
  ({
    id: date + retailer, date, retailer, total_amount: items.reduce((s, [, p, q]) => s + p * (q ?? 1), 0),
    receipt_attached: false, receipt_type: "None", receipt_location: "",
    items: items.map(([n, p, q], i) => ({ id: String(i), item_name: n, price: p, quantity: q, category: "Other" })),
    ...extra,
  }) as Transaction;

const txs = [
  tx("2026-10-10", "Tesco", [["Monster Ultra", 1.5, 4], ["Bread", 1]]),
  tx("2026-10-12", "Premier", [["Monster Ultra", 2.2]]),
  tx("2026-10-14", "Deliveroo", [["Chicken box", 12], ["Delivery fee", 2.99]]),
  tx("2026-10-15", "Tesco", [["Monster Ultra", 9]], { is_pending: true }),
];

describe("insights", () => {
  it("counts energy drink units by quantity and ignores pending", () => {
    const s = habitStats(txs, ["monster"], "2026-10-08", "2026-11-04");
    expect(s).toEqual({ count: 5, orders: 2, total: 8.2, avgUnit: 1.64 });
  });
  it("counts takeaway food but not the delivery fee", () => {
    expect(habitStats(txs, ["deliveroo"], "2026-10-08", "2026-11-04").total).toBe(12);
  });
  it("counts no-spend days in the elapsed part of the cycle", () => {
    const p = pulse(txs, "2026-10-08", "2026-11-04", "2026-10-14");
    expect(p.daysElapsed).toBe(7);
    expect(p.noSpend).toBe(4);
    expect(p.streak).toBe(0);
  });
  it("finds best and highest price for repeat items", () => {
    const m = priceChecks(txs).find((x) => x.item === "Monster Ultra")!;
    expect(m.low).toMatchObject({ price: 1.5, retailer: "Tesco" });
    expect(m.high).toMatchObject({ price: 2.2, retailer: "Premier" });
  });
});

import { pastCycleWindows } from "../api/insights-ai.functions";
describe("pastCycleWindows", () => {
  it("steps back 28 days per four-weekly cycle with no gaps", () => {
    const w = pastCycleWindows("2026-10-08", "2026-11-04", "four-weekly", 3);
    expect(w).toEqual([
      { start: "2026-10-08", end: "2026-11-04" },
      { start: "2026-09-10", end: "2026-10-07" },
      { start: "2026-08-13", end: "2026-09-09" },
    ]);
  });
});

import { budgetProgress, mergeHabits, parseKeywords, playRunway, priceAlerts, smallSpends } from "../insights";

describe("deeper insights", () => {
  it("runway: £50 play at £5/day lasts 10 days, reaching payday in 8", () => {
    expect(playRunway(50, 5, 8)).toEqual({ days: 10, reachesPayday: true, safeDaily: 6.25 });
  });
  it("runway: £20 play at £5/day does not reach payday in 8 days", () => {
    expect(playRunway(20, 5, 8).reachesPayday).toBe(false);
  });
  it("budget: £28.50 of £40 is 71% with £11.50 left", () => {
    expect(budgetProgress(28.5, 40)).toEqual({ pct: 71, left: 11.5, over: false });
  });
  it("small spends counts only items at or under £5", () => {
    const tx = [{ date: "2026-10-10", retailer: "Shop", total_amount: 8, is_pending: false,
      items: [{ item_name: "Can", price: 1.5, quantity: 2 }, { item_name: "Book", price: 5.01 }] }] as never;
    expect(smallSpends(tx, "2026-10-01", "2026-10-31")).toMatchObject({ count: 2, total: 3 });
  });
  it("hiding a preset removes it; custom habits are added", () => {
    const list = mergeHabits([{ id: "vape", label: "Vape", emoji: "", keywords: [], hidden: true },
      { id: "h_1", label: "Coffee", emoji: "☕", keywords: ["coffee"] }]);
    expect(list.some((h) => h.id === "vape")).toBe(false);
    expect(list.some((h) => h.id === "h_1")).toBe(true);
  });
  it("parses keywords", () => {
    expect(parseKeywords(" Coffee, latte ,,coffee")).toEqual(["coffee", "latte"]);
  });
  it("price alert when last price is above best", () => {
    const a = priceAlerts([{ item: "Red Bull", buys: 2, low: { price: 1.25, retailer: "Tesco" },
      high: { price: 1.65, retailer: "Shop" }, last: { price: 1.65, retailer: "Shop", date: "2026-10-20" } }]);
    expect(a[0].extra).toBe(0.4);
  });
});

import { isAuxiliary } from "../insights";
describe("auxiliary fee filter", () => {
  it("flags postage, protection, fees and discounts", () => {
    for (const n of ["Postage", "Buyer Protection fee", "Service fee", "Delivery fee", "Discount"]) expect(isAuxiliary({ item_name: n, price: 1 })).toBe(true);
    expect(isAuxiliary({ item_name: "Blue husky plush", price: 2 })).toBe(false);
    expect(isAuxiliary({ item_name: "Promo", price: -3 })).toBe(true);
  });
});

import { matches as habitMatch, HABIT_PRESETS as PRESETS } from "../insights";
describe("habit keyword matching", () => {
  const energy = PRESETS.find((p) => p.id === "energy")!.keywords;
  const vape = PRESETS.find((p) => p.id === "vape")!.keywords;
  it("ignores energy bills and Amazon Prime", () => {
    expect(habitMatch("OCTOPUS ENERGY", energy)).toBe(false);
    expect(habitMatch("EDF ENERGY", energy)).toBe(false);
    expect(habitMatch("AMAZON PRIME", energy)).toBe(false);
  });
  it("still counts real energy drinks", () => {
    expect(habitMatch("Monster Energy 500ml", energy)).toBe(true);
    expect(habitMatch("Prime Hydration", energy)).toBe(true);
  });
  it("vape pods but not podcasts", () => {
    expect(habitMatch("Spotify podcast", vape)).toBe(false);
    expect(habitMatch("Elux pods x2", vape)).toBe(true);
  });
});
