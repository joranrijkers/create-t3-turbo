import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { prikkrDesign } from "~/theme/prikkr-design";
import { getMondayOfWeek, getDayShortKey, getDayOfMonth } from "~/utils/date";

const SCREEN_PADDING = 20;
const CARD_RADIUS = 16;

type RecipeItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  tags: string[];
};

export default function PlanMaaltijdScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { householdId, isLoading: householdLoading } = useCurrentHousehold();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekStart = useMemo(() => getMondayOfWeek(today), [today]);

  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = params.date ?? today;
    return typeof d === "string" ? d : today;
  });
  const [cookUserId, setCookUserId] = useState<string | null>(null);
  const [hasSetCookDefault, setHasSetCookDefault] = useState(false);
  const [notes, setNotes] = useState("");

  const weekDays = useMemo(() => {
    const parts = weekStart.split("-").map(Number);
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.UTC(y, m - 1, d + i));
      days.push(date.toISOString().slice(0, 10));
    }
    return days;
  }, [weekStart]);

  const recipesQuery = useQuery({
    ...trpc.recipe.list.queryOptions({
      householdId: householdId!,
      search: search.trim() || undefined,
      limit: 20,
    }),
    enabled: !!householdId,
  });
  const membersQuery = useQuery({
    ...trpc.household.members.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });

  const createMutation = useMutation({
    ...trpc.mealPlan.create.mutationOptions(),
    onSuccess: (data) => {
      router.replace({ pathname: "/(app)/maaltijd/[id]", params: { id: data.id } });
    },
  });

  const conflictsQuery = useQuery({
    ...trpc.mealPlan.previewRecipeConflicts.queryOptions({
      householdId: householdId!,
      recipeId: selectedRecipe?.id ?? "",
    }),
    enabled: !!householdId && !!selectedRecipe?.id,
  });
  const conflictsData = conflictsQuery.data;
  const hasConflicts = conflictsData?.summary?.hasConflicts ?? false;

  const recipes = recipesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const isLoading = householdLoading || !householdId;

  useEffect(() => {
    if (hasSetCookDefault) return;
    if (!currentUserId) return;
    if (!members.some((member) => member.userId === currentUserId)) return;

    setCookUserId(currentUserId);
    setHasSetCookDefault(true);
  }, [hasSetCookDefault, currentUserId, members]);

  const handleSubmit = useCallback(() => {
    if (!householdId) return;
    if (!selectedRecipe?.id) {
      Alert.alert(t("common.error"), t("mealPlan.chooseRecipe"));
      return;
    }

    createMutation.mutate({
      householdId,
      date: selectedDate,
      mealType: "dinner",
      recipeId: selectedRecipe.id,
      cookUserId: cookUserId ?? undefined,
      notes: notes.trim() || undefined,
    });
  }, [householdId, selectedDate, selectedRecipe, cookUserId, notes, createMutation, t]);

  if (isLoading || !householdId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack} accessibilityLabel={t("common.goBack")}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("mealPlan.planMeal")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("mealPlan.recipeRequired")}</Text>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border }]}
              placeholder={t("mealPlan.searchRecipePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {selectedRecipe ? (
              <Pressable
                style={[styles.recipeCard, styles.recipeCardSelected, { borderColor: colors.primary, backgroundColor: colors.card }, prikkrDesign.shadow.card]}
                onPress={() => setSelectedRecipe(null)}
              >
                {selectedRecipe.imageUrl ? (
                  <Image source={{ uri: selectedRecipe.imageUrl }} style={styles.recipeImage} />
                ) : (
                  <View style={[styles.recipeImagePlaceholder, { backgroundColor: colors.surfaceVariant }]} />
                )}
                <View style={styles.recipeCardBody}>
                  <Text style={[styles.recipeCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {selectedRecipe.title}
                  </Text>
                  <Text style={[styles.recipeCardMeta, { color: colors.textMuted }]}>
                    {[selectedRecipe.prepTimeMinutes || selectedRecipe.cookTimeMinutes, selectedRecipe.servings, selectedRecipe.tags?.[0]].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={[styles.recipeCardCheck, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="check" size={22} color="#FFFFFF" />
                </View>
              </Pressable>
            ) : (
              recipes.slice(0, 5).map((r) => {
                const totalMin = (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0);
                const meta = [totalMin ? `${totalMin} ${t("common.min")}` : null, r.servings ? `${r.servings} ${t("recipes.servingsAbbrev")}` : null, r.tags?.[0]].filter(Boolean).join(" · ");
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }, prikkrDesign.shadow.card]}
                    onPress={() => setSelectedRecipe(r as RecipeItem)}
                  >
                    {r.imageUrl ? (
                      <Image source={{ uri: r.imageUrl }} style={styles.recipeImage} />
                    ) : (
                      <View style={[styles.recipeImagePlaceholder, { backgroundColor: colors.surfaceVariant }]} />
                    )}
                    <View style={styles.recipeCardBody}>
                      <Text style={[styles.recipeCardTitle, { color: colors.text }]} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={[styles.recipeCardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {meta || "—"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
            {!selectedRecipe && recipes.length === 0 && !recipesQuery.isPending && (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t("mealPlan.chooseRecipe")}</Text>
            )}
          </View>

          {hasConflicts && conflictsData && (
            <View style={[styles.conflictBanner, { backgroundColor: colors.surfaceVariant, borderLeftColor: colors.danger }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.danger} />
              <View style={styles.conflictBannerContent}>
                <Text style={[styles.conflictBannerTitle, { color: colors.text }]}>{t("allergyWarning.title")}</Text>
                {(conflictsData.conflicts ?? []).slice(0, 3).map((c, i) => {
                  const participant = conflictsData.participants?.find((p) => p.userId === c.userId);
                  const name = participant?.name ?? "—";
                  const evidence = c.evidence?.[0] ?? c.matchedPreference;
                  return (
                    <Text key={`${c.userId}-${c.matchedPreference}-${i}`} style={[styles.conflictBannerLine, { color: colors.textMuted }]}>
                      {t("allergyWarning.memberHasAllergy", { name, allergy: c.matchedPreference, ingredient: evidence })}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("mealPlan.day")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              {weekDays.map((date) => {
                const dayLabel = t(`mealPlan.dayShort.${getDayShortKey(date)}`);
                const dayNum = getDayOfMonth(date);
                const isSelected = date === selectedDate;
                return (
                  <Pressable
                    key={date}
                    style={[styles.dayChip, isSelected && { backgroundColor: colors.primary }]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[styles.dayChipLabel, { color: isSelected ? "#FFFFFF" : colors.text }]}>
                      {dayLabel} {dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("mealPlan.whoCooks")}</Text>
            <View style={styles.cooksRow}>
              {members.map((m) => {
                const fullName = (m.name ?? "?").trim();
                const firstName = fullName.split(/\s+/)[0] ?? "?";
                const isSelected = cookUserId === m.userId;

                return (
                  <View key={m.userId} style={styles.cookItem}>
                    <Pressable
                      style={[
                        styles.cookAvatar,
                        { backgroundColor: isSelected ? colors.primary : colors.surfaceVariant },
                      ]}
                      onPress={() => setCookUserId(isSelected ? null : m.userId)}
                    >
                      <Text style={styles.cookAvatarText}>{fullName.charAt(0).toUpperCase()}</Text>
                    </Pressable>
                    <Text style={[styles.cookNameText, { color: isSelected ? colors.text : colors.textMuted }]} numberOfLines={1}>
                      {firstName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("mealPlan.notesOptional")}</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border }]}
              placeholder={t("mealPlan.notesPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }, !selectedRecipe && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={createMutation.isPending || !selectedRecipe}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="calendar-plus" size={22} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{t("mealPlan.planMealCta")}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBack: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  searchInput: {
    height: 48,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: CARD_RADIUS,
    padding: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  recipeCardSelected: { borderWidth: 2 },
  recipeImage: { width: 56, height: 56, borderRadius: 12 },
  recipeImagePlaceholder: { width: 56, height: 56, borderRadius: 12 },
  recipeCardBody: { flex: 1, marginLeft: 12, minWidth: 0 },
  recipeCardTitle: { fontSize: 16, fontWeight: "600" },
  recipeCardMeta: { fontSize: 13, marginTop: 2 },
  recipeCardCheck: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  hint: { fontSize: 14 },
  conflictBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 24,
    gap: 10,
  },
  conflictBannerContent: { flex: 1 },
  conflictBannerTitle: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  conflictBannerLine: { fontSize: 13, marginTop: 4 },
  dayStrip: { flexDirection: "row", gap: 10 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dayChipLabel: { fontSize: 14, fontWeight: "600" },
  cooksRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  cookItem: { width: 56, alignItems: "center", gap: 6 },
  cookAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cookAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  cookNameText: { fontSize: 12, fontWeight: "600", textAlign: "center", width: "100%" },
  notesInput: {
    minHeight: 80,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: CARD_RADIUS,
    gap: 10,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
