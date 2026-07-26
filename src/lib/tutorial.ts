import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "ledgerly.tutorial.completed";
const PENDING_KEY = "ledgerly.tutorial.pending";

function readCache(): boolean | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CACHE_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function writeCache(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, v ? "true" : "false");
}

/** Called by the setup wizard on Finish so the dashboard knows to auto-open the welcome modal. */
export function markTutorialPending() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_KEY, "1");
}

/** Reads AND clears the pending flag in one call so it fires exactly once. */
export function consumeTutorialPending(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(PENDING_KEY);
  if (v) sessionStorage.removeItem(PENDING_KEY);
  return v === "1";
}

export function useTutorialStatus() {
  const [completed, setCompleted] = useState<boolean | null>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setCompleted(null);
        return;
      }
      const { data } = await supabase
        .from("user_settings")
        .select("tutorial_completed")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const val = (data?.tutorial_completed as boolean | undefined) ?? false;
      if (!cancelled) {
        writeCache(val);
        setCompleted(val);
      }
    }
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setCompleted(readCache());
        refresh();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setStatus = useCallback(async (val: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("user_settings")
      .upsert({ user_id: u.user.id, tutorial_completed: val }, { onConflict: "user_id" });
    writeCache(val);
    setCompleted(val);
  }, []);

  return {
    completed,
    markComplete: () => setStatus(true),
    reset: () => setStatus(false),
  };
}
