import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Eye, RefreshCw, Monitor, Smartphone, Tablet } from "lucide-react";

interface DemoSessionRow {
  id: string;
  started_at: string;
  referrer: string | null;
  landing_path: string | null;
  device_type: string | null;
  platform: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  country: string | null;
  user_agent: string | null;
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (type === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

function referrerLabel(referrer: string | null) {
  if (!referrer) return "Direct / unknown";
  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

/** Admin-only: recent visits to the shared demo account. */
export function DemoSessionLogCard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["demo-sessions"],
    queryFn: async (): Promise<DemoSessionRow[]> => {
      const { data, error } = await supabase
        .from("demo_sessions")
        .select(
          "id, started_at, referrer, landing_path, device_type, platform, language, timezone, screen, country, user_agent",
        )
        .order("started_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as DemoSessionRow[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Demo session log
          </CardTitle>
          <CardDescription>
            Every time someone opens the demo sandbox, with where they came from and what they used.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh demo session log"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No demo visits recorded yet.</p>
        ) : (
          data.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border/60 p-3 text-sm space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {new Date(row.started_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <Badge variant="secondary" className="gap-1">
                  <DeviceIcon type={row.device_type} />
                  {row.device_type ?? "unknown"}
                </Badge>
                {row.country ? <Badge variant="outline">{row.country}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground break-words">
                From: {referrerLabel(row.referrer)}
                {row.landing_path ? ` · landed on ${row.landing_path}` : ""}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {[row.platform, row.screen, row.language, row.timezone]
                  .filter(Boolean)
                  .join(" · ") || "No device details"}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
