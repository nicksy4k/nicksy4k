import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "ledgerly.onboarding.completed";

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

/**
 * Reactive onboarding-completion flag, persisted per-user on `user_settings`.
 * `completed = null` means "still loading" — callers should not redirect yet.
 */
export function useOnboardingStatus() {
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
        .select("onboarding_completed")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const val = (data?.onboarding_completed as boolean | undefined) ?? false;
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
      .upsert(
        { user_id: u.user.id, onboarding_completed: val },
        { onConflict: "user_id" },
      );
    writeCache(val);
    setCompleted(val);
  }, []);

  return { completed, markComplete: () => setStatus(true), reset: () => setStatus(false) };
}
