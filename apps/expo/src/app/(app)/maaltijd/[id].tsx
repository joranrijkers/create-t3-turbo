import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { prikkrDesign } from "~/theme/prikkr-design";
import { formatLongDate } from "~/utils/date";
import { formatAmount } from "~/utils/formatAmount";
import { toCanonicalUnit } from "~/utils/canonical-units";

const CARD_RADIUS = 16;
const SCREEN_PADDING = 20;
const AVATAR_COLORS = ["#FF7936", "#9C27B0", "#4CAF50", "#2196F3", "#FF5722", "#009688"];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length] ?? "#FF7936";
}

export default function MaaltijdDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = id ?? "";

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const { householdId } = useCurrentHousehold();
  const queryClient = useQueryClient();
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  const mealQuery = useQuery({
    ...trpc.mealPlan.byId.queryOptions({ id: mealId }),
    enabled: !!mealId,
  });
  const attendanceQuery = useQuery({
    ...trpc.attendance.forMealPlan.queryOptions({ mealPlanId: mealId }),
    enabled: !!mealId,
  });
  const recipeQuery = useQuery({
    ...trpc.recipe.byId.queryOptions({ id: mealQuery.data?.recipeId ?? "" }),
    enabled: !!mealQuery.data?.recipeId,
  });

  const respondMutation = useMutation({
    ...trpc.attendance.respond.mutationOptions(),
    onSuccess: () => { void attendanceQuery.refetch(); },
  });
  const addToListMutation = useMutation({
    ...trpc.shoppingList.addManual.mutationOptions(),
  });
  const deleteMutation = useMutation({
    ...trpc.mealPlan.delete.mutationOptions(),
    onSuccess: () => { router.back(); },
  });

  const meal = mealQuery.data;
  const attendances = attendanceQuery.data ?? [];
  const recipe = recipeQuery.data?.recipe;
  const ingredients = recipeQuery.data?.ingredients ?? [];

  useEffect(() => {
    if (ingredients.length > 0) {
      setCheckedIngredients(new Set(ingredients.map((i) => i.id)));
    }
  }, [ingredients.length]);

  const myAttendance = useMemo(
    () => (currentUserId ? attendances.find((a) => a.userId === currentUserId) : null),
    [attendances, currentUserId]
  );
  const cookUserId = meal?.cookUserId ?? null;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isTonight = meal?.date === today;

  const totalMinutes = recipe ? (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0) : 0;
  const tagLabels = useMemo(() => {
    const labels: string[] = [];
    const firstTag = recipe?.tags?.[0];
    if (firstTag) labels.push(firstTag);
    if (totalMinutes > 0) labels.push(`${totalMinutes} min`);
    if (recipe?.servings) labels.push(`${recipe.servings} ${t("recipes.servingsAbbrev")}`);
    return labels;
  }, [recipe, totalMinutes]);

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddToShoppingList = async () => {
    if (!householdId) return;
    const selected = ingredients.filter((i) => checkedIngredients.has(i.id));
    if (!selected.length) return;
    for (const ing of selected) {
      await addToListMutation.mutateAsync({
        householdId,
        name: ing.name,
        amount: ing.amount ?? undefined,
        unit: ing.unit ?? undefined,
      });
    }
    void queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey[0]) && (q.queryKey[0] as string[]).includes("shoppingList"),
    });
    Alert.alert(
      "Toegevoegd!",
      `${selected.length} item${selected.length === 1 ? "" : "s"} toegevoegd aan de boodschappenlijst.`,
      [{ text: "OK" }]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t("mealPlan.deleteMeal"),
      t("mealPlan.deleteConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: () => deleteMutation.mutate({ id: mealId }) },
      ]
    );
  };

  if (!mealId || mealQuery.error || (mealQuery.isSuccess && !meal)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t("mealPlan.mealNotFound")}</Text>
          <Pressable onPress={() => router.back()} style={[styles.pill, { backgroundColor: colors.surfaceVariant }]} accessibilityLabel={t("common.goBack")} accessibilityRole="button">
            <Text style={[{ color: colors.text, fontSize: 15, fontWeight: "600" }]}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (mealQuery.isPending || !meal) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header — full bleed into status bar */}
        <View style={[styles.header, { backgroundColor: colors.secondary, paddingTop: insets.top + 12 }]}>
          {recipe?.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          {/* Dark overlay for readability */}
          <View style={[StyleSheet.absoluteFillObject, styles.headerOverlay]} />

          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel={t("common.goBack")} accessibilityRole="button">
              <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push({ pathname: "/(app)/maaltijd/edit/[id]", params: { id: mealId } })}
                style={styles.headerBtn}
                accessibilityLabel={t("mealPlan.editMeal")}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.headerBtn} accessibilityLabel={t("common.delete")} accessibilityRole="button">
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF6B6B" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.headerDate}>
            {isTonight ? t("mealPlan.tonight").toUpperCase() : formatLongDate(meal.date ?? "").toUpperCase()}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {meal.recipeTitle ?? t("mealPlan.noRecipe")}
          </Text>

          {tagLabels.length > 0 && (
            <View style={styles.tagRow}>
              {tagLabels.map((label) => (
                <View key={label} style={styles.tag}>
                  <Text style={styles.tagText}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.body, { paddingHorizontal: SCREEN_PADDING }]}>
          {/* Attendance RSVP card — verborgen als je de kok bent */}
          {currentUserId !== cookUserId && <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t("mealPlan.areYouEating")}</Text>
            </View>
            <View style={styles.attendRow}>
              {(["yes", "maybe", "no"] as const).map((status) => {
                const isSelected = myAttendance?.status === status;
                const selectedBg =
                  status === "yes" ? colors.primary :
                  status === "maybe" ? colors.warning :
                  colors.textMuted;
                return (
                  <Pressable
                    key={status}
                    style={[
                      styles.attendOption,
                      { borderColor: isSelected ? "transparent" : colors.border },
                      isSelected && { backgroundColor: selectedBg, borderWidth: 0 },
                    ]}
                    onPress={() => respondMutation.mutate({ mealPlanId: mealId, status, guestCount: 0 })}
                    disabled={respondMutation.isPending}
                    accessibilityLabel={status === "yes" ? t("mealPlan.yes") : status === "no" ? t("mealPlan.no") : t("mealPlan.maybe")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: respondMutation.isPending }}
                  >
                    <Text style={[styles.attendOptionText, { color: isSelected ? "#FFFFFF" : colors.text }]}>
                      {status === "yes" ? t("mealPlan.yes") : status === "no" ? t("mealPlan.no") : t("mealPlan.maybe")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>}

          {/* Who's eating tonight */}
          <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isTonight ? t("mealPlan.tonight") : formatLongDate(meal.date ?? "")}
              </Text>
              <Text style={[styles.membersCount, { color: colors.textMuted }]}>
                {t("mealPlan.membersCount", { count: attendances.length })}
              </Text>
            </View>
            {attendances.length === 0 && (
              <Text style={[{ color: colors.textMuted, fontSize: 14 }]}>{t("mealPlan.noAttendees")}</Text>
            )}
            {attendances.map((a, idx) => {
              const isCook = a.userId === cookUserId;
              const isYes = a.status === "yes";
              return (
                <View
                  key={a.userId}
                  style={[
                    styles.participantRow,
                    idx < attendances.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(idx) }]}>
                    <Text style={styles.avatarText}>
                      {(a.userName ?? "?").trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.participantName, { color: colors.text }]} numberOfLines={1}>
                    {a.userName ?? t("common.you")}
                  </Text>
                  {isCook ? (
                    <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
                      <Text style={[styles.badgeText, { color: colors.primary }]}>{t("mealPlan.cookBadge")}</Text>
                    </View>
                  ) : (
                    <View style={[
                      styles.badge,
                      isYes ? { backgroundColor: "#E8F5E9" } :
                      a.status === "maybe" ? { backgroundColor: "#FFF8E1" } :
                      { backgroundColor: colors.surfaceVariant },
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        isYes ? { color: "#2E7D32" } :
                        a.status === "maybe" ? { color: "#F57F17" } :
                        { color: colors.textMuted },
                      ]}>
                        {a.status === "yes" ? t("mealPlan.yes") : a.status === "no" ? t("mealPlan.no") : t("mealPlan.maybe")}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* About recipe card */}
          {recipe && (
            <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t("mealPlan.aboutRecipe")}</Text>

              {recipe.description ? (
                <Text style={[styles.recipeDesc, { color: colors.textMuted }]} numberOfLines={4}>
                  {recipe.description}
                </Text>
              ) : null}

              {/* Info chips */}
              <View style={styles.infoGrid}>
                {ingredients.length > 0 && (
                  <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="food-variant" size={14} color={colors.primary} />
                    <Text style={[styles.infoChipLabel, { color: colors.textMuted }]}>{t("recipes.ingredients")}</Text>
                    <Text style={[styles.infoChipValue, { color: colors.text }]}>{ingredients.length}</Text>
                  </View>
                )}
                {(recipe.prepTimeMinutes ?? 0) > 0 && (
                  <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="knife" size={14} color={colors.primary} />
                    <Text style={[styles.infoChipLabel, { color: colors.textMuted }]}>{t("recipes.preparationLabel")}</Text>
                    <Text style={[styles.infoChipValue, { color: colors.text }]}>{recipe.prepTimeMinutes} min</Text>
                  </View>
                )}
                {(recipe.cookTimeMinutes ?? 0) > 0 && (
                  <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="pot-steam-outline" size={14} color={colors.primary} />
                    <Text style={[styles.infoChipLabel, { color: colors.textMuted }]}>{t("recipes.cookTimeLabel")}</Text>
                    <Text style={[styles.infoChipValue, { color: colors.text }]}>{recipe.cookTimeMinutes} min</Text>
                  </View>
                )}
                {recipe.createdByName && (
                  <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="account-outline" size={14} color={colors.primary} />
                    <Text style={[styles.infoChipLabel, { color: colors.textMuted }]}>{t("recipes.addedByLabel")}</Text>
                    <Text style={[styles.infoChipValue, { color: colors.text }]} numberOfLines={1}>{recipe.createdByName}</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={{ marginTop: 4 }}
                onPress={() => router.push({ pathname: "/(app)/recept/[id]", params: { id: recipe.id } })}
              >
                <Text style={[styles.viewRecipeText, { color: colors.primary }]}>
                  {t("mealPlan.viewRecipe")} →
                </Text>
              </Pressable>
            </View>
          )}

          {/* Ingrediënten naar boodschappenlijst */}
          {ingredients.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
              <View style={styles.cardTitleRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t("mealPlan.shoppingListCardTitle")}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{t("mealPlan.shoppingListCardSubtitle")}</Text>
                </View>
                <Pressable
                  onPress={() => setCheckedIngredients(checkedIngredients.size === ingredients.length ? new Set() : new Set(ingredients.map((i) => i.id)))}
                  style={styles.selectAllRow}
                  accessibilityLabel={checkedIngredients.size === ingredients.length ? t("mealPlan.deselectAll") : t("mealPlan.selectAll")}
                  accessibilityRole="button"
                >
                  <Text style={[styles.selectAllText, { color: colors.primary }]}>
                    {checkedIngredients.size === ingredients.length ? t("mealPlan.allInHouse") : t("mealPlan.allNeeded")}
                  </Text>
                </Pressable>
              </View>
              {ingredients.map((ing, idx) => {
                const isChecked = checkedIngredients.has(ing.id);
                return (
                  <Pressable
                    key={ing.id}
                    style={[
                      styles.ingredientRow,
                      idx < ingredients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                    onPress={() => toggleIngredient(ing.id)}
                    accessibilityLabel={`${ing.name}. ${isChecked ? t("mealPlan.inHouse") : t("mealPlan.needed")}. ${t("mealPlan.doubleTapToEdit")}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    <View style={[
                      styles.ingCheckbox,
                      { borderColor: isChecked ? colors.primary : colors.border },
                      isChecked && { backgroundColor: colors.primary },
                    ]}>
                      {isChecked && <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.ingName, { color: isChecked ? colors.text : colors.textMuted }, !isChecked && styles.ingStrike]} numberOfLines={1}>
                      {ing.name}
                    </Text>
                    {(ing.amount ?? ing.unit) ? (
                      <Text style={[styles.ingAmount, { color: colors.textMuted }]}>
                        {formatAmount(ing.amount)}{ing.unit ? ` ${t(`units.${toCanonicalUnit(ing.unit)}`, { count: Number(ing.amount) || 1, defaultValue: ing.unit })}` : ""}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                style={[
                  styles.addToListBtn,
                  { backgroundColor: checkedIngredients.size > 0 ? colors.primary : colors.surfaceVariant },
                  addToListMutation.isPending && { opacity: 0.7 },
                ]}
                onPress={() => void handleAddToShoppingList()}
                disabled={addToListMutation.isPending || checkedIngredients.size === 0}
                accessibilityLabel={checkedIngredients.size > 0 ? t("mealPlan.addToShoppingListA11y", { count: checkedIngredients.size }) : t("mealPlan.selectItemsToAdd")}
                accessibilityRole="button"
                accessibilityState={{ disabled: addToListMutation.isPending || checkedIngredients.size === 0 }}
              >
                {addToListMutation.isPending
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <>
                      <MaterialCommunityIcons name="cart-plus" size={18} color={checkedIngredients.size > 0 ? "#FFFFFF" : colors.textMuted} />
                      <Text style={[styles.addToListBtnText, { color: checkedIngredients.size > 0 ? "#FFFFFF" : colors.textMuted }]}>
                        {checkedIngredients.size > 0
                          ? t("mealPlan.addToShoppingListButton", { count: checkedIngredients.size })
                          : t("mealPlan.selectItemsToAdd")}
                      </Text>
                    </>
                }
              </Pressable>
            </View>
          )}

          {meal.recipeId && !recipe && !recipeQuery.isPending && (
            <Pressable
              style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}
              onPress={() => router.push({ pathname: "/(app)/recept/[id]", params: { id: meal.recipeId! } })}
            >
              <Text style={[styles.viewRecipeText, { color: colors.primary }]}>
                {t("mealPlan.viewRecipe")} →
              </Text>
            </Pressable>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: SCREEN_PADDING },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontSize: 18, fontWeight: "600" },
  pill: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },

  // Header
  header: {
    paddingBottom: 28,
    paddingHorizontal: SCREEN_PADDING,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerOverlay: {
    backgroundColor: "rgba(0,0,0,0.52)",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerDate: { fontSize: 12, fontWeight: "600", letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", marginBottom: 6 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 16, lineHeight: 34 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" },
  tagText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  // Body
  body: { paddingTop: 20, gap: 16 },
  card: { borderRadius: CARD_RADIUS, padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  membersCount: { fontSize: 14 },

  // Attendance
  attendRow: { flexDirection: "row", gap: 8 },
  attendOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  attendOptionText: { fontSize: 13, fontWeight: "600" },

  // Members
  participantRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  participantName: { flex: 1, fontSize: 15 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  // Recipe
  recipeDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 14 },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  infoChipLabel: { fontSize: 12 },
  infoChipValue: { fontSize: 13, fontWeight: "700" },
  viewRecipeText: { fontSize: 15, fontWeight: "600" },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  selectAllRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  selectAllText: { fontSize: 13, fontWeight: "600" },
  ingredientRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  ingCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ingName: { flex: 1, fontSize: 15 },
  ingStrike: { textDecorationLine: "line-through" },
  ingAmount: { fontSize: 13, flexShrink: 0 },
  addToListBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 50, borderRadius: 14, gap: 8, marginTop: 14 },
  addToListBtnText: { fontSize: 15, fontWeight: "600" },
  bottomSpacer: { height: 24 },
});
