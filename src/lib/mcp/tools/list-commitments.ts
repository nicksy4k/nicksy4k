import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_commitments",
  title: "List commitments",
  description:
    "List the signed-in user's recurring commitments (bills, subscriptions, BNPL installments). Optionally filter to only unpaid rows or only those due on or before a given date.",
  inputSchema: {
    unpaidOnly: z.boolean().optional().describe("Only return rows where paid = false."),
    dueOnOrBefore: z
      .string()
      .optional()
      .describe("Only return rows with next_due_date <= this ISO date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unpaidOnly, dueOnOrBefore }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("commitments")
      .select(
        "id, item_name, store, category, amount, next_due_date, paid, last_paid_date, payment_method",
      )
      .eq("user_id", ctx.getUserId()!)
      .order("next_due_date", { ascending: true, nullsFirst: false });
    if (unpaidOnly) q = q.eq("paid", false);
    if (dueOnOrBefore) q = q.lte("next_due_date", dueOnOrBefore);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { commitments: data ?? [] },
    };
  },
});
