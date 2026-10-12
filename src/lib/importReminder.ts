import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCycle, useCycleSettings } from "@/lib/cycle";

export type ImportReminderMode = "off" | "cycle" | "interval";

export interface ImportReminderSettings {
  mode: ImportReminderMode;
  /** "cycle": days before cycle end. "interval": days between imports. */
  days: number;
}

export const DEFAULT_IMPORT_REMINDER: ImportReminderSettings = { mode: "cycle", days: 2 };

export interface ImportReminderDue {
  key: string;
  title: string;
  detail: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Pure due-check. `lastImportISO` is the date (yyyy-MM-dd) of the latest
 * non-undone import, or null if the user has never imported.
 */
export function importReminderDue(
  s: ImportReminderSettings,
  cycleEndISO: string,
  lastImportISO: string | null,
  today: Date = new Date(),
): ImportReminderDue | null {
  const t = startOfDay(today);
  const days = Math.max(1, Math.round(s.days || 1));
  const lastTxt = lastImportISO
    ? `Last imported ${format(parseISO(lastImportISO), "d MMM")}.`
    : "You haven't imported a statement yet.";

  if (s.mode === "cycle") {
    const end = startOfDay(parseISO(cycleEndISO));
    const windowStart = addDays(end, -(days - 1));
    if (t < windowStart || t > end) return null;
    if (lastImportISO && parseISO(lastImportISO) >= windowStart) return null;
    const left = differenceInCalendarDays(end, t);
    return {
      key: `import:cycle:${cycleEndISO}`,
      title:
        left === 0 ? "Cycle ends today" : `Cycle ends in ${left} day${left === 1 ? "" : "s"}`,
      detail: `Import your latest bank statement so your balances and carryover are spot on. ${lastTxt}`,
    };
  }

  if (s.mode === "interval") {
    const dueDate = lastImportISO ? addDays(parseISO(lastImportISO), days) : t;
    if (t < startOfDay(dueDate)) return null;
    return {
      key: `import:interval:${iso(dueDate)}`,
      title: "Time to import your bank statement",
      detail: `Catch anything you haven't logged yet. ${lastTxt}`,
    };
  }
  return null;
}

export function useImportReminderSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["import-reminder-settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<ImportReminderSettings> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return DEFAULT_IMPORT_REMINDER;
      const { data } = await supabase
        .from("user_settings")
        .select("import_reminder_mode, import_reminder_days")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!data) return DEFAULT_IMPORT_REMINDER;
      return {
        mode: (data.import_reminder_mode as ImportReminderMode) ?? "cycle",
        days: data.import_reminder_days ?? 2,
      };
    },
  });
  const save = useMutation({
    mutationFn: async (next: ImportReminderSettings) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_settings")
        .update({ import_reminder_mode: next.mode, import_reminder_days: next.days })
        .eq("user_id", u.user.id);
      if (error) throw error;
    },
    onMutate: (next) => qc.setQueryData(["import-reminder-settings"], next),
    onSettled: () => qc.invalidateQueries({ queryKey: ["import-reminder-settings"] }),
  });
  return { settings: q.data ?? DEFAULT_IMPORT_REMINDER, save: save.mutateAsync };
}

/** Returns the reminder to show on the dashboard right now, if any. */
export function useImportReminder(): ImportReminderDue | null {
  const { settings } = useImportReminderSettings();
  const { settings: cycleSettings } = useCycleSettings();
  const { data: last } = useQuery({
    queryKey: ["import_batches", "latest"],
    staleTime: 60_000,
    enabled: settings.mode !== "off",
    queryFn: async () => {
      const { data } = await supabase
        .from("import_batches")
        .select("created_at")
        .is("undone_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      return row ? iso(new Date(row.created_at)) : null;
    },
  });
  if (settings.mode === "off" || last === undefined) return null;
  const cycle = getActiveCycle(cycleSettings);
  return importReminderDue(settings, cycle.endISO, last);
}
