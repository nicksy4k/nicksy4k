import { describe, expect, it } from "vitest";
import {
  advanceByCadence,
  advanceDueDate,
  advanceForCommitment,
  getActiveCycle,
  isInCycle,
  listRecentCycles,
  previousCycleWindow,
  rollDueDateForward,
  type CycleSettings,
} from "../cycle";

function settings(partial: Partial<CycleSettings>): CycleSettings {
  return {
    type: "monthly",
    anchor: "2026-01-05",
    override: null,
    carryoverEnabled: true,
    lastCarryoverCycleKey: null,
    ...partial,
  };
}

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("getActiveCycle — monthly", () => {
  it("runs from the anchor day of month to the day before the next one", () => {
    const c = getActiveCycle(settings({}), d("2026-08-16"));
    expect(c.startISO).toBe("2026-08-05");
    expect(c.endISO).toBe("2026-09-04");
    expect(c.type).toBe("monthly");
    expect(c.isOverridden).toBe(false);
  });

  it("falls back to the previous month before the anchor day", () => {
    const c = getActiveCycle(settings({}), d("2026-08-04"));
    expect(c.startISO).toBe("2026-07-05");
    expect(c.endISO).toBe("2026-08-04");
  });

  it("includes the anchor day itself as the first day", () => {
    expect(getActiveCycle(settings({}), d("2026-08-05")).startISO).toBe("2026-08-05");
  });

  it("clamps a 31st anchor to short months", () => {
    const s = settings({ anchor: "2026-01-31" });
    const feb = getActiveCycle(s, d("2026-02-15"));
    expect(feb.startISO).toBe("2026-02-28");
    expect(feb.endISO).toBe("2026-03-30");
  });
});

describe("getActiveCycle — four-weekly", () => {
  const s = settings({ type: "four-weekly", anchor: "2026-01-05" });

  it("spans exactly 28 days from the anchor", () => {
    const c = getActiveCycle(s, d("2026-01-05"));
    expect(c.startISO).toBe("2026-01-05");
    expect(c.endISO).toBe("2026-02-01");
  });

  it("rolls to the next window on day 29", () => {
    const c = getActiveCycle(s, d("2026-02-02"));
    expect(c.startISO).toBe("2026-02-02");
    expect(c.endISO).toBe("2026-03-01");
  });

  it("handles dates before the anchor", () => {
    const c = getActiveCycle(s, d("2026-01-04"));
    expect(c.startISO).toBe("2025-12-08");
    expect(c.endISO).toBe("2026-01-04");
  });
});

describe("overrides and neighbouring windows", () => {
  it("uses a manual override while today falls inside it", () => {
    const s = settings({ override: { startISO: "2026-08-10", endISO: "2026-08-20" } });
    const inside = getActiveCycle(s, d("2026-08-15"));
    expect(inside.isOverridden).toBe(true);
    expect(inside.startISO).toBe("2026-08-10");

    const outside = getActiveCycle(s, d("2026-08-25"));
    expect(outside.isOverridden).toBe(false);
    expect(outside.startISO).toBe("2026-08-05");
  });

  it("finds the previous window and lists recent ones newest-first", () => {
    const prev = previousCycleWindow(settings({}), d("2026-08-16"));
    expect(prev.startISO).toBe("2026-07-05");
    expect(prev.endISO).toBe("2026-08-04");

    const recent = listRecentCycles(settings({}), 3, d("2026-08-16"));
    expect(recent.map((c) => c.startISO)).toEqual(["2026-08-05", "2026-07-05", "2026-06-05"]);
  });

  it("tests membership inclusively at both edges", () => {
    const c = getActiveCycle(settings({}), d("2026-08-16"));
    expect(isInCycle("2026-08-05", c)).toBe(true);
    expect(isInCycle("2026-09-04", c)).toBe(true);
    expect(isInCycle("2026-08-04", c)).toBe(false);
    expect(isInCycle("2026-09-05", c)).toBe(false);
  });
});

describe("due-date advancement", () => {
  it("advances by the cycle type", () => {
    expect(advanceDueDate("2026-08-05", "monthly")).toBe("2026-09-05");
    expect(advanceDueDate("2026-08-05", "four-weekly")).toBe("2026-09-02");
  });

  it("advances by an explicit cadence", () => {
    expect(advanceByCadence("2026-08-05", "weekly")).toBe("2026-08-12");
    expect(advanceByCadence("2026-08-05", "fortnightly")).toBe("2026-08-19");
    expect(advanceByCadence("2026-08-05", "four-weekly")).toBe("2026-09-02");
    expect(advanceByCadence("2026-08-05", "monthly")).toBe("2026-09-05");
  });

  it("advances annual subscriptions by a whole year", () => {
    expect(advanceForCommitment("2026-08-05", "annual", "monthly")).toBe("2027-08-05");
    expect(advanceForCommitment("2026-08-05", "monthly", "four-weekly")).toBe("2026-09-02");
  });

  it("rolls a stale due date forward past the target date", () => {
    const cycle = getActiveCycle(settings({}), d("2026-08-16"));
    const rolled = rollDueDateForward("2026-03-05", "2026-08-16", cycle, "monthly");
    expect(rolled).toBe("2026-09-05");
  });

  it("leaves a future due date alone", () => {
    const cycle = getActiveCycle(settings({}), d("2026-08-16"));
    expect(rollDueDateForward("2026-12-05", "2026-08-16", cycle, "monthly")).toBe("2026-12-05");
  });
});
