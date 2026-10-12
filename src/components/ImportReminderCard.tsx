import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImportReminderSettings, type ImportReminderMode } from "@/lib/importReminder";

const INTERVAL_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Fortnightly", days: 14 },
  { label: "Monthly", days: 30 },
];

/** Settings for the "import your bank statement" dashboard reminder. */
export function ImportReminderCard() {
  const { settings, save } = useImportReminderSettings();

  const update = (mode: ImportReminderMode, days: number) => {
    save({ mode, days: Math.min(90, Math.max(1, Math.round(days) || 1)) })
      .then(() => toast.success("Reminder updated"))
      .catch(() => toast.error("Couldn't save reminder"));
  };

  const onMode = (m: string) => {
    const mode = m as ImportReminderMode;
    update(mode, mode === "interval" ? 7 : mode === "cycle" ? 2 : settings.days);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <CardTitle>Bank statement reminder</CardTitle>
          <CardDescription>
            A nudge on your dashboard to import an up-to-date statement. It clears as soon as you
            import.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Remind me</Label>
          <Select value={settings.mode} onValueChange={onMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cycle">Before my cycle ends</SelectItem>
              <SelectItem value="interval">On a regular schedule</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {settings.mode === "cycle" && (
          <div className="space-y-2">
            <Label>How many days before</Label>
            <Select
              value={String(settings.days)}
              onValueChange={(v) => update("cycle", Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 7].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 1 ? "On the last day" : `${d} days before`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {settings.mode === "interval" && (
          <div className="space-y-2">
            <Label htmlFor="import-every">Every (days)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="import-every"
                type="number"
                min={1}
                max={90}
                className="w-24"
                key={settings.days}
                defaultValue={settings.days}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n !== settings.days) update("interval", n);
                }}
              />
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => update("interval", p.days)}
                  className={`rounded-full border px-3 text-xs ${
                    settings.days === p.days
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
