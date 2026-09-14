/**
 * Shared "pay later" plan presets + schedule maths.
 *
 * Used by BOTH places a BNPL plan can be created — the New debt form on
 * Credit & Debt and the payment split editor on a new purchase — so the two
 * routes always produce identical schedules.
 */

export type BnplCadence = "weekly" | "fortnightly" | "four-weekly" | "monthly";

export interface BnplPreset {
  id: string;
  label: string;
  /** null = user picks everything (Custom). */
  installments: number | null;
  cadence: BnplCadence;
  firstPaymentToday: boolean;
  hint: string;
}

export const BNPL_PRESETS: BnplPreset[] = [
  {
    id: "clearpay",
    label: "Clearpay",
    installments: 4,
    cadence: "fortnightly",
    firstPaymentToday: true,
    hint: "4 payments, every 2 weeks",
  },
  {
    id: "klarna3",
    label: "Klarna Pay in 3",
    installments: 3,
    cadence: "monthly",
    firstPaymentToday: true,
    hint: "3 payments, monthly",
  },
  {
    id: "paypal3",
    label: "PayPal Pay in 3",
    installments: 3,
    cadence: "monthly",
    firstPaymentToday: true,
    hint: "3 payments, monthly",
  },
  {
    id: "custom",
    label: "Custom",
    installments: null,
    cadence: "monthly",
    firstPaymentToday: false,
    hint: "Set your own",
  },
];

export function cadenceEveryLabel(c: BnplCadence): string {
  return c === "weekly"
    ? "every week"
    : c === "fortnightly"
      ? "every 2 weeks"
      : c === "four-weekly"
        ? "every 4 weeks"
        : "monthly";
}

/** Step, in days, for the date-based cadences. Monthly is handled separately. */
const DAY_STEP: Partial<Record<BnplCadence, number>> = {
  weekly: 7,
  fortnightly: 14,
  "four-weekly": 28,
};

export function generateInstallmentDates(
  firstDate: string,
  count: number,
  cadence: BnplCadence,
): string[] {
  const out: string[] = [];
  const [y, m, d] = firstDate.split("-").map(Number);
  const step = DAY_STEP[cadence];
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    if (step) dt.setDate(dt.getDate() + step * i);
    else dt.setMonth(dt.getMonth() + i);
    out.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

/**
 * The cadence value stored on the auto-created outgoing. `perCycleAmount`
 * understands weekly / fortnightly / four-weekly / monthly, so per-cycle
 * totals stay right for fortnightly Clearpay plans.
 */
export function commitmentCadenceFor(c: BnplCadence): string {
  return c;
}
