import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

const ItemSchema = z.object({
  name: z.string().min(1),
  price: z.number(),
  quantity: z.number().optional(),
  category: z.string().optional(),
});

export default defineTool({
  name: "add_items_to_transaction",
  title: "Add items to a transaction",
  description:
    "Append line items to an existing transaction (typically a pending/placeholder one). By default the total_amount is recomputed from the sum of all items' price * quantity; pass new_total_amount to override. Set mark_settled=true to also clear the pending flag.",
  inputSchema: {
    transaction_id: z.string().uuid().describe("Transaction ID to append items to."),
    items: z.array(ItemSchema).describe("Line items to add."),
    mark_settled: z
      .boolean()
      .optional()
      .describe("Also clear the pending flag (is_pending=false)."),
    new_total_amount: z
      .number()
      .optional()
      .describe("Override the recomputed total with this value."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ transaction_id, items, mark_settled, new_total_amount }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);

    const { data: existing, error: fetchErr } = await sb
      .from("transactions")
      .select("id, items, total_amount, is_pending")
      .eq("id", transaction_id)
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (fetchErr) return { content: [{ type: "text", text: fetchErr.message }], isError: true };
    if (!existing) {
      return {
        content: [{ type: "text", text: "Transaction not found." }],
        isError: true,
      };
    }

    const currentItems = Array.isArray(existing.items) ? (existing.items as unknown[]) : [];
    const nextItems = [...currentItems, ...items];

    const computedTotal = nextItems.reduce((sum, raw) => {
      const it = raw as { price?: unknown; quantity?: unknown };
      const price = typeof it.price === "number" ? it.price : Number(it.price ?? 0);
      const qty = typeof it.quantity === "number" ? it.quantity : Number(it.quantity ?? 1) || 1;
      return sum + price * qty;
    }, 0);

    const update: Record<string, unknown> = {
      items: nextItems,
      total_amount: new_total_amount ?? computedTotal,
    };
    if (mark_settled) update.is_pending = false;

    const { data, error } = await sb
      .from("transactions")
      .update(update)
      .eq("id", transaction_id)
      .eq("user_id", ctx.getUserId()!)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: `Added ${items.length} item(s) to transaction ${transaction_id}. New total: ${data.total_amount}${mark_settled ? " (settled)" : ""}.`,
        },
      ],
      structuredContent: { transaction: data },
    };
  },
});
