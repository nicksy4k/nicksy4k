/**
 * Pure helpers for payment-split math.
 *
 * These functions are used (or intended to be used) by the settle-flow and
 * "new transaction" screens to split a single transaction across the main
 * balance, pocket accounts, and BNPL plans. Kept side-effect free so they
 * can be unit-tested without a Supabase or React shell.
 */

export interface BnplInstallments {
  /** Amount taken from main/pocket today when firstPaymentToday=true, else 0. */
  firstAmt: number;
  /** Amount of each of the "middle" installments in the debt. */
  perInstallment: number;
  /** The FINAL installment — absorbs any rounding remainder so
   *  firstAmt + perInstallment*(remainingCount-1) + lastInstallment === total. */
  lastInstallment: number;
  /** Number of installments that remain in the debt (i.e. NOT paid today). */
  remainingCount: number;
  /** Amount that lives on the debt (total − firstAmt). */
  remainingAmt: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split `total` into `count` installments. When `firstToday` is true the
 * first installment is peeled off (deducted today, source is main/pocket)
 * and the debt holds the remaining `count - 1` installments.
 *
 * Rounding: every installment is 2dp; the LAST installment absorbs the
 * remainder so the sum matches `total` to the penny.
 */
export function computeBnplInstallments(
  total: number,
  count: number,
  firstToday: boolean,
): BnplInstallments {
  const n = Math.max(1, Math.floor(count));
  const t = r2(total);

  if (firstToday && n > 1) {
    const firstAmt = r2(t / n);
    const remainingAmt = r2(t - firstAmt);
    const remainingCount = n - 1;
    const per = r2(remainingAmt / remainingCount);
    const last = r2(remainingAmt - per * (remainingCount - 1));
    return {
      firstAmt,
      perInstallment: per,
      lastInstallment: last,
      remainingCount,
      remainingAmt,
    };
  }

  const per = r2(t / n);
  const last = r2(t - per * (n - 1));
  return {
    firstAmt: 0,
    perInstallment: per,
    lastInstallment: last,
    remainingCount: n,
    remainingAmt: t,
  };
}

export interface PaymentSplit {
  source: string; // "main" | "pocket:<name>" | "bnpl:<id>" | "other:<label>"
  amount: number;
  label?: string;
}

export interface DerivedSplits {
  main: number;
  pockets: { name: string; amount: number }[];
  bnpl: { plan: string; amount: number }[];
  other: { label: string; amount: number }[];
}

/**
 * Normalise an arbitrary set of splits into typed buckets and compute the
 * implicit main-balance remainder. `main` = total − pockets − bnpl − other,
 * plus any explicit `source: "main"` splits.
 */
export function deriveSplitRows(
  total: number,
  splits: PaymentSplit[],
): DerivedSplits {
  const pockets: DerivedSplits["pockets"] = [];
  const bnpl: DerivedSplits["bnpl"] = [];
  const other: DerivedSplits["other"] = [];
  let explicitMain = 0;
  let nonMainSum = 0;

  for (const s of splits) {
    const amt = r2(s.amount);
    if (s.source === "main") {
      explicitMain += amt;
    } else if (s.source.startsWith("pocket:")) {
      pockets.push({ name: s.source.slice(7), amount: amt });
      nonMainSum += amt;
    } else if (s.source.startsWith("bnpl:")) {
      bnpl.push({ plan: s.source.slice(5), amount: amt });
      nonMainSum += amt;
    } else if (s.source.startsWith("other:")) {
      other.push({ label: s.source.slice(6), amount: amt });
      nonMainSum += amt;
    }
  }

  const remainder = r2(r2(total) - nonMainSum);
  return {
    main: remainder,
    pockets,
    bnpl,
    other,
  };
}


export interface PocketWithdrawalRow {
  user_id: string;
  date: string;
  kind: "withdrawal";
  amount: number;
  account: string;
  notes: string;
}

/**
 * Build `savings` insert rows for each pocket portion of a split payment.
 * The main balance is debited elsewhere by the transaction row itself.
 */
export function buildPocketWithdrawalRows(
  userId: string,
  date: string,
  retailer: string,
  splits: PaymentSplit[],
): PocketWithdrawalRow[] {
  const label = retailer.trim() || "Transaction";
  return splits
    .filter((s) => s.source.startsWith("pocket:") && s.amount > 0)
    .map((s) => ({
      user_id: userId,
      date,
      kind: "withdrawal" as const,
      amount: r2(s.amount),
      account: s.source.slice(7),
      notes: `Auto: ${label}`,
    }));
}
