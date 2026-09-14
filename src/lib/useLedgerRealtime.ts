import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps every open screen (and second device) in step: any change to
 * outgoings, debts, spends or pockets refreshes the matching cached lists, so
 * a payment logged on the Credit page shows on Outgoings and the dashboard
 * straight away. Mounted once, at the app root.
 */
export function useLedgerRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const keys: Record<string, string> = {
      commitments: "commitments",
      debts: "debts",
      transactions: "transactions",
      savings: "savings",
      loans: "loans",
    };

    const channel = supabase.channel("ledger-sync");
    for (const table of Object.keys(keys)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void qc.invalidateQueries({ queryKey: [keys[table]] });
        },
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
