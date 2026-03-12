import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { useAppTheme } from "~/hooks/useAppTheme";

export default function Index() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { data: session, isPending: sessionPending, error } = authClient.useSession();
  const myHouseholdsQuery = useQuery({
    ...trpc.household.myHouseholds.queryOptions(),
    enabled: !!session,
  });

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t("index.apiErrorTitle")}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t("index.apiErrorHint", { command1: "pnpm --filter @prikkr/nextjs dev", command2: "pnpm dev" })}
        </Text>
      </View>
    );
  }

  if (sessionPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.hint, { color: colors.textMuted, marginTop: 16 }]}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  const householdsLoaded = !myHouseholdsQuery.isPending && myHouseholdsQuery.data !== undefined;
  if (!householdsLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.hint, { color: colors.textMuted, marginTop: 16 }]}>{t("common.loading")}</Text>
      </View>
    );
  }

  const households = myHouseholdsQuery.data ?? [];
  if (households.length === 0) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href={"/(app)/(tabs)/home" as never} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: { textAlign: "center", fontSize: 16, fontWeight: "600" },
  hint: { textAlign: "center", fontSize: 14, marginTop: 8 },
});
