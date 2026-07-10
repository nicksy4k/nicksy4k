import { useMemo } from "react";
import { useSavings } from "@/lib/store";
import { fmt, todayLocalISO } from "@/lib/format";
import { colorForKey } from "@/lib/colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface BnplDetails {
  name: string;
  installments: string;
  firstDate: string;
  cadence: "weekly" | "fortnightly" | "monthly";
  /** When true, installment #1 is deducted today and removed from the debt. */
  firstPaymentToday: boolean;
  /** Source for the today-deducted first installment. "main" | "pocket:<name>" */
  firstSource: string;
}

export interface SplitDraft {
  id: string;
  /** "main" | "pocket:<name>" | "bnpl:new" | "other" */
  source: string;
  amount: string;
  bnpl?: BnplDetails;
}

export function emptySplit(source = "main"): SplitDraft {
  return { id: crypto.randomUUID(), source, amount: "" };
}

export function defaultBnpl(retailer: string, firstDate: string): BnplDetails {
  return {
    name: retailer.trim() ? `${retailer.trim()} – BNPL` : "BNPL plan",
    installments: "4",
    firstDate,
    cadence: "fortnightly",
    firstPaymentToday: false,
    firstSource: "main",
  };
}

export function generateInstallmentDates(
  firstDate: string,
  count: number,
  cadence: BnplDetails["cadence"],
): string[] {
  const out: string[] = [];
  const [y, m, d] = firstDate.split("-").map(Number);
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    if (cadence === "weekly") dt.setDate(dt.getDate() + 7 * i);
    else if (cadence === "fortnightly") dt.setDate(dt.getDate() + 14 * i);
    else dt.setMonth(dt.getMonth() + i);
    out.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

interface Props {
  total: number;
  retailer: string;
  transactionDate: string;
  splits: SplitDraft[];
  onChange: (splits: SplitDraft[]) => void;
  /** When false, hides the "BNPL (new plan)" source option. */
  allowBnpl?: boolean;
}

export function PaymentSplitEditor({ total, retailer, transactionDate, splits, onChange, allowBnpl = true }: Props) {
  const { items: savings } = useSavings();

  const pockets = useMemo(() => {
    const map = new Map<string, number>();
    savings.forEach((s) => {
      const d = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + d);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [savings]);

  const allocated = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = +(total - allocated).toFixed(2);

  const update = (id: string, patch: Partial<SplitDraft>) =>
    onChange(splits.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updateBnpl = (id: string, patch: Partial<BnplDetails>) =>
    onChange(
      splits.map((s) =>
        s.id === id
          ? { ...s, bnpl: { ...(s.bnpl ?? defaultBnpl(retailer, transactionDate)), ...patch } }
          : s,
      ),
    );

  const remove = (id: string) => onChange(splits.filter((s) => s.id !== id));
  const add = () => onChange([...splits, emptySplit("main")]);

  function handleSourceChange(id: string, newSource: string) {
    const patch: Partial<SplitDraft> = { source: newSource };
    if (newSource === "bnpl:new") {
      patch.bnpl = defaultBnpl(retailer, transactionDate);
    } else {
      patch.bnpl = undefined;
    }
    update(id, patch);
  }

  return (
    <div className="space-y-3">
      {splits.map((s, idx) => {
        const isPocket = s.source.startsWith("pocket:");
        const pocketName = isPocket ? s.source.slice(7) : null;
        return (
          <div key={s.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Source {idx + 1}
                </Label>
                <Select value={s.source} onValueChange={(v) => handleSourceChange(s.id, v)}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className="flex items-center gap-2 min-w-0">
                        {pocketName && (
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: colorForKey(pocketName) }}
                          />
                        )}
                        <span className="truncate">
                          {s.source === "main"
                            ? "Main balance"
                            : s.source === "bnpl:new"
                            ? "BNPL (new plan)"
                            : s.source === "other"
                            ? "Other (not deducted)"
                            : `Pocket · ${pocketName}`}
                        </span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main balance</SelectItem>
                    {pockets.map(([name, bal]) => (
                      <SelectItem key={name} value={`pocket:${name}`}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: colorForKey(name) }}
                          />
                          Pocket · {name}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            ({fmt(bal)})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                    {allowBnpl && <SelectItem value="bnpl:new">BNPL (new plan)</SelectItem>}
                    <SelectItem value="other">Other (not deducted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount (£)
                </Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={s.amount}
                  onChange={(e) => update(s.id, { amount: e.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(s.id)}
                disabled={splits.length === 1}
                aria-label="Remove split"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {s.source === "bnpl:new" && s.bnpl && (
              <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  New BNPL plan
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Plan name</Label>
                    <Input
                      value={s.bnpl.name}
                      onChange={(e) => updateBnpl(s.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Installments</Label>
                    <Input
                      inputMode="numeric"
                      value={s.bnpl.installments}
                      onChange={(e) => updateBnpl(s.id, { installments: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">First payment date</Label>
                    <Input
                      type="date"
                      value={s.bnpl.firstDate}
                      onChange={(e) => updateBnpl(s.id, { firstDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cadence</Label>
                    <Select
                      value={s.bnpl.cadence}
                      onValueChange={(v) =>
                        updateBnpl(s.id, { cadence: v as BnplDetails["cadence"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="min-w-0">
                    <Label className="text-sm">First payment due today</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      For "Pay in 4" plans (Clearpay, Klarna). Installment #1 is
                      deducted today; the debt covers the remaining installments.
                    </p>
                  </div>
                  <Switch
                    checked={s.bnpl.firstPaymentToday}
                    onCheckedChange={(v) =>
                      updateBnpl(s.id, {
                        firstPaymentToday: v,
                        firstDate: v ? todayLocalISO() : s.bnpl!.firstDate,
                      })
                    }
                  />
                </div>

                {s.bnpl.firstPaymentToday && (() => {
                  const splitAmt = parseFloat(s.amount) || 0;
                  const n = Math.max(1, parseInt(s.bnpl.installments, 10) || 1);
                  const firstAmt = +(splitAmt / n).toFixed(2);
                  const remaining = +(splitAmt - firstAmt).toFixed(2);
                  return (
                    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">First installment paid from</Label>
                        <Select
                          value={s.bnpl!.firstSource}
                          onValueChange={(v) => updateBnpl(s.id, { firstSource: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">Main balance</SelectItem>
                            {pockets.map(([name]) => (
                              <SelectItem key={name} value={`pocket:${name}`}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-sm"
                                    style={{ backgroundColor: colorForKey(name) }}
                                  />
                                  Pocket · {name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Today: <span className="font-medium text-foreground">{fmt(firstAmt)}</span>
                        {" · "}Debt: <span className="font-medium text-foreground">{n - 1} × {fmt(+(remaining / Math.max(1, n - 1)).toFixed(2))}</span>
                        {" "}({fmt(remaining)} total)
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-4 w-4" /> Add another source
      </Button>

      <div className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3 text-sm">
        <div className="flex items-center gap-4">
          <span>
            <span className="text-muted-foreground">Allocated</span>{" "}
            <span className="tabular-nums font-medium">{fmt(allocated)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">of</span>{" "}
            <span className="tabular-nums font-medium">{fmt(total)}</span>
          </span>
        </div>
        <span
          className={
            remainder === 0
              ? "text-primary"
              : remainder < 0
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          {remainder === 0
            ? "Fully allocated"
            : remainder > 0
            ? `Remainder ${fmt(remainder)} → Main balance`
            : `Over-allocated by ${fmt(Math.abs(remainder))}`}
        </span>
      </div>
    </div>
  );
}
