import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_EMAIL, DEMO_SCANNER_FLAG, useDemoScannerFlag } from "@/lib/demoAccount";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/** Admin-only global switches. Writes are enforced by RLS (`has_role`). */
export function AdminDemoCard() {
  const { data: enabled, isLoading } = useDemoScannerFlag();
  const qc = useQueryClient();

  async function toggle(next: boolean) {
    const { error } = await supabase
      .from("app_flags")
      .update({ enabled: next })
      .eq("key", DEMO_SCANNER_FLAG);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["app-flag", DEMO_SCANNER_FLAG] });
    toast.success(next ? "AI scanner enabled for the demo account." : "AI scanner disabled for the demo account.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Demo account controls
        </CardTitle>
        <CardDescription>
          Global switches for the shared demo account ({DEMO_EMAIL}). Only admins can change these.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="demo-ai" className="text-sm font-medium">
              Enable AI Scanner for Demo Account
            </Label>
            <p className="text-xs text-muted-foreground max-w-md">
              When off, the AI receipt scanner is completely hidden for the demo account — protecting your
              AI credits. Demo uploads are never kept: the file is deleted straight after the scan.
            </p>
          </div>
          <Switch
            id="demo-ai"
            checked={Boolean(enabled)}
            disabled={isLoading}
            onCheckedChange={toggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
