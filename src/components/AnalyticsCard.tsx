import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { useAnalyticsConsent } from "@/lib/analytics";

/** Lets people turn opt-in Google Analytics on or off after their first choice. */
export function AnalyticsCard() {
  const { consent, setConsent, available } = useAnalyticsConsent();

  if (!available) return null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Anonymous usage analytics
        </CardTitle>
        <CardDescription>
          Optional. When on, Google Analytics records which pages and features get used — never
          amounts, names or anything you've typed. See the{" "}
          <Link to="/cookies" className="text-primary hover:underline">
            Cookie Notice
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="analytics-consent" className="text-sm font-normal text-muted-foreground">
          {consent === "granted" ? "Analytics is on" : "Analytics is off"}
        </Label>
        <Switch
          id="analytics-consent"
          checked={consent === "granted"}
          onCheckedChange={(v) => setConsent(v ? "granted" : "denied")}
        />
      </CardContent>
    </Card>
  );
}
