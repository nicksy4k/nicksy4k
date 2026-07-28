import { format, parseISO } from "date-fns";
import { changelog } from "@/lib/changelog";
import { Badge } from "@/components/ui/badge";

interface Props {
  compact?: boolean;
}

export function ChangelogList({ compact = false }: Props) {
  return (
    <ol className="space-y-6">
      {changelog.map((entry) => {
        const Icon = entry.icon;
        return (
          <li
            key={entry.version}
            className="relative pl-10 border-l border-border/60 ml-4"
          >
            <span className="absolute -left-[13px] top-0 h-6 w-6 rounded-full bg-primary/15 ring-2 ring-background grid place-items-center">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {entry.version}
              </Badge>
              <span className="text-sm font-medium">{entry.title}</span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(entry.date), "d MMM yyyy")}
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {(compact ? entry.highlights.slice(0, 2) : entry.highlights).map(
                (h, i) => (
                  <li key={i}>{h}</li>
                ),
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
