import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder rows shown while a list is still loading, so pages never flash
 * their "nothing here yet" empty state at users who do have data.
 */
export function ListSkeleton({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 py-2 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
