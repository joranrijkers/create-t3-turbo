import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useIsFocused } from "@react-navigation/native";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import {
  getStoredLanguagePreference,
  type AppLanguagePreference,
} from "~/utils/language-storage";

const P = 20;
const AVATAR_COLORS = ["#FF7936", "#4CAF50", "#9C27B0", "#2196F3", "#FF5722", "#00BCD4"];
function getAvatarColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? "#FF7936";
}

function getCreatedMonthYear(dateStr: string | Date | null | undefined, locale: string): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function formatDietSubtext(
  dietaryRestrictions: string[] | undefined,
  allergies: string[] | undefined,
  t: (key: string) => string,
): string {
  const diet = dietaryRestrictions?.[0];
  const allergyList = allergies?.length ? allergies.join(", ") : null;
  if (!diet && !allergyList) return t("settings.notSet");
  const parts: string[] = [];
  if (diet) {
    const label =
      diet === "vegetarisch"
        ? t("dietary.vegetarian")
        : diet === "vegan"
          ? t("dietary.vegan")
          : diet === "omnivoor"
            ? t("dietary.omnivore")
            : diet;
    parts.push(label);
  }
  if (allergyList) parts.push(allergyList);
  return parts.join(" - ") || t("settings.notSet");
}

export default function InstellingenScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const [languagePreference, setLanguagePreference] =
    useState<AppLanguagePreference>("auto");
  const { data: session } = authClient.useSession();
  const { householdId, household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();

  useEffect(() => {
    if (!isFocused) return;
    getStoredLanguagePreference().then((preference) => {
      setLanguagePreference(preference);
    });
  }, [isFocused]);

  const membersQuery = useQuery({
    ...trpc.household.members.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });
  const prefsQuery = useQuery({
    ...trpc.userPreferences.get.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });

  const members = membersQuery.data ?? [];
  const prefs = prefsQuery.data;
  const memberCount = members.length;

  const upsertPrefs = useMutation({
    ...trpc.userPreferences.upsert.mutationOptions(),
    onSuccess: () => {
      void prefsQuery.refetch();
    },
  });

  const handleSignOut = () => {
    Alert.alert(t("settings.signOutConfirmTitle"), t("settings.signOutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  const handleToggleNotif = useCallback(
    (field: "notifPush" | "notifAttendance" | "notifShopping", value: boolean) => {
      if (!householdId) return;
      upsertPrefs.mutate({
        householdId,
        [field]: value,
      });
    },
    [householdId, upsertPrefs],
  );

  const openPrivacy = useCallback(() => {
    const url = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
    if (url) {
      void Linking.openURL(url);
    } else {
      Alert.alert(t("settings.privacyNotConfigured"));
    }
  }, [t]);

  const version = Constants.expoConfig?.version ?? "0.1.0";

  const refetchHousehold = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [["household", "myHouseholds"]] });
  }, [queryClient]);

  if (!householdId && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.center, { padding: P }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={56} color={colors.danger} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.errorHouseholdLoad")}</Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={refetchHousehold}
            >
              <Text style={styles.primaryButtonText}>{t("common.retry")}</Text>
            </Pressable>
            <Pressable style={styles.signoutButton} onPress={handleSignOut}>
              <Text style={[styles.signoutText, { color: colors.textMuted }]}>{t("profile.signOut")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.center, { padding: P }]}>
          <MaterialCommunityIcons name="home-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("profile.emptyTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.emptySubtitle")}</Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(onboarding)/welcome")}
          >
            <Text style={styles.primaryButtonText}>{t("profile.goToOnboarding")}</Text>
          </Pressable>
          <Pressable style={styles.signoutButton} onPress={handleSignOut}>
            <Text style={[styles.signoutText, { color: colors.textMuted }]}>{t("profile.signOut")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initial = (session?.user?.name ?? "?").trim().charAt(0).toUpperCase();
  const imageUrl = session?.user?.image ?? undefined;
  const dataLoading = (membersQuery.isPending && !membersQuery.data) || (prefsQuery.isPending && !prefsQuery.data);
  const dataError = membersQuery.isError || prefsQuery.isError;
  const refetchData = useCallback(() => {
    void membersQuery.refetch();
    void prefsQuery.refetch();
  }, [membersQuery, prefsQuery]);

  if (dataLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>{t("settings.title")}</Text>
        </View>
        <View style={[styles.center, { flex: 1, padding: P }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptySubtitle, { color: colors.textMuted, marginTop: 12 }]}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (dataError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>{t("settings.title")}</Text>
        </View>
        <View style={[styles.center, { flex: 1, padding: P }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={refetchData}>
            <Text style={styles.primaryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>{t("settings.title")}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <Pressable
          style={[styles.profileCard, { backgroundColor: colors.card }]}
          onPress={() => router.push("/(app)/instellingen/profiel")}
          accessibilityLabel={t("profileEdit.title")}
          accessibilityRole="button"
        >
          <View style={[styles.profileAvatar, { backgroundColor: getAvatarColor(0) }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.profileAvatarImage} />
            ) : (
              <Text style={styles.profileAvatarInitial}>{initial}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {session?.user?.name ?? "—"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]} numberOfLines={1}>
              {session?.user?.email ?? "—"}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </Pressable>

        {/* Section: Huishouden */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionHousehold")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/(app)/instellingen/huishouden")}
          >
            <MaterialCommunityIcons name="home-outline" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {household?.name ?? "—"}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                {t("settings.createdLabel", {
                  date: getCreatedMonthYear(household?.createdAt, i18n.language === "nl" ? "nl-NL" : "en-GB"),
                  count: memberCount,
                })}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/(app)/instellingen/leden")}
            accessibilityLabel={t("settings.manageMembers")}
            accessibilityRole="button"
            accessibilityHint={t("settings.manageMembersHint")}
          >
            <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.text} />
            <Text style={[styles.rowTitle, styles.rowTitleOnly, { color: colors.text }]}>{t("settings.manageMembers")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Section: Voorkeuren */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionPreferences")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/(app)/voorkeuren/dietary")}
            accessibilityLabel={`${t("settings.dietAllergies")}. ${prefs ? formatDietSubtext(prefs.dietaryRestrictions, prefs.allergies, t) : "..."}`}
            accessibilityRole="button"
            accessibilityHint={t("settings.dietRowHint")}
          >
            <MaterialCommunityIcons name="food-apple-outline" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t("settings.dietAllergies")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {prefs ? formatDietSubtext(prefs.dietaryRestrictions, prefs.allergies, t) : "..."}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => router.push("/(app)/voorkeuren/taal")}
            accessibilityLabel={t("settings.language")}
            accessibilityRole="button"
            accessibilityHint={t("settings.languageRowHint")}
          >
            <MaterialCommunityIcons name="web" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t("settings.language")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                {languagePreference === "auto"
                  ? t("settings.languageLabelAuto")
                  : t(`settings.languageLabel${languagePreference === "nl" ? "Nl" : "En"}`)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Section: Meldingen */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionNotifications")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t("settings.pushNotifications")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{t("settings.pushNotificationsSubtext")}</Text>
            </View>
            <Switch
              value={prefs?.notifPush ?? true}
              onValueChange={(v) => handleToggleNotif("notifPush", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
              accessibilityLabel={t("settings.pushNotifications")}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs?.notifPush ?? true }}
            />
          </View>
          <View style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}>
            <MaterialCommunityIcons name="calendar-clock-outline" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t("settings.attendanceReminder")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{t("settings.attendanceReminderSubtext")}</Text>
            </View>
            <Switch
              value={prefs?.notifAttendance ?? true}
              onValueChange={(v) => handleToggleNotif("notifAttendance", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
              accessibilityLabel={t("settings.attendanceReminder")}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs?.notifAttendance ?? true }}
            />
          </View>
          <View style={styles.row}>
            <MaterialCommunityIcons name="cart-outline" size={22} color={colors.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t("settings.shoppingListUpdates")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{t("settings.shoppingListUpdatesSubtext")}</Text>
            </View>
            <Switch
              value={prefs?.notifShopping ?? false}
              onValueChange={(v) => handleToggleNotif("notifShopping", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
              accessibilityLabel={t("settings.shoppingListUpdates")}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs?.notifShopping ?? false }}
            />
          </View>
        </View>

        {/* Section: App */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionApp")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/(app)/instellingen/over")}
            accessibilityLabel={`${t("settings.aboutPrikkr")} ${t("settings.versionLabel", { version })}`}
            accessibilityRole="button"
            accessibilityHint={t("settings.aboutRowHint")}
          >
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.text} />
            <Text style={[styles.rowTitle, styles.rowTitleOnly, { color: colors.text }]}>{t("settings.aboutPrikkr")}</Text>
            <Text style={[styles.rowValue, { color: colors.textMuted }]}>v{version}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.row} onPress={openPrivacy} accessibilityLabel={t("settings.privacyPolicy")} accessibilityRole="button" accessibilityHint={t("settings.privacyRowHint")}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.text} />
            <Text style={[styles.rowTitle, styles.rowTitleOnly, { color: colors.text }]}>{t("settings.privacyPolicy")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Sign out */}
        <Pressable
          style={styles.signoutButton}
          onPress={handleSignOut}
          accessibilityLabel={t("settings.signOut")}
          accessibilityRole="button"
          accessibilityHint={t("settings.signOutHint")}
        >
          <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.signoutText, { color: colors.danger }]}>{t("settings.signOut")}</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  pageHeader: { paddingHorizontal: P, paddingVertical: 16, borderBottomWidth: 1 },
  pageTitle: { fontSize: 24, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 32 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatarImage: { width: 64, height: 64, borderRadius: 32 },
  profileAvatarInitial: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  profileEmail: { fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowBorder: { borderBottomWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowTitleOnly: { flex: 1 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  rowValue: { fontSize: 14 },
  signoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    marginBottom: 8,
  },
  signoutText: { fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  primaryButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
