import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTransactions, useIncomes, useSavings,
  useCategories, useIncomeCategories, clearAllData,
} from "@/lib/store";
import { useHiddenSuggestions } from "@/lib/hiddenSuggestions";
import { sortLabels } from "@/lib/utils";
import { Database, Trash2, Download, Plus, X, RotateCcw, Tag, EyeOff, Eye, Store, Package, Settings2, CalendarCog, Sparkles, HardDrive, Code, Rocket, Wallet, Zap, Mail, Compass } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useOnboardingStatus } from "@/lib/onboarding";
import { markTutorialPending, useTutorialStatus } from "@/lib/tutorial";
import { useTutorial } from "@/components/tutorial/TutorialProvider";
import { dashboardTourSteps } from "@/lib/dashboardTourSteps";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { CycleSettingsCard } from "@/components/CycleSettingsCard";
import { SmartCleanupDialog } from "@/components/SmartCleanupDialog";
import { filterHidden } from "@/lib/hiddenSuggestions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ledgerly" },
      { name: "description", content: "Manage your Ledgerly cycle, categories, suggestions, and data." },
      { property: "og:title", content: "Settings — Ledgerly" },
      { property: "og:description", content: "Manage your Ledgerly cycle, categories, suggestions, and data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
  errorComponent: RouteError,
});

