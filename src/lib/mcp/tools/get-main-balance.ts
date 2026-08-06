import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";
import { computeActiveCycle, loadCycleSettings } from "../cycle";
import { mainExpensePortion } from "@/lib/format";

export default defineTool({
  name: "get_main_balance",
  title: "Get main balance (left to spend)",
  description:
    "Compute the signed-in user's main-balance 'Left to Spend' for a cycle window, matching the app's dashboard exactly: totalIncome − mainExpensePortion(transactions) − netSavings. Defaults to the currently-active cycle when startISO/endISO are omitted. BNPL splits are excluded from main expenses (money hasn't left main yet); pocket splits are included (they net out). Returns the total plus the breakdown so you can explain the number.",
  inputSchema: {
    startISO: z
      .string()
      .optional()
      .describe("Inclusive window start, YYYY-MM-DD. Defaults to active cycle start."),
    endISO: z
      .string()
      .optional()
      .describe("Inclusive window end, YYYY-MM-DD. Defaults to active cycle end."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ startISO, endISO }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;

    let windowStart = startISO;
    let windowEnd = endISO;
    let cycleInfo: Awaited<ReturnType<typeof computeActiveCycle>> | null = null;
    if (!windowStart || !windowEnd) {
      const settings = await loadCycleSettings(ctx);
      cycleInfo = computeActiveCycle(settings);
      windowStart = windowStart ?? cycleInfo.startISO;
      windowEnd = windowEnd ?? cycleInfo.endISO;
    }

    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId()!;

    const [incRes, txRes, savRes] = await Promise.all([
      sb
        .from("incomes")
        .select("amount")
        .eq("user_id", uid)
        .gte("date", windowStart)
        .lte("date", windowEnd),
      sb
        .from("transactions")
        .select("total_amount, payment_splits")
        .eq("user_id", uid)
        .gte("date", windowStart)
        .lte("date", windowEnd),
      sb
        .from("savings")
        .select("amount, kind")
        .eq("user_id", uid)
        .gte("date", windowStart)
        .lte("date", windowEnd),
    ]);

    const firstError = incRes.error || txRes.error || savRes.error;
    if (firstError) {
      return { content: [{ type: "text", text: firstError.message }], isError: true };
    }

    const totalIncome = (incRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalExpenses = (txRes.data ?? []).reduce(
      (s, t) =>
        s +
        mainExpensePortion({
          total_amount: Number(t.total_amount ?? 0),
          payment_splits: (t.payment_splits as { source: string; amount: number }[]) ?? [],
        }),
      0,
    );
    const netSavings = (savRes.data ?? []).reduce(
      (s, r) => s + (r.kind === "deposit" ? Number(r.amount ?? 0) : -Number(r.amount ?? 0)),
      0,
    );
    const leftToSpend = totalIncome - totalExpenses - netSavings;

    const result = {
      windowStart,
      windowEnd,
      cycle: cycleInfo,
      totalIncome,
      totalExpenses,
      netSavings,
      leftToSpend,
      currency: "GBP",
    };

    return {
      content: [
        {
          type: "text",
          text: `Main balance for ${windowStart} → ${windowEnd}: ${leftToSpend.toFixed(2)} (income ${totalIncome.toFixed(2)} − expenses ${totalExpenses.toFixed(2)} − net savings ${netSavings.toFixed(2)}).`,
        },
      ],
      structuredContent: result,
    };
  },
});
