import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CycleSettings,
  type CycleType,
  getActiveCycle,
  previousCycleWindow,
  useCycleSettings,
} from "@/lib/cycle";
import { syncCarryover } from "@/lib/carryover";
import { fmt } from "@/lib/format";

export function CycleSettingsCard() {
  const { settings, update } = useCycleSettings();
  const qc = useQueryClient();
  const [recalcing, setRecalcing] = useState(false);
  const prevWindow = previousCycleWindow(settings);

  async function recalc() {
    setRecalcing(true);
    try {
      const res = await syncCarryover(settings);
      qc.invalidateQueries({ queryKey: ["incomes"] });
      if (res.action === "corrected") {
        toast.success(`Carryover corrected to ${fmt(res.amount)}`, {
          description: `Was ${fmt(res.previous ?? 0)} — recalculated from ${res.windowLabel}.`,
        });
      } else if (res.action === "inserted") {
        toast.success(`Carryover of ${fmt(res.amount)} added`);
      } else {
        toast.success("Carryover is already up to date");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't recalculate the carryover");
    } finally {
      setRecalcing(false);
    }
  }

  const [type, setType] = useState<CycleType>(settings.type);
  const [anchor, setAnchor] = useState(settings.anchor);
  const [overrideOn, setOverrideOn] = useState(Boolean(settings.override));
  const [carryover, setCarryover] = useState(settings.carryoverEnabled);
  const active = getActiveCycle(settings);
  const [ovStart, setOvStart] = useState(settings.override?.startISO ?? active.startISO);
  const [ovEnd, setOvEnd] = useState(settings.override?.endISO ?? active.endISO);

  // Resync local state when settings change externally.
  useEffect(() => {
    setType(settings.type);
    setAnchor(settings.anchor);
    setOverrideOn(Boolean(settings.override));
    setCarryover(settings.carryoverEnabled);
    if (settings.override) {
      setOvStart(settings.override.startISO);
      setOvEnd(settings.override.endISO);
    }
  }, [settings]);

  function save() {
    if (!anchor) {
      toast.error("Pick a cycle anchor date.");
      return;
    }
    let override: CycleSettings["override"] = null;
    if (overrideOn) {
      if (!ovStart || !ovEnd || ovEnd < ovStart) {
        toast.error("Override end must be on or after start.");
        return;
      }
      override = { startISO: ovStart, endISO: ovEnd };
    }
    update({
      ...settings,
      type,
      anchor,
      override,
      carryoverEnabled: carryover,
    });
    toast.success("Cycle settings saved");
  }

  // Preview the cycle that WILL be active with the staged values.
  const preview = getActiveCycle({
    ...settings,
    type,
    anchor: anchor || settings.anchor,
    override: overrideOn ? { startISO: ovStart, endISO: ovEnd } : null,
    carryoverEnabled: carryover,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Cycle settings</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drives every dashboard summary, chart, and bill window.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cycle type">
            <Select value={type} onValueChange={(v) => setType(v as CycleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly (calendar)</SelectItem>
                <SelectItem value="four-weekly">4-Weekly (rolling 28 days)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cycle anchor date">
            <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cycle-override" className="text-sm">
                Override current cycle
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manually pick the active window — bypasses auto-calculation.
              </p>
            </div>
            <Switch id="cycle-override" checked={overrideOn} onCheckedChange={setOverrideOn} />
          </div>
          {overrideOn && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Start">
                <Input type="date" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
              </Field>
              <Field label="End">
                <Input type="date" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="cycle-carryover" className="text-sm">
                Carry unspent balance into next cycle
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When a new cycle starts, your remaining "Left to spend" is added as a Carryover
                income entry. Overspends carry as a negative entry.
              </p>
            </div>
            <Switch id="cycle-carryover" checked={carryover} onCheckedChange={setCarryover} />
          </div>
          {carryover && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Checked against {format(parseISO(prevWindow.startISO), "d MMM")} –{" "}
                {format(parseISO(prevWindow.endISO), "d MMM")}. Recheck if you've edited anything
                from that window.
              </p>
              <Button variant="outline" size="sm" onClick={recalc} disabled={recalcing}>
                {recalcing ? "Checking…" : "Recalculate carryover"}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Active window: </span>
          <span className="font-medium tabular-nums">
            {format(parseISO(preview.startISO), "d MMM yyyy")} –{" "}
            {format(parseISO(preview.endISO), "d MMM yyyy")}
          </span>
          {preview.isOverridden && <span className="ml-2 text-xs text-amber-600">· override</span>}
        </div>

        <div className="flex justify-end">
          <Button onClick={save}>Save cycle settings</Button>
        </div>
      </CardContent>
    </Card>
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
