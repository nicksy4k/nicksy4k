import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Commitment } from "@/lib/types";
import { useActiveCycle, rollDueDateForward, type ActiveCycle } from "@/lib/cycle";

const STORAGE_KEY = "ledgerly.commitments.lastCycleStart";

/**
 * MASTER cycle-rollover engine for commitments. Mount ONCE at the app root.
 *
 * Whenever the global active cycle advances (its startISO changes), this
 * walks EVERY commitment row in the database (not just the page-loaded set):
 *   1. Rolls `next_due_date` forward in cycle-sized steps until it lands
 *      inside or after the new cycle window.
 *   2. Resets `paid` → false and clears `last_paid_date` so the indicator
 *      reverts to the red "unpaid" dot for the fresh cycle.
 *
 * There is no other rollover logic in the app — local page-level effects
 * have been removed in favour of this single source of truth.
 */
export function useCommitmentRollover() {
  const cycle = useActiveCycle();
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = localStorage.getItem(STORAGE_KEY);

    // First ever run on this device — record current cycle, do nothing.
    if (!last) {
      localStorage.setItem(STORAGE_KEY, cycle.startISO);
      return;
    }
    if (last === cycle.startISO) return;
    if (running.current) return;

    running.current = true;
    void rolloverAllCommitments(cycle)
      .then(() => {
        localStorage.setItem(STORAGE_KEY, cycle.startISO);
        qc.invalidateQueries({ queryKey: ["commitments"] });
      })
      .catch((err) => {
        console.error("Commitment rollover failed", err);
      })
      .finally(() => {
        running.current = false;
      });
  }, [cycle.startISO, cycle.type, qc]);
}

async function rolloverAllCommitments(cycle: ActiveCycle) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  // Pull EVERY commitment for the user — no status / due-date filter so we
  // don't accidentally update only a subset of items.
  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("user_id", u.user.id);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Commitment[];

  for (const c of rows) {
    const patch: Partial<Commitment> = {};

    if (c.next_due_date && c.next_due_date < cycle.startISO) {
      patch.next_due_date = rollDueDateForward(
        c.next_due_date,
        cycle.startISO,
        cycle,
      );
      patch.prev_due_date = c.next_due_date;
    }

    if (c.paid) {
      patch.paid = false;
      patch.last_paid_date = null;
    }

    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await supabase
      .from("commitments")
      .update(patch)
      .eq("id", c.id);
    if (upErr) console.error("Rollover update failed for", c.id, upErr);
  }
}
