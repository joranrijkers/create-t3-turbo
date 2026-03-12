import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import {
  getActiveHouseholdId,
  getActiveHouseholdIdSync,
  persistActiveHouseholdId,
  subscribeToActiveHouseholdId,
} from "~/utils/active-household-storage";

type Household = RouterOutputs["household"]["myHouseholds"][number];

export function useCurrentHousehold(): {
  household: Household | null;
  householdId: string | null;
  households: Household[];
  activeHouseholdId: string | null;
  setActiveHouseholdId: (id: string) => void;
  isLoading: boolean;
  error: unknown;
} {
  // Seed from in-memory cache synchronously to avoid an extra render cycle.
  const [activeId, setActiveId] = useState<string | null>(getActiveHouseholdIdSync);

  const { data: households = [], isPending, error } = useQuery(
    trpc.household.myHouseholds.queryOptions()
  );

  // On first mount, do the async AsyncStorage read to initialise the cache.
  useEffect(() => {
    getActiveHouseholdId().then((id) => {
      if (id) setActiveId(id);
    });
  }, []);

  // Subscribe to the module-level store so every hook instance updates
  // instantly when any other instance (e.g. huishouden screen) switches household.
  useEffect(() => {
    const unsub = subscribeToActiveHouseholdId((id) => {
      setActiveId(id);
    });
    return unsub;
  }, []);

  // When the households list first loads and no activeId is set yet, fall back
  // to the first household.
  useEffect(() => {
    if (!households.length) return;
    const current = getActiveHouseholdIdSync();
    const valid = current && households.some((h) => h.id === current);
    if (!valid) {
      const first = households[0]?.id;
      if (first) void persistActiveHouseholdId(first);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households]);

  const setActiveHouseholdId = useCallback((id: string) => {
    void persistActiveHouseholdId(id);
  }, []);

  const household = useMemo(() => {
    if (!households.length) return null;
    const found = households.find((h) => h.id === activeId);
    return found ?? households[0] ?? null;
  }, [households, activeId]);

  const householdId = household?.id ?? null;

  return {
    household,
    householdId,
    households,
    activeHouseholdId: activeId,
    setActiveHouseholdId,
    isLoading: isPending,
    error: error ?? null,
  };
}
