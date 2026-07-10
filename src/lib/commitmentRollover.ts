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

    // Skip only when we already processed this exact cycle on this device.
    // If `last` is missing (new device, cleared browser, new user), we still
    // run — rollover is idempotent (rolls forward past due dates and resets
    // paid on rows actually due in the new cycle), so running once more is
    // safe; skipping would leave stale-paid indicators indefinitely.
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

  await Promise.all(
    rows.map(async (c) => {
      const patch: Partial<Commitment> = {};

      if (c.next_due_date && c.next_due_date < cycle.startISO) {
        patch.next_due_date = rollDueDateForward(
          c.next_due_date,
          cycle.startISO,
          cycle,
        );
        patch.prev_due_date = c.next_due_date;
      }

      // Only reset paid state when the commitment is actually due in (or was
      // rolled into) the new cycle. Future-dated bills (e.g. quarterly, or
      // BNPL installments on a different cadence than the global cycle) keep
      // their paid flag so early payments aren't silently undone.
      const effectiveDue = patch.next_due_date ?? c.next_due_date;
      const dueInsideNewCycle =
        !!effectiveDue &&
        effectiveDue >= cycle.startISO &&
        effectiveDue <= cycle.endISO;
      const rolledForward = !!patch.next_due_date;

      if (c.paid && (rolledForward || dueInsideNewCycle)) {
        patch.paid = false;
        patch.last_paid_date = null;
      }

      if (Object.keys(patch).length === 0) return;

      const { error: upErr } = await supabase
        .from("commitments")
        .update(patch)
        .eq("id", c.id);
      if (upErr) console.error("Rollover update failed for", c.id, upErr);
    }),
  );
}
