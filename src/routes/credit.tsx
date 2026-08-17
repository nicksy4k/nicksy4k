import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { OwedToMeTab } from "@/components/credit/OwedToMeTab";
import { DebtsTab } from "@/components/credit/DebtsTab";
import { loanRemaining, debtRemaining } from "@/lib/credit";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { format } from "date-fns";
import { toast } from "sonner";
import { colorForKey } from "@/lib/colors";
import {
  Plus,
  Trash2,
  HandCoins,
  CreditCard as CreditIcon,
  Wallet,
  ChevronRight,
  ArrowUpRight,
  History,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  useCommitments,
  useDebts,
  useDebtItems,
  useIncomes,
  useLoans,
  useSavings,
  useTransactions,
} from "@/lib/store";
import type { Debt, LedgerPayment, Loan } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addMonths } from "date-fns";
import { syncCommitmentAfterDebtPayment } from "@/lib/bnplSync";
import { planCredit, planDebit } from "@/lib/ledgerSync";

export const Route = createFileRoute("/credit")({
  head: () => ({
    meta: [
      { title: "Credit & Debt — Ledgerly" },
      { name: "description", content: "Manage loans, BNPL plans, and debt balances." },
      { property: "og:title", content: "Credit & Debt — Ledgerly" },
      { property: "og:description", content: "Manage loans, BNPL plans, and debt balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreditPage,
  errorComponent: RouteError,
});
// ============ Page ============

function CreditPage() {
  const { items: loans } = useLoans();
  const { items: debts } = useDebts();

  const owedToMe = useMemo(() => loans.reduce((s, l) => s + loanRemaining(l), 0), [loans]);
  const iOwe = useMemo(() => debts.reduce((s, d) => s + debtRemaining(d), 0), [debts]);

  return (
    <div className="p-0 md:p-4 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
          Loans &amp; liabilities
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold">Credit &amp; Debt</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
              <HandCoins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Owed to me</p>
              <p className="text-2xl font-semibold tabular-nums">{fmt(owedToMe)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-destructive/15 grid place-items-center">
              <CreditIcon className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">I owe</p>
              <p className="text-2xl font-semibold tabular-nums">{fmt(iOwe)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="owed">
        <TabsList className="mb-6">
          <TabsTrigger value="owed">Owed to Me</TabsTrigger>
          <TabsTrigger value="debts">My Debts &amp; BNPL</TabsTrigger>
        </TabsList>

        <TabsContent value="owed">
          <OwedToMeTab />
        </TabsContent>
        <TabsContent value="debts">
          <DebtsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
