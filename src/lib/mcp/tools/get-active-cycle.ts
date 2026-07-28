import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth } from "../supabase";
import { computeActiveCycle, loadCycleSettings } from "../cycle";

export default defineTool({
  name: "get_active_cycle",
  title: "Get active cycle window",
  description:
    "Return the signed-in user's currently-active financial cycle window (monthly or four-weekly), including any manual override. Use this to know which start/end dates to filter transactions/incomes/commitments by when the user asks about 'this cycle', 'this month', or 'left to spend'.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const settings = await loadCycleSettings(ctx);
    const cycle = computeActiveCycle(settings);
    return {
      content: [{ type: "text", text: JSON.stringify(cycle) }],
      structuredContent: { cycle },
    };
  },
});
