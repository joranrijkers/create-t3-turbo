import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@prikkr/api";

import { clearActiveHouseholdId } from "./active-household-storage";
import { authClient } from "./auth";
import { getBaseUrl } from "./base-url";

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours — align with persister maxAge

/**
 * Wraps AsyncStorage so that when the native module is null (e.g. Expo Go or certain dev builds),
 * getItem/setItem/removeItem no-op instead of throwing. This allows the app to run without
 * query cache persistence when AsyncStorage is unavailable.
 */
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // no-op when native module is null
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // no-op
    }
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: CACHE_MAX_AGE_MS, // match persist maxAge so GC doesn't drop persisted data
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (typeof onlineManager.isOnline === "function" && !onlineManager.isOnline()) return false;
        return true;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

// When a household-scoped query returns FORBIDDEN, the stored active household may be stale
// (user left or was removed). Clear it and refetch myHouseholds so UI switches to a valid one.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== "updated") return;
  const query = event.query;
  const error = query.state.error;
  if (!error || query.state.status !== "error") return;
  const err = error as { data?: { code?: string }; message?: string };
  if (err?.data?.code !== "FORBIDDEN") return;
  const key = query.queryKey;
  if (!Array.isArray(key) || key.length < 2) return;
  const [procedure] = key as [string[], unknown];
  if (!Array.isArray(procedure) || procedure.length < 2) return;
  const input = (query.queryKey[1] as { input?: { householdId?: string } })?.input;
  const householdId = input?.householdId;
  if (!householdId || typeof householdId !== "string") return;
  const householdScoped = ["mealPlan", "shoppingList", "household", "userPreferences"].includes(
    procedure[0] as string
  );
  if (!householdScoped) return;
  void clearActiveHouseholdId();
  void queryClient.invalidateQueries({ queryKey: [["household", "myHouseholds"]] });
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: safeStorage,
  key: "PRIKKR_QUERY_CACHE",
  throttleTime: 1000,
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
        colorMode: "ansi",
      }),
      httpBatchLink({
        transformer: superjson,
        url: `${getBaseUrl()}/api/trpc`,
        headers() {
          const headers = new Map<string, string>();
          headers.set("x-trpc-source", "expo-react");

          const cookies = authClient.getCookie();
          if (cookies) {
            headers.set("Cookie", cookies);
          }
          return headers;
        },
      }),
    ],
  }),
  queryClient,
});

export type { RouterInputs, RouterOutputs } from "@prikkr/api";
