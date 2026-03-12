import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const LANGUAGE_STORAGE_KEY = "prikkr_app_language";
const VALID_LANGUAGE_PREFERENCES = ["auto", "nl", "en"] as const;
export type AppLanguagePreference = (typeof VALID_LANGUAGE_PREFERENCES)[number];
const secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);

function isValidPreference(value: string | null): value is AppLanguagePreference {
  return (
    !!value &&
    (VALID_LANGUAGE_PREFERENCES as readonly string[]).includes(value)
  );
}

/** Reads the user's stored language preference. Defaults to "auto". */
export async function getStoredLanguagePreference(): Promise<AppLanguagePreference> {
  try {
    const asyncValue = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isValidPreference(asyncValue)) {
      return asyncValue;
    }

    if (await secureStoreAvailable) {
      const secureValue = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
      if (isValidPreference(secureValue)) {
        // Self-heal AsyncStorage if it was empty/unavailable previously.
        try {
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, secureValue);
        } catch {
          // ignore
        }
        return secureValue;
      }
    }
    return "auto";
  } catch {
    return "auto";
  }
}

/** Persists the user's language choice. */
export async function setStoredLanguagePreference(
  preference: AppLanguagePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch {
    // ignore
  }

  try {
    if (await secureStoreAvailable) {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, preference);
    }
  } catch {
    // ignore
  }
}
