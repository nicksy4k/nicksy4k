import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { updateSafeSplit, useSafeSplit } from "@/lib/safeSplit";

export function SafeSplitSettingsCard() {
  const s = useSafeSplit();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keep-safe & play split</CardTitle>
        <CardDescription>
          Splits what's left to spend into a safety net for surprises and guilt-free play money. Only
          changes what you see — your balances are never touched. Turn off anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Show on dashboard</span>
          <Switch checked={s.enabled} onCheckedChange={(v) => updateSafeSplit({ enabled: v })} />
        </div>
        {s.enabled && (
          <>
            <div className="space-y-2">
              <p className="text-sm">
                Keep safe <strong>{s.keepPct}%</strong> · Play <strong>{100 - s.keepPct}%</strong>
              </p>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[s.keepPct]}
                onValueChange={([v]) => updateSafeSplit({ keepPct: v })}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => updateSafeSplit({ targets: {} })}>
              Apply new split to this cycle
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
