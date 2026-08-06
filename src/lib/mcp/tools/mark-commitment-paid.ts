import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "mark_commitment_paid",
  title: "Mark commitment as paid",
  description:
    "Mark a recurring commitment (bill, subscription, BNPL installment) as paid for the current cycle. Sets paid=true and last_paid_date. The app's rollover engine advances next_due_date on the next cycle automatically.",
  inputSchema: {
    commitment_id: z.string().uuid().describe("Commitment ID to mark paid."),
    paid_date: z.string().optional().describe("Date paid, YYYY-MM-DD. Defaults to today (UTC)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ commitment_id, paid_date }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);

    const date = paid_date ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await sb
      .from("commitments")
      .update({ paid: true, last_paid_date: date })
      .eq("id", commitment_id)
      .eq("user_id", ctx.getUserId()!)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return { content: [{ type: "text", text: "Commitment not found." }], isError: true };
    }

    return {
      content: [
        {
          type: "text",
          text: `Marked "${data.item_name}" as paid on ${date}.`,
        },
      ],
      structuredContent: { commitment: data },
    };
  },
});
