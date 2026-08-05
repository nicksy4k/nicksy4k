import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The single shared demo account. Kept here so client + server agree. */
export const DEMO_EMAIL = "demo@itemizedkeeper.co.uk";

/** True when the current session belongs to the shared demo account. */
export function useIsDemoUser(): boolean {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setIsDemo((data.user?.email ?? "").toLowerCase() === DEMO_EMAIL);
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIsDemo((session?.user?.email ?? "").toLowerCase() === DEMO_EMAIL);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isDemo;
}

/** App-wide kill switch: can the demo account use the AI receipt scanner? */
export const DEMO_SCANNER_FLAG = "demo_ai_scanner_enabled";

export function useDemoScannerFlag() {
  return useQuery({
    queryKey: ["app-flag", DEMO_SCANNER_FLAG],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("app_flags")
        .select("enabled")
        .eq("key", DEMO_SCANNER_FLAG)
        .maybeSingle();
      if (error) return false;
      return Boolean(data?.enabled);
    },
  });
}
