import { format } from "date-fns";
import { Label } from "@/components/ui/label";

export const BILL_POCKET = "Bill Money";

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
