import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { useAnnouncement, type Announcement } from "@/lib/announcement";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ledgerly:announcement-dismissed";

const VARIANTS: Record<string, { wrap: string; icon: typeof Info }> = {
  info: { wrap: "border-primary/30 bg-primary/10 text-foreground", icon: Info },
  warning: {
    wrap: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
  },
  critical: {
    wrap: "border-destructive/40 bg-destructive/10 text-destructive",
    icon: Megaphone,
  },
};

/** Static presentation — also used by the admin live preview. */
export function AnnouncementBody({
  announcement,
  onDismiss,
  className,
}: {
  announcement: Pick<Announcement, "title" | "message" | "variant">;
  onDismiss?: () => void;
  className?: string;
}) {
  const v = VARIANTS[announcement.variant] ?? VARIANTS["info"]!;
  const Icon = v.icon;
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-3", v.wrap, className)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {announcement.title && <p className="text-sm font-semibold">{announcement.title}</p>}
        <p className="text-sm leading-relaxed opacity-90 whitespace-pre-line">
          {announcement.message}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Site-wide notice controlled by admins. Dismissal is keyed to `updated_at`
 * so an edited message reappears for everyone.
 */
export function AnnouncementBanner({ className }: { className?: string }) {
  const { data } = useAnnouncement();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  if (!data?.enabled || !data.message.trim()) return null;
  if (dismissed === data.updated_at) return null;

  return (
    <AnnouncementBody
      announcement={data}
      className={className}
      onDismiss={() => {
        try {
          localStorage.setItem(STORAGE_KEY, data.updated_at);
        } catch {
          /* ignore */
        }
        setDismissed(data.updated_at);
      }}
    />
  );
}
