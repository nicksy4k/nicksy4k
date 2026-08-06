import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_savings",
  title: "List savings pockets",
  description:
    "List the signed-in user's savings pockets/sinking funds with their current balances and targets.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("savings").select("*").eq("user_id", ctx.getUserId()!);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { savings: data ?? [] },
    };
  },
});
