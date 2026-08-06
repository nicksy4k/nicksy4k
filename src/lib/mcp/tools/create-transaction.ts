import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_transaction",
  title: "Log a transaction",
  description:
    "Record a new spending transaction for the signed-in user. Provide the retailer, total amount (in the app's base currency, e.g. 12.50), ISO date, and an optional list of itemized line items. Marks the transaction non-pending by default.",
  inputSchema: {
    retailer: z.string().min(1).describe("Store or merchant name."),
    total_amount: z.number().describe("Total amount charged."),
    date: z.string().describe("Transaction date, YYYY-MM-DD."),
    notes: z.string().optional().describe("Free-form notes."),
    items: z
      .array(
        z.object({
          name: z.string(),
          price: z.number(),
          quantity: z.number().optional(),
          category: z.string().optional(),
        }),
      )
      .optional()
      .describe("Optional itemized line items."),
    is_pending: z.boolean().optional().describe("Mark as a pending/placeholder transaction."),
    payment_splits: z
      .array(
        z.object({
          source: z
            .string()
            .describe("Funding source label (e.g. 'main', pocket name, BNPL name)."),
          amount: z.number(),
          kind: z.string().optional().describe("Optional split kind: 'main' | 'pocket' | 'bnpl'."),
        }),
      )
      .optional()
      .describe("Optional split-payment breakdown; amounts should sum to total_amount."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (
    { retailer, total_amount, date, notes, items, is_pending, payment_splits },
    ctx,
  ) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("transactions")
      .insert({
        user_id: ctx.getUserId()!,
        retailer,
        total_amount,
        date,
        notes: notes ?? null,
        items: items ?? [],
        is_pending: is_pending ?? false,
        payment_splits: payment_splits ?? [],
      })
      .select()
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [
        {
          type: "text",
          text: `Recorded ${retailer} — ${total_amount} on ${date} (id ${data.id}).`,
        },
      ],
      structuredContent: { transaction: data },
    };
  },
});
