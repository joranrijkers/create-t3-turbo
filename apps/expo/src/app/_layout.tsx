import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

import "~/i18n";
import i18n, { resolveLanguagePreference } from "~/i18n";
import { queryClient, asyncStoragePersister } from "~/utils/api";
import { getStoredLanguagePreference } from "~/utils/language-storage";
import { useAppTheme } from "~/hooks/useAppTheme";

import "../styles.css";

// Sync network state so queries don't retry when offline
function useOnlineManager() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);
}

// Apply stored language preference on app start
function useStoredLanguage() {
  useEffect(() => {
    getStoredLanguagePreference().then((preference) => {
      void i18n.changeLanguage(resolveLanguagePreference(preference));
    });
  }, []);
}

// This is the main layout of the app
// It wraps your pages with the providers they need
export default function RootLayout() {
  const { colors } = useAppTheme();
  useOnlineManager();
  useStoredLanguage();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      }}
    >
      {/* Full-bleed layer: same color as maaltijdplan (colors.background) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.background,
        }}
      />
      <View style={{ flex: 1, backgroundColor: "transparent" }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "transparent",
            },
          }}
        />
        <StatusBar style="auto" backgroundColor={colors.background} />
      </View>
    </PersistQueryClientProvider>
  );
}
