import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  Archive,
  BarChart3,
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  Settings,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { PrintableReceipt } from "@/components/PrintableReceipt";
import { EditTransactionDialog } from "@/components/history/EditTransactionDialog";
import { TransactionDetailsDialog } from "./TransactionDetailsDialog";
import {
  useCategories,
  useCommitments,
  useDebts,
  useLoans,
  useSavings,
  useTransactions,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import { debtRemaining, loanRemaining } from "@/lib/credit";
import { deliveryMeta } from "@/lib/delivery";
import { usePreferences } from "@/lib/preferences";
import type { Transaction } from "@/lib/types";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new", label: "New Spend", icon: Plus },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/savings", label: "Savings & Pockets", icon: PiggyBank },
  { to: "/commitments", label: "Outgoings", icon: CalendarClock },
  { to: "/credit", label: "Credit & Debt", icon: CreditCard },
  { to: "/history", label: "History", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/archive", label: "Past Cycles", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function shortDate(d?: string | null) {
  if (!d) return "";
  try {
    return format(parseISO(d), "d MMM yy");
  } catch {
    return d;
  }
}

/** Opens on ⌘K / Ctrl+K from anywhere, or via the header search button. */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [printing, setPrinting] = useState<Transaction | null>(null);

  const { items: transactions } = useTransactions();
  const { items: commitments } = useCommitments();
  const { items: debts } = useDebts();
  const { items: loans } = useLoans();
  const { items: savings } = useSavings();
  const { list: categories } = useCategories();
  const { prefs, update: updatePrefs } = usePreferences();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.removeEventListener("afterprint", done);
      window.clearTimeout(id);
    };
  }, [printing]);

  const pockets = useMemo(() => {
    const map = new Map<string, number>();
    savings.forEach((s) => {
      map.set(s.account, (map.get(s.account) ?? 0) + (s.kind === "deposit" ? s.amount : -s.amount));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [savings]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-xs text-muted-foreground md:w-56 md:justify-start"
        aria-label="Search anything"
        title="Search anything (⌘K / Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Search anything…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium md:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search shops, items, amounts, tracking, outgoings…" />
        <CommandList className="max-h-[60svh]">
          <CommandEmpty>Nothing found.</CommandEmpty>

          <CommandGroup heading="Quick actions">
            <CommandItem value="action log new spend expense transaction" onSelect={() => run(() => navigate({ to: "/new" }))}>
              <Plus /> Log new spend
            </CommandItem>
            <CommandItem value="action quick add fast" onSelect={() => run(() => setQuickAdd(true))}>
              <Zap /> Quick add
            </CommandItem>
            <CommandItem value="action new outgoing bill subscription" onSelect={() => run(() => navigate({ to: "/commitments" }))}>
              <CalendarClock /> New outgoing / bill
            </CommandItem>
            <CommandItem value="action create pocket savings" onSelect={() => run(() => navigate({ to: "/savings" }))}>
              <PiggyBank /> Create pocket
            </CommandItem>
            <CommandItem
              value="action toggle privacy blur amounts hide"
              onSelect={() => run(() => updatePrefs({ blurAmounts: !prefs.blurAmounts }))}
            >
              {prefs.blurAmounts ? <Eye /> : <EyeOff />}
              {prefs.blurAmounts ? "Show amounts" : "Hide amounts (privacy)"}
            </CommandItem>
            <CommandItem value="action export data download backup" onSelect={() => run(() => navigate({ to: "/settings" }))}>
              <Archive /> Export data
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Go to">
            {NAV.map(({ to, label, icon: Icon }) => (
              <CommandItem key={to} value={`go ${label}`} onSelect={() => run(() => navigate({ to }))}>
                <Icon /> {label}
              </CommandItem>
            ))}
          </CommandGroup>

          {transactions.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Transactions">
                {transactions.map((t) => {
                  const d = deliveryMeta(t.delivery_status);
                  const value = [
                    t.retailer,
                    t.total_amount.toFixed(2),
                    t.date,
                    t.notes,
                    t.courier,
                    t.tracking_number,
                    t.claim_reference,
                    ...(t.items ?? []).map((i) => `${i.item_name} ${i.category}`),
                    t.id,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <CommandItem key={t.id} value={value} onSelect={() => run(() => setViewing(t))}>
                      <Receipt />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{t.retailer || "Untitled"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {shortDate(t.date)}
                          {d ? ` · ${d.label}` : ""}
                          {t.is_pending ? " · Pending" : ""}
                        </div>
                      </div>
                      <span className="tabular-nums text-sm">{fmt(t.total_amount)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {commitments.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Outgoings">
                {commitments.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.item_name} ${c.store} ${c.category} ${c.amount.toFixed(2)} ${c.id}`}
                    onSelect={() => run(() => navigate({ to: c.is_subscription ? "/subscriptions" : "/commitments" }))}
                  >
                    <CalendarClock />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.item_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.paid ? "Paid" : c.next_due_date ? `Due ${shortDate(c.next_due_date)}` : "Outgoing"}
                        {c.is_subscription ? " · Subscription" : ""}
                      </div>
                    </div>
                    <span className="tabular-nums text-sm">{fmt(c.amount)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {(debts.length > 0 || loans.length > 0) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Credit & loans">
                {loans.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`loan owed to you ${l.person_name} ${l.id}`}
                    onSelect={() => run(() => navigate({ to: "/credit" }))}
                  >
                    <HandCoins />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{l.person_name}</div>
                      <div className="text-xs text-muted-foreground">Owed to you</div>
                    </div>
                    <span className="tabular-nums text-sm">{fmt(loanRemaining(l))}</span>
                  </CommandItem>
                ))}
                {debts.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`debt ${d.kind === "bnpl" ? "bnpl pay later" : ""} ${d.name} ${d.id}`}
                    onSelect={() => run(() => navigate({ to: "/credit" }))}
                  >
                    <CreditCard />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.kind === "bnpl" ? "Pay later" : "You owe"}
                      </div>
                    </div>
                    <span className="tabular-nums text-sm">{fmt(debtRemaining(d))}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {pockets.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Pockets">
                {pockets.map(([name, bal]) => (
                  <CommandItem
                    key={name}
                    value={`pocket savings ${name}`}
                    onSelect={() => run(() => navigate({ to: "/savings" }))}
                  >
                    <PiggyBank />
                    <span className="flex-1 truncate">{name}</span>
                    <span className="tabular-nums text-sm">{fmt(bal)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>

      <TransactionDetailsDialog
        transaction={viewing}
        onClose={() => setViewing(null)}
        onEdit={(t) => {
          setViewing(null);
          setEditing(t);
        }}
        onViewHistory={() => {
          setViewing(null);
          navigate({ to: "/history" });
        }}
        onPrint={(t) => setPrinting(t)}
      />
      <EditTransactionDialog
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
      <QuickAddSheet open={quickAdd} onOpenChange={setQuickAdd} />
      {printing && <PrintableReceipt transaction={printing} />}
    </>
  );
}
