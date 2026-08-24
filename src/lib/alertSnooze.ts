import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent snooze / dismiss state for dashboard alert rows.
 *
 * Every alert gets a stable string key. Keys embed the thing that made the
 * alert appear (a due date, a promo end date) so a *new* occurrence of the
 * same item surfaces again instead of staying hidden forever.
 */
export type AlertSnooze = {
  alert_key: string;
  snoozed_until: string | null;
  dismissed: boolean;
};

export const alertKeys = {
  protection: (txnId: string) => `protection:${txnId}`,
  due: (commitmentId: string, dueDate: string | null | undefined) =>
    `due:${commitmentId}:${dueDate ?? "none"}`,
  promo: (commitmentId: string, promoEndsOn: string | null | undefined) =>
    `promo:${commitmentId}:${promoEndsOn ?? "none"}`,
  deliveries: () => "deliveries",
};

/** Snooze presets offered in the row menu. */
export const SNOOZE_OPTIONS = [
  { label: "Snooze 1 day", days: 1 },
  { label: "Snooze 3 days", days: 3 },
  { label: "Snooze 1 week", days: 7 },
] as const;

export function useAlertSnoozes() {
  const qc = useQueryClient();

  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["alert-snoozes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_snoozes")
        .select("alert_key, snoozed_until, dismissed");
      if (error) throw error;
      return (data ?? []) as unknown as AlertSnooze[];
    },
  });

  const rows = data ?? [];

  const map = useMemo(() => {
    const m = new Map<string, AlertSnooze>();
    rows.forEach((r) => m.set(r.alert_key, r));
    return m;
  }, [rows]);

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ["alert-snoozes"] }),
    [qc],
  );

  const upsert = useMutation({
    mutationFn: async (row: { alert_key: string; snoozed_until: string | null; dismissed: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("alert_snoozes")
        .upsert({ user_id: u.user.id, ...row } as never, { onConflict: "user_id,alert_key" });
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const clear = useMutation({
    mutationFn: async (alertKey: string) => {
      const { error } = await supabase.from("alert_snoozes").delete().eq("alert_key", alertKey);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  /** True while the alert should stay hidden. */
  const isHidden = useCallback(
    (key: string, now: Date = new Date()) => {
      const row = map.get(key);
      if (!row) return false;
      if (row.dismissed) return true;
      return !!row.snoozed_until && new Date(row.snoozed_until).getTime() > now.getTime();
    },
    [map],
  );

  const snooze = useCallback(
    (key: string, days: number) =>
      upsert.mutateAsync({
        alert_key: key,
        snoozed_until: addDays(new Date(), days).toISOString(),
        dismissed: false,
      }),
    [upsert],
  );

  const dismissForever = useCallback(
    (key: string) => upsert.mutateAsync({ alert_key: key, snoozed_until: null, dismissed: true }),
    [upsert],
  );

  const restore = useCallback((key: string) => clear.mutateAsync(key), [clear]);

  return { rows, isHidden, snooze, dismissForever, restore };
}
