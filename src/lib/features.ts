import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsDemoUser, useDemoScannerFlag } from "@/lib/demoAccount";

export type AppRole = "admin" | "beta" | "user";

/**
 * Feature flags.
 *
 * `requiredRoles: null` means "available to every signed-in user".
 * To open a feature up later, widen the array (e.g. ["admin", "beta"]) or
 * set it to null — no other code needs to change. The server re-checks the
 * same rule, so the UI flag is convenience only.
 */
export const FEATURES = {
  /** AI receipt scanner — admin-only preview while it burns AI credits. */
  receiptScan: { requiredRoles: ["admin"] as AppRole[] | null },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole[]> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (error) return [];
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useFeature(key: FeatureKey): boolean {
  const required = FEATURES[key].requiredRoles as AppRole[] | null;
  const { data: roles } = useUserRoles();
  if (required === null) return true;
  if (!roles) return false;
  return roles.some((r) => required.includes(r));
}

/**
 * Convenience wrapper used by the transaction forms.
 *
 * Admins always have access. The shared demo account additionally gets access
 * while the `demo_ai_scanner_enabled` kill switch is ON (admin-controlled).
 */
export function useCanScanReceipts(): boolean {
  const byRole = useFeature("receiptScan");
  const isDemo = useIsDemoUser();
  const { data: demoFlag } = useDemoScannerFlag();
  return byRole || (isDemo && demoFlag === true);
}
