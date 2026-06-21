import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PROTECTION_TYPES,
  PROTECTION_DURATIONS,
  computeExpiration,
  type ProtectionDuration,
  type ProtectionType,
} from "@/lib/protection";

export interface ProtectionValue {
  enabled: boolean;
  type: ProtectionType;
  duration: ProtectionDuration;
  /** yyyy-mm-dd */
  expiration: string;
}

export const emptyProtection = (): ProtectionValue => ({
  enabled: false,
  type: "Return Window",
  duration: "30 Days",
  expiration: "",
});

interface Props {
  transactionDate: string;
  value: ProtectionValue;
  onChange: (next: ProtectionValue) => void;
}

export function ProtectionFields({ transactionDate, value, onChange }: Props) {
  useEffect(() => {
    if (!value.enabled) return;
    if (value.duration === "Custom Date") return;
    const next = computeExpiration(transactionDate, value.duration);
    if (next && next !== value.expiration) {
      onChange({ ...value, expiration: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionDate, value.duration, value.enabled]);

  const isCustom = value.duration === "Custom Date";
  const dateInvalid =
    isCustom && !!value.expiration && !!transactionDate && value.expiration < transactionDate;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm">Add protection / warranty</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track return windows and warranties — alerts surface on your dashboard.
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
      </div>

      {value.enabled && (
        <div className="space-y-3 pt-1">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={value.type}
                onValueChange={(v) => onChange({ ...value, type: v as ProtectionType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROTECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Duration">
              <Select
                value={value.duration}
                onValueChange={(v) => onChange({ ...value, duration: v as ProtectionDuration })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROTECTION_DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={isCustom ? "Expiration date" : "Expires on (auto)"}>
            <Input
              type="date"
              value={value.expiration}
              min={transactionDate || undefined}
              disabled={!isCustom}
              onChange={(e) => onChange({ ...value, expiration: e.target.value })}
            />
            {dateInvalid && (
              <p className="text-xs text-destructive mt-1">
                Expiration must be on or after the transaction date.
              </p>
            )}
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
