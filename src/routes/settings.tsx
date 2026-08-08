import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTransactions,
  useIncomes,
  useSavings,
  useCategories,
  useIncomeCategories,
  clearAllData,
} from "@/lib/store";
import { useHiddenSuggestions } from "@/lib/hiddenSuggestions";
import { sortLabels } from "@/lib/utils";
import {
  Database,
  Trash2,
  Download,
  Plus,
  X,
  RotateCcw,
  Tag,
  EyeOff,
  Eye,
  Store,
  Package,
  CalendarCog,
  Sparkles,
  HardDrive,
  Code,
  Mail,
  Compass,
  MessageSquare,
  ShieldCheck,
  Loader2,
  Info,
  Lightbulb,
  Rocket,
  Heart,
  Palette,
} from "lucide-react";
import { CurrencySettingsCard, ThemePickerCard, ComfortCard } from "@/components/PreferencesCards";

import { PrivacyDetailsDialog } from "@/components/PrivacyDetailsDialog";
import { AboutStory } from "@/components/AboutStory";
import { SupportDevCard } from "@/components/SupportDevCard";

import { FeedbackDialog } from "@/components/FeedbackDialog";
import { exportUserData } from "@/lib/exportData";
import { Link } from "@tanstack/react-router";
import { useOnboardingStatus } from "@/lib/onboarding";
import { markTutorialPending, useTutorialStatus } from "@/lib/tutorial";
import { useTutorial } from "@/components/tutorial/TutorialProvider";
import { dashboardTourSteps } from "@/lib/dashboardTourSteps";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { toast } from "sonner";
import { CycleSettingsCard } from "@/components/CycleSettingsCard";
import { SmartCleanupDialog } from "@/components/SmartCleanupDialog";
import { filterHidden } from "@/lib/hiddenSuggestions";
import { ConnectedAccountsCard } from "@/components/ConnectedAccountsCard";
import { UserCircle2, FileDown, Printer, BookOpen } from "lucide-react";
import { useIsDemoUser } from "@/lib/demoAccount";
import { useUserRoles } from "@/lib/features";
import { AdminDemoCard } from "@/components/AdminDemoCard";
import { WhatsNewCard } from "@/components/WhatsNewCard";
import { ChangelogDialogTrigger } from "@/components/ChangelogDialog";
import {
  changelog,
  currentVersion,
  currentVersionDate,
  downloadChangelogCsv,
} from "@/lib/changelog";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ledgerly" },
      {
        name: "description",
        content: "Manage your Ledgerly cycle, categories, suggestions, and data.",
      },
      { property: "og:title", content: "Settings — Ledgerly" },
      {
        property: "og:description",
        content: "Manage your Ledgerly cycle, categories, suggestions, and data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
  errorComponent: RouteError,
});

const VALID_TABS = [
  "cycle",
  "personalise",
  "account",
  "categories",
  "suggestions",
  "data",
  "about",
  "admin",
] as const;
type TabValue = (typeof VALID_TABS)[number];

function readHashTab(): TabValue {
  if (typeof window === "undefined") return "cycle";
  const h = window.location.hash.replace("#", "");
  return (VALID_TABS as readonly string[]).includes(h) ? (h as TabValue) : "cycle";
}

