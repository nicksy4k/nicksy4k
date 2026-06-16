import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  type CycleSettings, type CycleType,
  getActiveCycle, useCycleSettings,
} from "@/lib/cycle";

export function CycleSettingsCard() {
  const { settings, update } = useCycleSettings();
  const [type, setType] = useState<CycleType>(settings.type);
  const [anchor, setAnchor] = useState(settings.anchor);
  const [overrideOn, setOverrideOn] = useState(Boolean(settings.override));
  const active = getActiveCycle(settings);
  const [ovStart, setOvStart] = useState(settings.override?.startISO ?? active.startISO);
  const [ovEnd, setOvEnd] = useState(settings.override?.endISO ?? active.endISO);

  // Resync local state when settings change externally.
  useEffect(() => {
    setType(settings.type);
    setAnchor(settings.anchor);
    setOverrideOn(Boolean(settings.override));
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
    update({ type, anchor, override });
    toast.success("Cycle settings saved");
  }

  // Preview the cycle that WILL be active with the staged values.
  const preview = getActiveCycle({
    type,
    anchor: anchor || settings.anchor,
    override: overrideOn ? { startISO: ovStart, endISO: ovEnd } : null,
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label htmlFor="cycle-override" className="text-sm">Override current cycle</Label>
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

        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Active window: </span>
          <span className="font-medium tabular-nums">
            {format(parseISO(preview.startISO), "d MMM yyyy")} – {format(parseISO(preview.endISO), "d MMM yyyy")}
          </span>
          {preview.isOverridden && (
            <span className="ml-2 text-xs text-amber-600">· override</span>
          )}
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
