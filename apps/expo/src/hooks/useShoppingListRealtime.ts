import { useEffect, useRef } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "~/utils/supabase";

const REFETCH_DEBOUNCE_MS = 400;

/**
 * Subscribes to Supabase Realtime for shopping_list and shopping_item changes
 * and invalidates the shopping list query so the UI updates when a housemate
 * checks/unchecks items or the list is regenerated.
 *
 * Requires Realtime enabled for tables shopping_list and shopping_item in
 * Supabase Dashboard, and EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY set.
 */
export function useShoppingListRealtime(
  householdId: string | undefined,
  listId: string | null | undefined,
  listQueryKey: QueryKey
) {
  const queryClient = useQueryClient();
  const listQueryKeyRef = useRef(listQueryKey);

  useEffect(() => {
    listQueryKeyRef.current = listQueryKey;
  }, [listQueryKey]);

  useEffect(() => {
    if (!householdId) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (__DEV__) {
        console.warn(
          "[Realtime] Uitgeschakeld: EXPO_PUBLIC_SUPABASE_URL of EXPO_PUBLIC_SUPABASE_ANON_KEY ontbreekt."
        );
      }
      return;
    }

    const refetch = () => {
      if (__DEV__) console.log("[Realtime] refetch");
      void queryClient.invalidateQueries({ queryKey: listQueryKeyRef.current });
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        refetch();
      }, REFETCH_DEBOUNCE_MS);
    };

    const channelNameList = `shopping_list:${householdId}`;
    const channelList = supabase
      .channel(channelNameList)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_list",
          filter: `household_id=eq.${householdId}`,
        },
        debouncedRefetch
      )
      .subscribe((status) => {
        if (__DEV__) console.log("[Realtime] shopping_list", status);
      });

    let channelItems: ReturnType<typeof supabase.channel> | null = null;
    if (listId) {
      const channelNameItems = `shopping_item:${listId}`;
      channelItems = supabase
        .channel(channelNameItems)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_item",
            filter: `shopping_list_id=eq.${listId}`,
          },
          debouncedRefetch
        )
        .subscribe((status) => {
          if (__DEV__) console.log("[Realtime] shopping_item", status);
        });
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channelList);
      if (channelItems) supabase.removeChannel(channelItems);
    };
  }, [householdId, listId, queryClient]);
}