function SettingsPage() {
  const { items: transactions } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const itemCats = useCategories();
  const incomeCats = useIncomeCategories();
  const hidden = useHiddenSuggestions();

  // The shared demo account must not reach app configuration.
  const isDemo = useIsDemoUser();
  const navigateGuard = useNavigate();
  useEffect(() => {
    if (isDemo) navigateGuard({ to: "/", replace: true });
  }, [isDemo, navigateGuard]);

  const { data: roles } = useUserRoles();
  const isAdmin = (roles ?? []).includes("admin");

  const [tab, setTab] = useState<TabValue>(() => readHashTab());

  useEffect(() => {
    const sync = () => setTab(readHashTab());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function selectTab(v: string) {
    const next = (VALID_TABS as readonly string[]).includes(v) ? (v as TabValue) : "cycle";
    setTab(next);
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}${next === "cycle" ? "" : `#${next}`}`;
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
          Preferences
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-semibold">Settings</h1>
          <button
            type="button"
            onClick={() => selectTab("about")}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="View About & changelog"
          >
            <span className="font-mono text-primary">{currentVersion}</span>
            <span className="opacity-60">·</span>
            <span>updated {format(parseISO(currentVersionDate), "d MMM yyyy")}</span>
          </button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={selectTab} className="w-full">
        <TabsList
          className={`w-full grid grid-cols-3 ${isAdmin ? "md:grid-cols-8" : "md:grid-cols-7"} h-auto md:h-12 mb-6 gap-1`}
        >
          <TabsTrigger value="cycle" className="gap-2">
            <CalendarCog className="h-4 w-4" /> Cycle
          </TabsTrigger>
          <TabsTrigger value="personalise" className="gap-2">
            <Palette className="h-4 w-4" /> Personalise
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <UserCircle2 className="h-4 w-4" /> Account
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Sparkles className="h-4 w-4" /> Suggestions
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <HardDrive className="h-4 w-4" /> Data
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <Info className="h-4 w-4" /> About
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Admin
            </TabsTrigger>
          )}
        </TabsList>

        {isAdmin && (
          <TabsContent value="admin" className="mt-0 space-y-6">
            <AdminDemoCard />
          </TabsContent>
        )}

        <TabsContent value="personalise" className="mt-0 space-y-6">
          <CurrencySettingsCard />
          <ThemePickerCard />
          <ComfortCard categories={itemCats.list} />
        </TabsContent>

        <TabsContent value="account" className="mt-0 space-y-6">
          <ConnectedAccountsCard />
        </TabsContent>

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
          <DataTab transactions={transactions} incomes={incomes} savings={savings} />
        </TabsContent>

        <TabsContent value="about" className="mt-0 space-y-6">
          <AboutTab
            counts={{
              transactions: transactions.length,
              incomes: incomes.length,
              savings: savings.length,
            }}
          />
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
      for (const t of transactions)
        for (const it of t.items ?? []) {
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
      for (const t of transactions)
        for (const it of t.items ?? []) {
          if (it.item_name?.trim()) out.push(it.item_name.trim());
        }
    }
    return out;
  }, [transactions, type]);
}

function SuggestionSection({
  kind,
  title,
  description,
  icon,
  catalog,
  occurrences,
  hidden,
  onHide,
  onUnhide,
  onClear,
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
  const visibleForScan = useMemo(() => filterHidden(catalog, hidden), [catalog, hidden]);

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
  title,
  description,
  list,
  onAdd,
  onRemove,
  onReset,
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
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
            <Tag className="h-5 w-5 text-primary" />
          </div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button onClick={submit}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1.5 pr-1 py-1 font-normal">
                {c}
                <button
                  onClick={() => {
                    onRemove(c);
                    toast.success(`Removed "${c}"`);
                  }}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onReset();
              toast.success("Reset to defaults");
            }}
          >
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
          <p className="text-sm text-muted-foreground">
            Nothing to manage yet — add a transaction first.
          </p>
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
                    <Badge
                      key={name}
                      variant="secondary"
                      className="gap-1.5 pr-1 py-1 font-normal max-w-full"
                    >
                      <span className="truncate" title={name}>
                        {name}
                      </span>
                      <button
                        onClick={async () => {
                          await onHide(name);
                          toast.success(`Hidden "${name}"`);
                        }}
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
                    <Badge
                      key={name}
                      variant="outline"
                      className="gap-1.5 pr-1 py-1 font-normal max-w-full"
                    >
                      <span className="truncate opacity-70 line-through" title={name}>
                        {name}
                      </span>
                      <button
                        onClick={async () => {
                          await onUnhide(name);
                          toast.success(`Restored "${name}"`);
                        }}
                        className="rounded-sm hover:bg-primary/20 hover:text-primary p-0.5 transition-colors"
                        aria-label={`Unhide ${name}`}
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await onClear();
                      toast.success("All entries restored");
                    }}
                  >
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

/* ---------------- Data tab ---------------- */

function DataTab({
  transactions,
  incomes,
  savings,
}: {
  transactions: unknown[];
  incomes: unknown[];
  savings: unknown[];
}) {
  const [exporting, setExporting] = useState(false);

  async function fullExport() {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading("Preparing your export…");
    try {
      await exportUserData((msg) => toast.loading(msg, { id: toastId }));
      toast.success("Export ready — check your downloads.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  function exportJsonQuick() {
    const payload = { transactions, incomes, savings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgerly-quick-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SetupWizardCard />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Download my data</CardTitle>
              <CardDescription>
                A ZIP with every transaction, income, savings row, and attached receipt.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={fullExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Preparing…" : "Download full export (ZIP)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
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
              Transactions, pockets, commitments, and categories are protected by row-level security
              — only you can read or write them.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Account summary</p>
            <p>
              {transactions.length} transactions · {incomes.length} income entries ·{" "}
              {savings.length} savings entries.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportJsonQuick}>
              <Download className="h-4 w-4" /> Quick JSON snapshot
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
                    This permanently deletes every transaction, income entry, savings entry, and
                    commitment on your account. Export first if you want a backup.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await clearAllData();
                      toast.success("All data cleared");
                    }}
                  >
                    Clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- About tab ---------------- */

const ROADMAP: { title: string; blurb: string }[] = [
  {
    title: "Shared households",
    blurb: "Invite a partner and merge pockets, commitments, and reports.",
  },
  { title: "Bank sync (trial)", blurb: "Optional read-only feed to auto-suggest transactions." },
  { title: "Category budgets", blurb: "Per-category caps with progress rings on the dashboard." },
  {
    title: "Recurring rules v2",
    blurb: "Skip, pause, and end-date any recurring income or commitment.",
  },
];

function AboutTab({
  counts,
}: {
  counts: { transactions: number; incomes: number; savings: number };
}) {
  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/15 to-transparent grid place-items-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-display tracking-tight">Ledgerly</h2>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  Beta
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {currentVersion}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Personal money, on your terms — pockets, commitments, and receipts in one place.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated {format(parseISO(currentVersionDate), "d MMM yyyy")} ·{" "}
                {counts.transactions} transactions · {counts.incomes} income entries ·{" "}
                {counts.savings} savings entries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <WhatsNewCard />

      <AboutStory variant="condensed" />
      <SupportDevCard />

      {/* Changelog */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Changelog</CardTitle>
              <CardDescription>
                {changelog.length} releases · latest {currentVersion} on{" "}
                {format(parseISO(currentVersionDate), "d MMM yyyy")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ChangelogDialogTrigger>
            <Button size="sm" variant="outline" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Open full changelog
            </Button>
          </ChangelogDialogTrigger>
          <Button size="sm" variant="ghost" onClick={downloadChangelogCsv} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link to="/changelog">
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Privacy &amp; security</CardTitle>
              <CardDescription>
                Row-level security, private receipt storage, and update history in plain language.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <PrivacyDetailsDialog
            trigger={
              <Button size="sm" variant="outline">
                <ShieldCheck className="h-4 w-4" /> Read the details
              </Button>
            }
          />
          <Button asChild size="sm" variant="ghost">
            <Link to="/privacy">Privacy Policy</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/beta-disclaimer">Beta Disclaimer</Link>
          </Button>
        </CardContent>

      </Card>

      {/* Help & feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Help &amp; feedback</CardTitle>
              <CardDescription>
                Ledgerly is in beta — your notes shape what ships next.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <FeedbackDialog defaultType="bug">
            <button className="text-left rounded-xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-background">
              <MessageSquare className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium">Report a bug</p>
              <p className="text-xs text-muted-foreground mt-1">
                Something not working? Send me the steps.
              </p>
            </button>
          </FeedbackDialog>
          <FeedbackDialog defaultType="idea">
            <button className="text-left rounded-xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-background">
              <Lightbulb className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium">Share an idea</p>
              <p className="text-xs text-muted-foreground mt-1">
                A feature you'd love, or a rough edge to smooth.
              </p>
            </button>
          </FeedbackDialog>
          <FeedbackDialog defaultType="general">
            <button className="text-left rounded-xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-background">
              <Mail className="h-5 w-5 text-primary mb-2" />
              <p className="text-sm font-medium">General feedback</p>
              <p className="text-xs text-muted-foreground mt-1">
                Anything else — kind words welcome too.
              </p>
            </button>
          </FeedbackDialog>
        </CardContent>
      </Card>

      {/* Roadmap */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>On the roadmap</CardTitle>
              <CardDescription>
                Rough order — nothing here is a promise, but it's what I'm thinking about next.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {ROADMAP.map((r) => (
              <li
                key={r.title}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3"
              >
                <div className="h-6 w-6 rounded-full bg-primary/15 grid place-items-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Credits */}
      <Card className="bg-muted/30 border-border/60">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center shrink-0">
              <Code className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Designed and developed by Nicksy4K.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Built with TanStack Start, Tailwind, shadcn/ui, and Lovable Cloud — fuelled by
                late-night Monster Energy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal footer */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="flex items-center gap-1.5 text-foreground/80 font-medium mb-1">
          <Heart className="h-3.5 w-3.5 text-primary" /> Beta disclaimer
        </p>
        <p>
          Ledgerly is a personal project in active development. Features may change or break between
          releases and some functionality may be incomplete. Your data is stored securely with
          row-level security, but please keep your own backups of anything important. ©{" "}
          {new Date().getFullYear()} Ledgerly.
        </p>
      </div>
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
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Setup &amp; tutorial</CardTitle>
            <CardDescription>
              Re-run the guided setup, or replay the dashboard tour any time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/setup">
            <Compass className="h-4 w-4" /> Open setup wizard
          </Link>
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
                Marks onboarding as incomplete so the app redirects to the setup wizard the next
                time it loads. Your data is not touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await reset();
                  toast.success("Wizard will run on next load.");
                }}
              >
                Force re-run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
