import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Commitment } from "@/lib/types";
import {
  getActiveCycle,
  rollDueDateForward,
  useCycleSettings,
  type ActiveCycle,
} from "@/lib/cycle";
import { todayLocalISO } from "@/lib/format";

const STORAGE_KEY = "ledgerly.commitments.lastCycleStart";

function storageKeyFor(userId: string) {
  return `${STORAGE_KEY}.${userId}`;
}

/**
 * MASTER cycle-rollover engine for commitments. Mount ONCE at the app root.
 *
 * Whenever the global active cycle advances (its startISO changes), this
 * walks EVERY commitment row in the database (not just the page-loaded set):
 *   1. Rolls `next_due_date` forward in cadence-sized steps until it lands
 *      inside or after the new cycle window.
 *   2. Resets `paid` → false and clears `last_paid_date` so the indicator
 *      reverts to the red "unpaid" dot for the fresh cycle.
 *
 * There is no other rollover logic in the app — local page-level effects
 * have been removed in favour of this single source of truth.
 */
export function useCommitmentRollover() {
  const { settings, isReady } = useCycleSettings();
  const cycle = getActiveCycle(settings);
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // The cache is only a display fallback. Rollover writes must wait for the
    // signed-in account's authoritative cycle settings to prevent stale dates
    // from advancing commitments or resetting paid states.
    if (!isReady) return;
    // Sanity gate: only ever write against a window that actually contains
    // today. A window that has drifted (stale anchor, clock skew) would roll
    // bills that are still due in the real current cycle.
    const todayISO = todayLocalISO();
    if (todayISO < cycle.startISO || todayISO > cycle.endISO) return;
    if (running.current) return;

    running.current = true;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Keys are scoped per account so switching users (or demo mode) can
      // never make one account inherit another's "already processed" marker.
      const key = storageKeyFor(u.user.id);
      if (localStorage.getItem(key) === cycle.startISO) return;

      await rolloverAllCommitments(cycle, u.user.id);
      localStorage.setItem(key, cycle.startISO);
      qc.invalidateQueries({ queryKey: ["commitments"] });
    })()
      .catch((err) => {
        console.error("Commitment rollover failed", err);
      })
      .finally(() => {
        running.current = false;
      });
  }, [cycle, cycle.startISO, cycle.type, isReady, qc]);
}

async function rolloverAllCommitments(cycle: ActiveCycle, userId: string) {
  // Pull EVERY commitment for the user — no status / due-date filter so we
  // don't accidentally update only a subset of items.
  const { data, error } = await supabase.from("commitments").select("*").eq("user_id", userId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Commitment[];
  const todayISO = todayLocalISO();

  await Promise.all(
    rows.map(async (c) => {
      const patch: Partial<Commitment> = {};

      // Promo expiry: once the discounted period is over, revert to the
      // standard price so cycle totals stay honest even if the user never
      // acted on the reminder.
      if (
        c.promo_ends_on &&
        c.promo_ends_on <= todayISO &&
        typeof c.standard_price === "number" &&
        c.standard_price > 0
      ) {
        patch.amount = c.standard_price;
        patch.promo_price = null;
        patch.promo_ends_on = null;
        patch.standard_price = null;
        patch.promo_alert_snoozed_until = null;
      }

      if (c.next_due_date && c.next_due_date < cycle.startISO) {
        patch.next_due_date = rollDueDateForward(c.next_due_date, cycle.startISO, cycle, c.cadence);
        patch.prev_due_date = c.next_due_date;
      }

      // Only reset paid state when the commitment is actually due in (or was
      // rolled into) the new cycle. Future-dated bills (e.g. quarterly, or
      // BNPL installments on a different cadence than the global cycle) keep
      // their paid flag so early payments aren't silently undone.
      const effectiveDue = patch.next_due_date ?? c.next_due_date;
      const dueInsideNewCycle =
        !!effectiveDue && effectiveDue >= cycle.startISO && effectiveDue <= cycle.endISO;
      const rolledForward = !!patch.next_due_date;

      if (c.paid && (rolledForward || dueInsideNewCycle)) {
        patch.paid = false;
        patch.last_paid_date = null;
      }

      if (Object.keys(patch).length === 0) return;

      const { error: upErr } = await supabase.from("commitments").update(patch).eq("id", c.id);
      if (upErr) console.error("Rollover update failed for", c.id, upErr);
    }),
  );
}
