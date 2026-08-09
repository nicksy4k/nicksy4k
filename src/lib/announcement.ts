import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnnouncementVariant = "info" | "warning" | "critical";

export interface Announcement {
  enabled: boolean;
  title: string;
  message: string;
  variant: AnnouncementVariant;
  updated_at: string;
}

export const ANNOUNCEMENT_KEY = ["app-announcement"] as const;

/** Global site notice — readable by everyone, editable by admins only. */
export function useAnnouncement() {
  return useQuery({
    queryKey: ANNOUNCEMENT_KEY,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Announcement | null> => {
      const { data, error } = await supabase
        .from("app_announcements")
        .select("enabled, title, message, variant, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        enabled: Boolean(data.enabled),
        title: data.title ?? "",
        message: data.message ?? "",
        variant: (data.variant as AnnouncementVariant) ?? "info",
        updated_at: data.updated_at,
      };
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Announcement, "updated_at">>) => {
      const { error } = await supabase.from("app_announcements").update(patch).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ANNOUNCEMENT_KEY }),
  });
}
