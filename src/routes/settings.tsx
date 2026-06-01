import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTransactions } from "@/lib/store";
import { Database, Trash2, Download } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Ledgerly" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { items, clear } = useTransactions();

  function exportJson() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgerly-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Preferences</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Settings</h1>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Database className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Storage</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Currently using local browser storage</p>
              </div>
            </div>
            <Badge variant="secondary">localStorage</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">Connecting to Supabase</p>
              <p className="text-muted-foreground">
                Your data is stored on this device only. To sync across devices and back up your history, connect a Supabase project. The data shape in <code className="text-xs bg-background px-1.5 py-0.5 rounded">src/lib/types.ts</code> already mirrors what you'll need as two tables:
              </p>
              <ul className="text-muted-foreground text-xs list-disc list-inside space-y-1 ml-1">
                <li><code className="text-xs">transactions</code> — id, date, retailer, total_amount, receipt_attached, receipt_type, receipt_location, notes</li>
                <li><code className="text-xs">line_items</code> — id, transaction_id (fk), item_name, price, category, return_window_expiry, notes</li>
              </ul>
              <p className="text-muted-foreground pt-1">
                Then swap the implementation in <code className="text-xs bg-background px-1.5 py-0.5 rounded">src/lib/store.ts</code> to read/write through your Supabase client — the UI doesn't need to change.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportJson} disabled={items.length === 0}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive" disabled={items.length === 0}>
                    <Trash2 className="h-4 w-4" /> Clear all data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all transactions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete every transaction and line item from this browser. Export first if you want a backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { clear(); toast.success("All data cleared"); }}>Clear everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>About</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Ledgerly is an itemized expense & receipt tracker. Log a transaction once, break it down into the actual things you bought, and never lose track of return windows or where you stashed the receipt.</p>
            <p>{items.length} transaction{items.length !== 1 ? "s" : ""} on this device.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
