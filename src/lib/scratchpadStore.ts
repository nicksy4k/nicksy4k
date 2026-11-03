import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ScratchItem } from "@/lib/spendMath";

export const SCRATCH_KEY = "ledgerly.scratchpad.v1";

/** Remove one planned spend (after its real purchase is logged), locally and in the cloud. */
export async function removeScratchItem(id: string): Promise<void> {
  let local: ScratchItem[] = [];
  try {
    local = JSON.parse(localStorage.getItem(SCRATCH_KEY) || "[]");
    localStorage.setItem(SCRATCH_KEY, JSON.stringify(local.filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data } = await supabase
    .from("user_settings")
    .select("scratchpad")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const remote = Array.isArray(data?.scratchpad) ? (data!.scratchpad as unknown as ScratchItem[]) : local;
  await supabase
    .from("user_settings")
    .update({ scratchpad: remote.filter((x) => x.id !== id) as unknown as Json })
    .eq("user_id", u.user.id);
}
