import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_HOUSEHOLD_KEY = "prikkr_active_household_id";

// Module-level in-memory store — shared across all hook instances in the same JS runtime.
// AsyncStorage is used only for persistence across app restarts (best-effort).
let cachedId: string | null = null;
let initialized = false;
const listeners = new Set<(id: string | null) => void>();

/** Initialize from AsyncStorage once on first call, then use in-memory cache. */
export async function getActiveHouseholdId(): Promise<string | null> {
  if (initialized) return cachedId;
  try {
    cachedId = await AsyncStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
  } catch {
    cachedId = null;
  }
  initialized = true;
  return cachedId;
}

/** Synchronous read of the in-memory cache (returns null before first async init). */
export function getActiveHouseholdIdSync(): string | null {
  return cachedId;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeToActiveHouseholdId(
  fn: (id: string | null) => void
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function persistActiveHouseholdId(id: string): Promise<void> {
  cachedId = id;
  listeners.forEach((fn) => fn(id));
  try {
    await AsyncStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id);
  } catch {
    // ignore
  }
}

export async function clearActiveHouseholdId(): Promise<void> {
  cachedId = null;
  initialized = false;
  listeners.forEach((fn) => fn(null));
  try {
    await AsyncStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
  } catch {
    // ignore
  }
}
