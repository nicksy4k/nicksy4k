import { describe, expect, it } from "vitest";
import {
  BNPL_PRESETS,
  cadenceEveryLabel,
  commitmentCadenceFor,
  generateInstallmentDates,
  inferBnplCadence,
} from "@/lib/bnplPresets";
import { perCycleAmount } from "@/lib/outgoings";

describe("bnpl presets", () => {
  it("Clearpay is 4 payments every 14 days", () => {
    const p = BNPL_PRESETS.find((x) => x.id === "clearpay")!;
    expect(p.installments).toBe(4);
    expect(p.cadence).toBe("fortnightly");
    const dates = generateInstallmentDates("2026-09-14", p.installments!, p.cadence);
    expect(dates).toEqual(["2026-09-14", "2026-09-28", "2026-10-12", "2026-10-26"]);
  });

  it("generates weekly, four-weekly and monthly schedules", () => {
    expect(generateInstallmentDates("2026-01-05", 3, "weekly")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
    expect(generateInstallmentDates("2026-01-05", 2, "four-weekly")).toEqual([
      "2026-01-05",
      "2026-02-02",
    ]);
    expect(generateInstallmentDates("2026-01-31", 2, "monthly")[1]).toBe("2026-03-03");
  });

  it("labels each cadence", () => {
    expect(cadenceEveryLabel("fortnightly")).toBe("every 2 weeks");
    expect(cadenceEveryLabel("monthly")).toBe("monthly");
  });

  it("stores a cadence the per-cycle maths understands", () => {
    const cadence = commitmentCadenceFor("fortnightly");
    // A £25 fortnightly instalment costs roughly two payments per monthly cycle.
    const perCycle = perCycleAmount(25, cadence, "monthly");
    expect(perCycle).toBeGreaterThan(25);
  });

  // Regression: editing a saved plan must not silently turn a monthly Klarna
  // schedule into fortnightly — the cadence is recovered from stored dates.
  it("recovers cadence from stored schedules", () => {
    expect(inferBnplCadence(generateInstallmentDates("2026-09-14", 4, "fortnightly"))).toBe(
      "fortnightly",
    );
    expect(inferBnplCadence(generateInstallmentDates("2026-09-14", 3, "monthly"))).toBe("monthly");
    expect(inferBnplCadence(generateInstallmentDates("2026-09-14", 2, "weekly"))).toBe("weekly");
    expect(inferBnplCadence(generateInstallmentDates("2026-09-14", 2, "four-weekly"))).toBe(
      "four-weekly",
    );
    expect(inferBnplCadence(["2026-09-14"])).toBe("monthly");
    expect(inferBnplCadence([])).toBe("monthly");
  });
});