function SettingsPage() {
  const { items: transactions } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const itemCats = useCategories();
  const incomeCats = useIncomeCategories();
  const hidden = useHiddenSuggestions();

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Preferences</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Settings</h1>
      </header>

      <Tabs defaultValue="cycle" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-12 mb-6">
          <TabsTrigger value="cycle" className="gap-2"><CalendarCog className="h-4 w-4" /> Cycle</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><Tag className="h-4 w-4" /> Categories</TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2"><Sparkles className="h-4 w-4" /> Suggestions</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><HardDrive className="h-4 w-4" /> Data</TabsTrigger>
        </TabsList>

        <TabsContent value="cycle" className="mt-0">
          <CycleSettingsCard />
        </TabsContent>

        <TabsContent value="categories" className="mt-0 space-y-6">
          <CategoryManager
            title="Expense categories"
            description="Used when itemizing a transaction."
            list={itemCats.list}
            onAdd={itemCats.add}
            onRemove={itemCats.remove}
            onReset={itemCats.reset}
          />
          <CategoryManager
            title="Income categories"
            description="Used when logging income."
            list={incomeCats.list}
            onAdd={incomeCats.add}
            onRemove={incomeCats.remove}
            onReset={incomeCats.reset}
          />
        </TabsContent>

        <TabsContent value="suggestions" className="mt-0 space-y-6">
          <SuggestionSection
            kind="retailer"
            title="Retailer suggestions"
            description="Hide retailers from the New Transaction dropdown. Past transactions are unaffected."
            icon={<Store className="h-5 w-5 text-primary" />}
            catalog={useSortedCatalog(transactions, "retailer")}
            occurrences={useOccurrences(transactions, "retailer")}
            hidden={hidden.hidden.retailers}
            onHide={hidden.hideRetailer}
            onUnhide={hidden.unhideRetailer}
            onClear={hidden.clearRetailers}
          />
          <SuggestionSection
            kind="item"
            title="Item name suggestions"
            description="Hide mistyped item names from the itemization dropdown. Past transactions are unaffected."
            icon={<Package className="h-5 w-5 text-primary" />}
            catalog={useSortedCatalog(transactions, "item")}
            occurrences={useOccurrences(transactions, "item")}
            hidden={hidden.hidden.items}
            onHide={hidden.hideItem}
            onUnhide={hidden.unhideItem}
            onClear={hidden.clearItems}
          />
        </TabsContent>

        <TabsContent value="data" className="mt-0 space-y-6">
          <DataCard transactions={transactions} incomes={incomes} savings={savings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useSortedCatalog(
  transactions: { retailer?: string; items?: { item_name?: string }[] }[],
  type: "retailer" | "item",
) {
  return useMemo(() => {
    const set = new Set<string>();
    if (type === "retailer") {
      for (const t of transactions) if (t.retailer?.trim()) set.add(t.retailer.trim());
    } else {
      for (const t of transactions) for (const it of t.items ?? []) {
        if (it.item_name?.trim()) set.add(it.item_name.trim());
      }
    }
    return sortLabels(set);
  }, [transactions, type]);
}

function useOccurrences(
  transactions: { retailer?: string; items?: { item_name?: string }[] }[],
  type: "retailer" | "item",
) {
  return useMemo(() => {
    const out: string[] = [];
    if (type === "retailer") {
      for (const t of transactions) if (t.retailer?.trim()) out.push(t.retailer.trim());
    } else {
      for (const t of transactions) for (const it of t.items ?? []) {
        if (it.item_name?.trim()) out.push(it.item_name.trim());
      }
    }
    return out;
  }, [transactions, type]);
}

function SuggestionSection({
  kind, title, description, icon, catalog, occurrences,
  hidden, onHide, onUnhide, onClear,
}: {
  kind: "retailer" | "item";
  title: string;
  description: string;
  icon: React.ReactNode;
  catalog: string[];
  occurrences: string[];
  hidden: string[];
  onHide: (name: string) => void | Promise<void>;
  onUnhide: (name: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const visibleForScan = useMemo(
    () => filterHidden(catalog, hidden),
    [catalog, hidden],
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setScanOpen(true)}
          disabled={visibleForScan.length < 2}
        >
          <Sparkles className="h-3.5 w-3.5" /> Scan for duplicates
        </Button>
      </div>
      <SuggestionManager
        title={title}
        description={description}
        icon={icon}
        catalog={catalog}
        hidden={hidden}
        onHide={onHide}
        onUnhide={onUnhide}
        onClear={onClear}
      />
      <SmartCleanupDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        kind={kind}
        title={kind === "retailer" ? "Retailers" : "Items"}
        catalog={visibleForScan}
        occurrences={occurrences}
        onHide={onHide}
      />
    </div>
  );
}

function CategoryManager({
  title, description, list, onAdd, onRemove, onReset,
}: {
  title: string;
  description: string;
  list: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onReset: () => void;
}) {
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (list.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That category already exists.");
      return;
    }
    onAdd(trimmed);
    setName("");
    toast.success(`Added "${trimmed}"`);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Tag className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <Button onClick={submit}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1.5 pr-1 py-1 font-normal">
                {c}
                <button
                  onClick={() => { onRemove(c); toast.success(`Removed "${c}"`); }}
                  className="rounded-sm hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                  aria-label={`Remove ${c}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div>
          <Button variant="ghost" size="sm" onClick={() => { onReset(); toast.success("Reset to defaults"); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionManager({
  title,
  description,
  icon,
  catalog,
  hidden,
  onHide,
  onUnhide,
  onClear,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  catalog: string[];
  hidden: string[];
  onHide: (name: string) => void | Promise<void>;
  onUnhide: (name: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  const hiddenSet = new Set(hidden.map((h) => h.trim().toLowerCase()));
  const visible = catalog.filter((n) => !hiddenSet.has(n.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">{icon}</div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to manage yet — add a transaction first.</p>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Showing in dropdown ({visible.length})
              </p>
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">All entries are hidden.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {visible.map((name) => (
                    <Badge key={name} variant="secondary" className="gap-1.5 pr-1 py-1 font-normal max-w-full">
                      <span className="truncate" title={name}>{name}</span>
                      <button
                        onClick={async () => { await onHide(name); toast.success(`Hidden "${name}"`); }}
                        className="rounded-sm hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                        aria-label={`Hide ${name}`}
                      >
                        <EyeOff className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {hidden.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Hidden ({hidden.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {hidden.map((name) => (
                    <Badge key={name} variant="outline" className="gap-1.5 pr-1 py-1 font-normal max-w-full">
                      <span className="truncate opacity-70 line-through" title={name}>{name}</span>
                      <button
                        onClick={async () => { await onUnhide(name); toast.success(`Restored "${name}"`); }}
                        className="rounded-sm hover:bg-primary/20 hover:text-primary p-0.5 transition-colors"
                        aria-label={`Unhide ${name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={async () => { await onClear(); toast.success("All entries restored"); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore all
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DataCard({
  transactions, incomes, savings,
}: {
  transactions: unknown[];
  incomes: unknown[];
  savings: unknown[];
}) {
  function exportJson() {
    const payload = { transactions, incomes, savings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgerly-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SetupWizardCard />
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Database className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Saved to your account in the cloud.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Cloud</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">Your data is private</p>
            <p className="text-muted-foreground">
              Transactions, pockets, commitments, and categories are protected by row-level security — only you can read or write them.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJson}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Clear all data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every transaction, income entry, savings entry, and commitment on your account. Export first if you want a backup.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => { await clearAllData(); toast.success("All data cleared"); }}>Clear everything</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Settings2 className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>About</CardTitle>
              <CardDescription>Ledgerly version and account summary.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-display tracking-tight">Ledgerly</h2>
              <Badge variant="secondary" className="font-mono text-xs">v2.0.0</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              A precision personal finance and pocket-routing tracker.
            </p>
          </div>

          <Card className="bg-muted/30 border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center shrink-0">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Designed and developed by Nicksy4K.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Powered by React, Supabase, and late-night coding sessions fueled by Monster Energy Drink!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <a
            href="mailto:nicksy4k@gmail.com?subject=Ledgerly%20Feedback"
            className="block rounded-xl border border-border/60 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Send feedback</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Found a bug or have an idea? Drop me an email at nicksy4k@gmail.com.
                </p>
              </div>
            </div>
          </a>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Changelog</p>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="v2-0-0" className="border-border/60">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <span className="font-medium">v2.0.0 — Midnight Indigo UI Refresh</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Midnight Indigo visual refresh across the entire app.</li>
                    <li>Smart Suggestion Cleanup wizard for retailers and item names.</li>
                    <li>Cleaner navigation, dashboard hero, and tabbed settings.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="v1-9-0" className="border-border/60">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="font-medium">v1.9.0 — Dynamic Income Routing</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Dynamic income routing with inline pocket creation.</li>
                    <li>Automatic remainder calculation for the main balance.</li>
                    <li>Recurring income support for upcoming paychecks.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="v1-8-0" className="border-border/60">
                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium">v1.8.0 — BNPL Engine & Cross-Tab Sync</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Full BNPL / debt tracking with installment plans.</li>
                    <li>Cross-tab synchronization between debts and commitments.</li>
                    <li>Split payment support across pockets and BNPL plans.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Account summary</p>
            <p>{transactions.length} transactions · {incomes.length} income entries · {savings.length} savings entries.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SetupWizardCard() {
  const { reset } = useOnboardingStatus();
  const { reset: resetTutorial } = useTutorialStatus();
  const { openWelcome } = useTutorial();
  const navigate = useNavigate();
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;

  async function runTutorialNow() {
    await resetTutorial();
    if (pathname !== "/") {
      markTutorialPending();
      navigate({ to: "/" });
    } else {
      openWelcome(dashboardTourSteps);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Compass className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle>Setup & tutorial</CardTitle>
            <CardDescription>Re-run the guided setup, or replay the dashboard tour any time.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/setup"><Compass className="h-4 w-4" /> Open setup wizard</Link>
        </Button>
        <Button variant="outline" onClick={runTutorialNow}>
          <Sparkles className="h-4 w-4" /> Run tutorial again
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost">Force re-run on next load</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force the wizard to run again?</AlertDialogTitle>
              <AlertDialogDescription>
                Marks onboarding as incomplete so the app redirects to the setup wizard the next time it loads. Your data is not touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await reset(); toast.success("Wizard will run on next load."); }}>
                Force re-run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}


