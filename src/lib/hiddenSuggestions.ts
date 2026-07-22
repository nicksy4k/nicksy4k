import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-user "hidden suggestions" lists stored on `user_settings`.
 * These filter derived combobox options (retailers, item names) so mistyped
 * entries can be removed from dropdowns without touching past transactions.
 */

export interface HiddenSuggestions {
  retailers: string[];
  items: string[];
}

const EMPTY: HiddenSuggestions = { retailers: [], items: [] };

function normalise(s: string) {
  return s.trim().toLowerCase();
}

/** Case-insensitive filter: keep entries NOT in the hidden set. */
export function filterHidden(list: string[], hidden: string[]): string[] {
  if (hidden.length === 0) return list;
  const set = new Set(hidden.map(normalise));
  return list.filter((v) => !set.has(normalise(v)));
}

export function useHiddenSuggestions() {
  const [data, setData] = useState<HiddenSuggestions>(EMPTY);

  const refresh = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setData(EMPTY);
      return;
    }
    const { data: row } = await supabase
      .from("user_settings")
      .select("hidden_retailers, hidden_items")
      .eq("user_id", u.user.id)
      .maybeSingle();
    setData({
      retailers: (row?.hidden_retailers as string[] | null) ?? [],
      items: (row?.hidden_items as string[] | null) ?? [],
    });
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const write = useCallback(async (next: HiddenSuggestions) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setData(next);
    await supabase.from("user_settings").upsert(
      {
        user_id: u.user.id,
        hidden_retailers: next.retailers,
        hidden_items: next.items,
      },
      { onConflict: "user_id" },
    );
  }, []);

  const hideRetailer = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (data.retailers.some((v) => normalise(v) === normalise(trimmed))) return;
      await write({ ...data, retailers: [...data.retailers, trimmed] });
    },
    [data, write],
  );

  const unhideRetailer = useCallback(
    async (name: string) => {
      await write({
        ...data,
        retailers: data.retailers.filter((v) => normalise(v) !== normalise(name)),
      });
    },
    [data, write],
  );

  const hideItem = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (data.items.some((v) => normalise(v) === normalise(trimmed))) return;
      await write({ ...data, items: [...data.items, trimmed] });
    },
    [data, write],
  );

  const unhideItem = useCallback(
    async (name: string) => {
      await write({
        ...data,
        items: data.items.filter((v) => normalise(v) !== normalise(name)),
      });
    },
    [data, write],
  );

  const clearRetailers = useCallback(
    () => write({ ...data, retailers: [] }),
    [data, write],
  );
  const clearItems = useCallback(() => write({ ...data, items: [] }), [data, write]);

  return {
    hidden: data,
    hideRetailer,
    unhideRetailer,
    hideItem,
    unhideItem,
    clearRetailers,
    clearItems,
  };
}
