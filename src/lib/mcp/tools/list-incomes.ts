import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_incomes",
  title: "List incomes",
  description:
    "List the signed-in user's income entries, newest first. Optionally filter by ISO date range (YYYY-MM-DD) and cap the number of rows returned (default 25, max 200). Includes carryover rows the app generates each cycle.",
  inputSchema: {
    since: z.string().optional().describe("Inclusive start date, YYYY-MM-DD."),
    until: z.string().optional().describe("Inclusive end date, YYYY-MM-DD."),
    limit: z.number().int().min(1).max(200).optional().describe("Row cap, default 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ since, until, limit }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("incomes")
      .select("id, date, source, amount, category, notes")
      .eq("user_id", ctx.getUserId()!)
      .order("date", { ascending: false })
      .limit(limit ?? 25);
    if (since) q = q.gte("date", since);
    if (until) q = q.lte("date", until);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { incomes: data ?? [] },
    };
  },
});
