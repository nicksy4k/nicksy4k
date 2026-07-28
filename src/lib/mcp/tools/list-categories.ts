import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "List the signed-in user's spending / commitment categories. Filter by kind if provided.",
  inputSchema: {
    kind: z
      .string()
      .optional()
      .describe("Filter by category kind (e.g. 'spend', 'commitment', 'income')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", ctx.getUserId()!)
      .order("name", { ascending: true });
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
