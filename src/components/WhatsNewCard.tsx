import { useEffect, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowRight, Sparkles, X } from "lucide-react";
import {
  changelog,
  currentVersion,
  getLastSeenVersion,
  hasUnseenChanges,
  markChangelogSeen,
} from "@/lib/changelog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChangelogDialogTrigger } from "@/components/ChangelogDialog";

export function WhatsNewCard() {
  const [hasNew, setHasNew] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const top = changelog.slice(0, 3);

  useEffect(() => {
    setHasNew(hasUnseenChanges());
    setLastSeen(getLastSeenVersion());
  }, []);

  const dismiss = () => {
    markChangelogSeen();
    setHasNew(false);
    setLastSeen(currentVersion);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">What's new</p>
                {hasNew && (
                  <span
                    className="h-2 w-2 rounded-full bg-primary"
                    aria-label="Unread changes"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastSeen
                  ? `You last checked at ${lastSeen}`
                  : "Latest updates to Ledgerly"}
              </p>
            </div>
          </div>
          {hasNew && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground"
              onClick={dismiss}
              aria-label="Mark as seen"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ul className="space-y-3">
          {top.map((entry) => (
            <li
              key={entry.version}
              className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/60 p-3"
            >
              <Badge variant="secondary" className="font-mono text-[10px] shrink-0 mt-0.5">
                {entry.version}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  <span
                    className="text-[10px] text-muted-foreground shrink-0"
                    title={format(parseISO(entry.date), "d MMM yyyy")}
                  >
                    {formatDistanceToNow(parseISO(entry.date), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {entry.highlights[0]}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <ChangelogDialogTrigger onOpen={dismiss}>
            <Button size="sm" className="gap-1.5">
              See all changes <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </ChangelogDialogTrigger>
          {hasNew && (
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Got it
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
