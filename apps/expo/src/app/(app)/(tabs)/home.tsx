import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { getMondayOfWeek, getDayShortKey, getDayOfMonth, formatLongDate } from "~/utils/date";
import { formatAmount } from "~/utils/formatAmount";
import { toCanonicalUnit } from "~/utils/canonical-units";

const SCREEN_PADDING = 20;
const SECTION_GAP = 24;
const CARD_RADIUS = 16;
const CHIP_RADIUS = 12;

function getGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

function getFirstName(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return nameOrEmail;
  if (trimmed.includes("@")) return trimmed.split("@")[0] ?? trimmed;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function getGreetingLines(greeting: string, name: string): { greetingLine: string; nameLine: string } {
  const trimmedGreeting = greeting.trim();
  const trimmedName = name.trim();
  if (!trimmedGreeting || !trimmedName) {
    return { greetingLine: trimmedGreeting, nameLine: trimmedName };
  }

  const commaIndex = trimmedGreeting.lastIndexOf(",");
  if (commaIndex === -1) {
    return { greetingLine: trimmedGreeting, nameLine: trimmedName };
  }

  const greetingLine = trimmedGreeting.slice(0, commaIndex + 1);
  const nameLine = trimmedGreeting.slice(commaIndex + 1).trim() || trimmedName;
  return { greetingLine, nameLine };
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { householdId, household, households, setActiveHouseholdId, isLoading: householdLoading } = useCurrentHousehold();
  const [householdSwitcherVisible, setHouseholdSwitcherVisible] = useState(false);

  const sortedHouseholds = useMemo(
    () => [...households].sort((a, b) => Number(b.id === householdId) - Number(a.id === householdId)),
    [households, householdId],
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekStartDate = useMemo(() => getMondayOfWeek(today), [today]);

  const weekQuery = useQuery({
    ...trpc.mealPlan.forWeek.queryOptions({ householdId: householdId!, weekStartDate }),
    enabled: !!householdId,
  });
  const shoppingQuery = useQuery({
    ...trpc.shoppingList.current.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });
  const respondMutation = useMutation({
    ...trpc.attendance.respond.mutationOptions(),
    onSuccess: () => {
      void weekQuery.refetch();
    },
  });

  const refresh = useCallback(() => {
    void weekQuery.refetch();
    void shoppingQuery.refetch();
  }, [weekQuery, shoppingQuery]);

  const userDisplayName = session?.user?.name ?? session?.user?.email ?? t("common.you");
  const userFirstName = getFirstName(userDisplayName);
  const { greetingLine, nameLine } = getGreetingLines(t(`home.${getGreetingKey()}`, { name: userFirstName }), userFirstName);
  const currentUserId = session?.user?.id ?? null;

  const weekData = weekQuery.data;
  const todayDay = useMemo(() => {
    if (!weekData?.days) return null;
    return weekData.days.find((d) => d.date === today) ?? null;
  }, [weekData, today]);
  const tonightMeal = useMemo(() => {
    if (!todayDay?.meals?.length) return null;
    const dinner = todayDay.meals.find((m) => m.mealType === "dinner");
    return dinner ?? todayDay.meals[0] ?? null;
  }, [todayDay]);
  const restOfWeekDays = useMemo(() => {
    if (!weekData?.days) return [];
    return weekData.days.filter((d) => d.date > today).slice(0, 5);
  }, [weekData, today]);

  const myAttendance = useMemo((): { status: string; userId: string } | null => {
    if (!tonightMeal || !currentUserId) return null;
    return (tonightMeal.attendances.find((a) => a.userId === currentUserId) as { status: string; userId: string } | undefined) ?? null;
  }, [tonightMeal, currentUserId]);
  const tonightRightLabel = useMemo(() => {
    if (!tonightMeal || !currentUserId) return null;
    const isCook = (tonightMeal as { cookUserId?: string | null }).cookUserId === currentUserId;
    if (isCook) return "youNeedToCook";
    if (myAttendance === null) return "eatWithUs";
    return null;
  }, [tonightMeal, currentUserId, myAttendance]);
  const isCook = tonightRightLabel === "youNeedToCook";
  const showAttendanceButtons = !!currentUserId && !isCook && myAttendance === null;
  const attendingCount = tonightMeal?.attendances?.filter((a) => a.status === "yes").length ?? 0;
  const tonightTextColor = "#FFFFFF";
  const tonightMutedTextColor = "rgba(255,255,255,0.88)";
  const tonightOverlayColor = scheme === "light" ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.5)";

  const shoppingItems = shoppingQuery.data?.items ?? [];
  const shoppingTotal = shoppingQuery.data?.totalCount ?? 0;
  const previewItems = shoppingItems.slice(0, 3);
  const moreCount = Math.max(0, shoppingTotal - 3);

  const isLoading = householdLoading || (!!householdId && weekQuery.isPending && !weekQuery.data);
  const isRefreshing = weekQuery.isFetching || shoppingQuery.isFetching;

  if (!householdId && !householdLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.center, { padding: SCREEN_PADDING }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("profile.emptyTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.emptySubtitle")}</Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(onboarding)/welcome")}
          >
            <Text style={styles.primaryButtonText}>{t("profile.goToOnboarding")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {/* Header: greeting, date, household chip */}
        <View style={styles.header}>
          <View style={styles.greetingBlock}>
            <Text style={[styles.greetingLead, { color: colors.text }]}>
              {greetingLine}
            </Text>
            <Text style={[styles.greetingName, { color: colors.text }]}>
              {nameLine}
            </Text>
          </View>
          <Text style={[styles.dateLine, { color: colors.textMuted }]}>
            {formatLongDate(today, i18n.language)}
          </Text>
          {household && (
            <Pressable
              onPress={() => setHouseholdSwitcherVisible(true)}
              style={styles.householdLink}
            >
              <MaterialCommunityIcons name="home-outline" size={13} color={colors.primary} style={styles.householdIcon} />
              <Text style={[styles.householdLinkText, { color: colors.textMuted }]} numberOfLines={1}>
                {household.name.charAt(0).toUpperCase() + household.name.slice(1)}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primary} />
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t("common.loading")}</Text>
          </View>
        ) : (
          <>
            {/* Tonight card */}
            {tonightMeal && (() => {
              const recipeImageUrl = (tonightMeal as { recipeImageUrl?: string | null }).recipeImageUrl;
              const cardContent = (
                <>
                  <View style={styles.tonightTopRow}>
                    <Text style={[styles.tonightLabel, { color: tonightMutedTextColor }]}>{t("home.tonightLabel")}</Text>
                    {tonightRightLabel ? (
                      <Text style={[styles.eatWithUs, { color: tonightMutedTextColor }]}>{t(`home.${tonightRightLabel}`)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.recipeTitle, { color: tonightTextColor }]}>
                    {tonightMeal.recipeTitle ?? t("mealPlan.noRecipe")}
                  </Text>
                  <View style={styles.tonightMeta}>
                    {tonightMeal.cookName ? (
                      <Text style={[styles.tonightMetaText, { color: tonightMutedTextColor }]}>
                        {t("home.cooks", { name: tonightMeal.cookName })}
                      </Text>
                    ) : null}
                    <Text style={[styles.tonightMetaText, { color: tonightMutedTextColor }]}>
                      {t("mealPlan.attendingCount", { count: attendingCount })}
                    </Text>
                  </View>
                  {currentUserId && (showAttendanceButtons ? (
                    <View style={styles.tonightActions}>
                      <Pressable
                        style={[
                          styles.tonightYesBtn,
                          { backgroundColor: (myAttendance as { status?: string } | null)?.status === "yes" ? colors.primary : colors.primary },
                        ]}
                        onPress={() => {
                          if ((myAttendance as { status?: string } | null)?.status === "yes") return;
                          respondMutation.mutate({ mealPlanId: tonightMeal.id, status: "yes", guestCount: 0 });
                        }}
                        disabled={respondMutation.isPending}
                      >
                        <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryButtonText}>
                          {(myAttendance as { status?: string } | null)?.status === "yes" ? t("mealPlan.imEating") : t("home.iAmEating")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.tonightIconBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
                        onPress={() => respondMutation.mutate({ mealPlanId: tonightMeal.id, status: "no", guestCount: 0 })}
                      >
                        <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        style={[styles.tonightIconBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
                        onPress={() => router.push({ pathname: "/(app)/maaltijd/[id]", params: { id: tonightMeal.id } })}
                      >
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.tonightYesBtn, { backgroundColor: colors.primary }]}
                      onPress={() => router.push({ pathname: "/(app)/maaltijd/[id]", params: { id: tonightMeal.id } })}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>{t("home.viewMeal")}</Text>
                    </Pressable>
                  ))}
                </>
              );
              if (recipeImageUrl) {
                return (
                  <View style={styles.tonightCardWrapper}>
                    <ImageBackground
                      source={{ uri: recipeImageUrl }}
                      style={styles.tonightCard}
                      resizeMode="cover"
                    >
                      <View style={[StyleSheet.absoluteFillObject, styles.tonightCardOverlay, { backgroundColor: tonightOverlayColor }]} />
                      {cardContent}
                    </ImageBackground>
                  </View>
                );
              }
              return (
                <View style={[styles.tonightCard, { backgroundColor: colors.secondary }]}>
                  {cardContent}
                </View>
              );
            })()}

            {!tonightMeal && weekData && (
              <View style={[styles.tonightCard, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tonightLabel, { color: colors.textMuted }]}>{t("home.tonightLabel")}</Text>
                <Text style={[styles.eatWithUs, { color: colors.textMuted }]}>{t("mealPlan.nothingPlanned")}</Text>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={() => router.push("/(app)/(tabs)/maaltijdplan")}
                >
                  <Text style={styles.primaryButtonText}>{t("mealPlan.planMeal")}</Text>
                </Pressable>
              </View>
            )}

            {/* Rest of week */}
            <View style={{ marginTop: SECTION_GAP }}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("home.restOfWeek")}</Text>
                <Pressable onPress={() => router.push("/(app)/(tabs)/maaltijdplan")}>
                  <Text style={[styles.sectionLink, { color: colors.primary }]}>{t("home.weekPlanner")}</Text>
                </Pressable>
              </View>
              {weekQuery.error && (
                <Text style={[styles.errorText, { color: colors.danger }]}>{t("common.errorLoad")}</Text>
              )}
              {restOfWeekDays.map((day) => {
                const meal = day.meals.find((m) => m.mealType === "dinner") ?? day.meals[0];
                const dayLabel = t(`mealPlan.dayShort.${getDayShortKey(day.date)}`).toUpperCase();
                const dayNum = getDayOfMonth(day.date);
                const myAtt = meal?.attendances?.find((a) => a.userId === currentUserId);
                const statusText = meal
                  ? myAtt?.status === "yes"
                    ? t("mealPlan.imEating")
                    : t("mealPlan.notYetResponded")
                  : t("mealPlan.nothingPlanned");
                return (
                  <Pressable
                    key={day.date}
                    style={[styles.weekRow, { borderBottomColor: colors.border }]}
                    onPress={() => meal && router.push({ pathname: "/(app)/maaltijd/[id]", params: { id: meal.id } })}
                  >
                    <Text style={[styles.weekDay, { color: colors.textMuted }]}>
                      {dayLabel} {dayNum}
                    </Text>
                    <Text style={[styles.weekMeal, { color: colors.text }]} numberOfLines={1}>
                      {meal?.recipeTitle ?? "—"}
                    </Text>
                    <Text style={[styles.weekStatus, { color: colors.textMuted }]} numberOfLines={1}>
                      {statusText}
                    </Text>
                  </Pressable>
                );
              })}
              {restOfWeekDays.length === 0 && !weekQuery.error && (
                <Text style={[styles.emptySection, { color: colors.textMuted }]}>{t("mealPlan.nothingPlanned")}</Text>
              )}
            </View>

            {/* Shopping preview */}
            <View style={{ marginTop: SECTION_GAP, marginBottom: SECTION_GAP + 16 }}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("home.shoppingListTitle")}</Text>
                <Pressable onPress={() => router.push("/(app)/(tabs)/boodschappen")}>
                  <Text style={[styles.sectionLink, { color: colors.primary }]}>{t("mealPlan.viewAll")}</Text>
                </Pressable>
              </View>
              {shoppingQuery.error && (
                <Text style={[styles.errorText, { color: colors.danger }]}>{t("common.errorLoad")}</Text>
              )}
              {previewItems.length === 0 && !shoppingQuery.error && (
                <Text style={[styles.emptySection, { color: colors.textMuted }]}>{t("mealPlan.nothingPlanned")}</Text>
              )}
              {previewItems.map((item) => (
                <View key={item.id} style={[styles.shopRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.shopItemName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.amount && (
                    <Text style={[styles.shopItemQty, { color: colors.textMuted }]}>({formatAmount(item.amount)}{item.unit ? ` ${t(`units.${toCanonicalUnit(item.unit)}`, { count: Number(item.amount) || 1, defaultValue: item.unit })}` : ""})</Text>
                  )}
                </View>
              ))}
              {moreCount > 0 && (
                <View style={[styles.moreChip, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.moreChipText, { color: colors.textMuted }]}>
                    {t("home.moreItems", { count: moreCount })}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={householdSwitcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHouseholdSwitcherVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setHouseholdSwitcherVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("profile.households")}</Text>
            {sortedHouseholds.map((house, index) => {
              const active = house.id === householdId;
              return (
                <Pressable
                  key={house.id}
                  style={[
                    styles.modalRow,
                    index < sortedHouseholds.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                  onPress={() => {
                    setActiveHouseholdId(house.id);
                    setHouseholdSwitcherVisible(false);
                  }}
                >
                  <Text style={[styles.modalRowText, { color: colors.text }]} numberOfLines={1}>
                    {house.name}
                  </Text>
                  {active && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable style={[styles.modalCloseButton, { borderColor: colors.border }]} onPress={() => setHouseholdSwitcherVisible(false)}>
              <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: SECTION_GAP + 4 },
  greetingBlock: { marginBottom: 10 },
  greetingLead: { fontSize: 30, lineHeight: 34, fontWeight: "700", letterSpacing: -0.2 },
  greetingName: { fontSize: 31, lineHeight: 34, fontWeight: "800", letterSpacing: -0.25, marginTop: -1 },
  dateLine: { fontSize: 16, fontWeight: "500", marginBottom: 12 },
  householdLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  householdIcon: { marginRight: 1 },
  householdLinkText: { fontSize: 13, fontWeight: "500" },
  loadingBlock: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14 },
  tonightCardWrapper: { borderRadius: CARD_RADIUS, overflow: "hidden" },
  tonightCard: {
    padding: 20,
    borderRadius: CARD_RADIUS,
  },
  tonightCardOverlay: { backgroundColor: "rgba(0,0,0,0.5)" },
  tonightTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  tonightLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  eatWithUs: { fontSize: 13 },
  recipeTitle: { fontSize: 24, fontWeight: "700", marginBottom: 10 },
  tonightMeta: { flexDirection: "row", gap: 12, marginBottom: 16 },
  tonightMetaText: { fontSize: 13 },
  tonightActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  tonightYesBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: CHIP_RADIUS },
  tonightIconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  cardLink: { marginTop: 12, alignItems: "center" },
  linkText: { fontSize: 14, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  sectionLink: { fontSize: 14, fontWeight: "600" },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  weekDay: { fontSize: 13, fontWeight: "600", width: 44 },
  weekMeal: { flex: 1, fontSize: 15 },
  weekStatus: { fontSize: 13, maxWidth: 120 },
  errorText: { fontSize: 13, marginTop: 4 },
  emptySection: { fontSize: 14, fontStyle: "italic" },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  shopItemName: { fontSize: 15, flex: 1 },
  shopItemQty: { fontSize: 13 },
  moreChip: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: CHIP_RADIUS,
    marginTop: 8,
  },
  moreChipText: { fontSize: 13, fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 16, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: { borderRadius: 16, overflow: "hidden" },
  modalTitle: { fontSize: 18, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  modalRowText: { fontSize: 16, fontWeight: "500" },
  modalCloseButton: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { fontSize: 15, fontWeight: "600" },
});
