import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { prikkrDesign } from "~/theme/prikkr-design";
import {
  getMondayOfWeek,
  getDayShortKey,
  getDayOfMonth,
  getNextWeekStart,
  getPrevWeekStart,
  getWeekNumberAndYear,
} from "~/utils/date";

const SCREEN_PADDING = 20;
const SECTION_GAP = 24;
const CARD_RADIUS = 16;
const DAY_STRIP_ITEM_SIZE = 44;

export default function MaaltijdplanScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { householdId, household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultWeekStart = useMemo(() => getMondayOfWeek(today), [today]);
  const [weekStartDate, setWeekStartDate] = useState(defaultWeekStart);

  const weekQuery = useQuery({
    ...trpc.mealPlan.forWeek.queryOptions({ householdId: householdId!, weekStartDate }),
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
  }, [weekQuery]);

  const currentUserId = session?.user?.id ?? null;
  const weekData = weekQuery.data;
  const isLoading = householdLoading || (!!householdId && weekQuery.isPending && !weekQuery.data);
  const isRefreshing = weekQuery.isFetching;

  const { week: weekNum, year: weekYear } = useMemo(
    () => getWeekNumberAndYear(weekStartDate),
    [weekStartDate]
  );
  const weekSubtitle = t("mealPlan.weekSubtitle", { week: weekNum, year: weekYear });
  const goPrevWeek = useCallback(() => setWeekStartDate((p) => getPrevWeekStart(p)), []);
  const goNextWeek = useCallback(() => setWeekStartDate((p) => getNextWeekStart(p)), []);

  if (!householdId && !householdLoading) {
    if (householdError) {
      const refetchHousehold = () => {
        void queryClient.invalidateQueries({ queryKey: [["household", "myHouseholds"]] });
      };
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.center, { padding: SCREEN_PADDING }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={56} color={colors.danger} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.errorHouseholdLoad")}</Text>
            <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={refetchHousehold}>
              <Text style={styles.primaryButtonText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
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
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t("home.weekPlanner")}</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {household ? `${household.name} · ${weekSubtitle}` : weekSubtitle}
            </Text>
            <View style={styles.weekNavCircles}>
              <Pressable
                onPress={goPrevWeek}
                style={[styles.circleButton, { backgroundColor: colors.surfaceVariant }]}
                accessibilityLabel={t("mealPlan.prevWeek")}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={goNextWeek}
                style={[styles.circleButton, { backgroundColor: colors.surfaceVariant }]}
                accessibilityLabel={t("mealPlan.nextWeek")}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t("common.loading")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.dayStrip}>
              {weekData?.days?.map((day) => {
                const dayLabel = t(`mealPlan.dayShort.${getDayShortKey(day.date)}`).toUpperCase();
                const dayNum = getDayOfMonth(day.date);
                const isToday = day.date === today;
                return (
                  <View key={day.date} style={styles.dayStripItem}>
                    <View
                      style={[
                        styles.dayStripPill,
                        isToday && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayStripAbbr,
                          { color: isToday ? "#FFFFFF" : colors.textMuted },
                        ]}
                      >
                        {dayLabel}
                      </Text>
                      <Text
                        style={[
                          styles.dayStripNum,
                          { color: isToday ? "#FFFFFF" : colors.text },
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {weekQuery.error && (
              <View style={[styles.errorBlock, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{t("common.errorLoad")}</Text>
                <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => weekQuery.refetch()}>
                  <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
                </Pressable>
              </View>
            )}

            {!weekQuery.error && (!weekData?.days || weekData.days.length === 0) ? (
            <View style={[styles.emptyWeekBlock, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("mealPlan.emptyWeekTitle")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("mealPlan.emptyWeekSubtitle")}</Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push({ pathname: "/(app)/maaltijd/plan", params: { date: today } })}
                accessibilityLabel={t("mealPlan.planFirstMeal")}
                accessibilityRole="button"
                accessibilityHint={t("mealPlan.planFirstMealHint")}
              >
                <Text style={styles.primaryButtonText}>{t("mealPlan.planFirstMeal")}</Text>
              </Pressable>
            </View>
            ) : !weekQuery.error ? (
            <View style={styles.cardsList}>
              {(weekData?.days ?? []).map((day) => {
                const dinner = day.meals.find((m) => m.mealType === "dinner") ?? day.meals[0];
                const isToday = day.date === today;
                const dayLabel = t(`mealPlan.dayShort.${getDayShortKey(day.date)}`).toUpperCase();
                const dayNum = getDayOfMonth(day.date);
                const mealTypeLabel = dinner
                  ? t(`mealPlan.mealType.${dinner.mealType as "breakfast" | "lunch" | "dinner"}`).toUpperCase()
                  : t("mealPlan.mealType.dinner").toUpperCase();

                if (dinner) {
                  const myAtt = dinner.attendances.find((a) => a.userId === currentUserId);
                  const attendingCount = dinner.attendances.filter((a) => a.status === "yes").length;
                  const cookFirstName = dinner.cookName?.trim().split(" ")[0] ?? null;
                  const cookInitial = cookFirstName?.charAt(0)?.toUpperCase() ?? "?";

                  return (
                    <Pressable
                      key={day.date}
                      style={[styles.mealCard, { backgroundColor: colors.card }, prikkrDesign.shadow.card, isToday && { borderLeftWidth: 3, borderLeftColor: colors.primary }]}
                      onPress={() => router.push({ pathname: "/(app)/maaltijd/[id]", params: { id: dinner.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${dinner.recipeTitle ?? t("mealPlan.noRecipe")}, ${dayLabel} ${dayNum}. ${cookFirstName ? t("home.cooks", { name: cookFirstName }) : ""} ${t("mealPlan.attendingCount", { count: attendingCount })}.`}
                      accessibilityHint={t("mealPlan.mealCardHint")}
                    >
                      {/* Left: info */}
                      <View style={styles.mealCardContent}>
                        <View style={styles.mealCardTop}>
                          <Text style={[styles.mealCardMeta, { color: isToday ? colors.primary : colors.textMuted }]}>
                            {dayLabel} {dayNum} · {mealTypeLabel}
                          </Text>
                        </View>
                        <Text style={[styles.mealCardTitle, { color: colors.text }]} numberOfLines={2}>
                          {dinner.recipeTitle ?? t("mealPlan.noRecipe")}
                        </Text>
                        <View style={styles.mealCardCookRow}>
                          <View style={[styles.cookAvatar, { backgroundColor: colors.primary }]}>
                            <Text style={styles.cookAvatarText}>{cookInitial}</Text>
                          </View>
                          <Text style={[styles.cookLine, { color: colors.textMuted }]}>
                            {cookFirstName ? t("home.cooks", { name: cookFirstName }) : ""}
                            {cookFirstName ? " · " : ""}{attendingCount}×
                          </Text>
                          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </View>
                      </View>

                      {/* Right: image */}
                      {dinner.recipeImageUrl ? (
                        <View style={styles.mealCardImageWrap}>
                          <Image
                            source={{ uri: dinner.recipeImageUrl }}
                            style={styles.mealCardImage}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={day.date}
                    style={[styles.emptyCard, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}
                    onPress={() =>
                      router.push({ pathname: "/(app)/maaltijd/plan", params: { date: day.date } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${dayLabel} ${dayNum}, ${t("mealPlan.planMealForDay")}`}
                    accessibilityHint={t("mealPlan.planFirstMealHint")}
                  >
                    <Text style={[styles.mealCardMeta, { color: colors.textMuted }]}>
                      {dayLabel} {dayNum} · {t("mealPlan.mealType.dinner").toUpperCase()}
                    </Text>
                    <View style={styles.emptyCardAdd}>
                      <MaterialCommunityIcons name="plus" size={18} color={colors.textMuted} />
                      <Text style={[styles.emptyCardText, { color: colors.textMuted }]}>
                        {t("mealPlan.planMealForDay")}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: SECTION_GAP + 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  subtitle: { fontSize: 14, flex: 1 },
  weekNavCircles: { flexDirection: "row", gap: 8 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBlock: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyWeekBlock: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  errorBlock: {
    flexDirection: "column",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  dayStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SECTION_GAP,
  },
  dayStripItem: { alignItems: "center", minWidth: DAY_STRIP_ITEM_SIZE },
  dayStripPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 40,
  },
  dayStripAbbr: { fontSize: 11, fontWeight: "700" },
  dayStripNum: { fontSize: 14, fontWeight: "700" },
  errorText: { fontSize: 14, marginBottom: 12 },
  cardsList: { gap: 12 },
  mealCard: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    flexDirection: "row",
    height: 120,
  },
  mealCardContent: { flex: 1, padding: 14, justifyContent: "space-between" },
  mealCardImageWrap: { width: 110 },
  mealCardImage: { width: "100%", height: "100%" },
  mealCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  mealCardMeta: { fontSize: 12 },
  vandaagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  vandaagPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  mealCardTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  mealCardCookRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  cookAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  cookLine: { fontSize: 13 },
  attendButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  attendButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  emptyCard: {
    borderRadius: CARD_RADIUS,
    padding: 16,
  },
  emptyCardAdd: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  emptyCardText: { fontSize: 15, fontWeight: "500" },
  primaryButton: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, marginBottom: 16, textAlign: "center" },
});
