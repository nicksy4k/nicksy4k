// Custom habit trackers, cached locally and synced to user_settings.habits.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CustomHabit } from "./insights";

const KEY = "ledgerly.habits.v1";

export function useSavedHabits() {
  const [saved, setSaved] = useState<CustomHabit[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("habits" as never)
        .eq("user_id", u.user.id)
        .maybeSingle();
      const remote = (data as { habits?: unknown } | null)?.habits;
      if (Array.isArray(remote)) {
        setSaved(remote as CustomHabit[]);
        localStorage.setItem(KEY, JSON.stringify(remote));
      }
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

  return { saved, save };
}
