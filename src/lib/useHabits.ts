// Custom habit trackers, cached locally and synced to user_settings.habits.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CustomHabit } from "./insights";

const KEY = "ledgerly.habits.v1";

export interface ScratchRef {
  id: string;
  name: string;
  amount: number;
}

export function useSavedHabits() {
  const [saved, setSaved] = useState<CustomHabit[]>([]);
  const [scratch, setScratch] = useState<ScratchRef[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
      const sp = localStorage.getItem("ledgerly.scratchpad.v1");
      if (sp) setScratch(JSON.parse(sp));
    } catch {
      /* ignore */
    }
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("habits, scratchpad" as never)
        .eq("user_id", u.user.id)
        .maybeSingle();
      const row = data as { habits?: unknown; scratchpad?: unknown } | null;
      if (Array.isArray(row?.habits)) {
        setSaved(row.habits as CustomHabit[]);
        localStorage.setItem(KEY, JSON.stringify(row.habits));
      }
      if (Array.isArray(row?.scratchpad)) setScratch(row.scratchpad as ScratchRef[]);
    })();
  }, []);

  const save = async (next: CustomHabit[]) => {
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("user_settings")
      .update({ habits: next } as never)
      .eq("user_id", u.user.id);
  };

  return { saved, save, scratch };
}
