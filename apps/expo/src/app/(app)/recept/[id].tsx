import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { toCanonicalUnit } from "~/utils/canonical-units";
import { formatAmount } from "~/utils/formatAmount";
import { prikkrDesign } from "~/theme/prikkr-design";

const SCREEN_PADDING = 20;
const CARD_RADIUS = 16;
const HEADER_COLORS = ["#C49A6C", "#FF7936", "#4CAF50", "#C62828", "#FF8F00"];

export default function ReceptDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ?? "";
  const { householdId } = useCurrentHousehold();
  const { data: session } = authClient.useSession();
  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [showAllSteps, setShowAllSteps] = useState(false);

  const recipeQuery = useQuery({
    ...trpc.recipe.byId.queryOptions({ id: recipeId }),
    enabled: !!recipeId,
  });
  const planMutation = useMutation({
    ...trpc.mealPlan.create.mutationOptions(),
    onSuccess: (data) => {
      router.push({ pathname: "/(app)/maaltijd/[id]", params: { id: data.id } });
    },
  });
  const deleteMutation = useMutation({
    ...trpc.recipe.softDelete.mutationOptions(),
    onSuccess: () => router.back(),
  });

  const recipe = recipeQuery.data?.recipe;
  const ingredients = recipeQuery.data?.ingredients ?? [];
  const totalMin = recipe ? (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0) : 0;

  const headerColor = useMemo(() => {
    if (!recipe) return "#C49A6C";
    const tag = recipe.tags?.[0]?.toLowerCase() ?? "";
    if (tag === "vegetarisch") return "#4CAF50";
    if (tag === "vegan") return "#2E7D32";
    if (tag === "italiaans") return "#C62828";
    if (tag === "aziatisch") return "#FF8F00";
    return "#C49A6C";
  }, [recipe]);

  const handlePlan = () => {
    if (!householdId || !recipe) return;
    const today = new Date().toISOString().slice(0, 10);
    planMutation.mutate({ householdId, recipeId: recipe.id, date: today, mealType: "dinner" });
  };

  const handleDelete = () => {
    Alert.alert(t("recipes.deleteRecipe"), t("recipes.deleteRecipeConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteMutation.mutate({ id: recipeId }) },
    ]);
  };

  if (!recipeId || recipeQuery.error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t("recipes.recipeNotFound")}</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.backBtnText, { color: colors.text }]}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (recipeQuery.isPending) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={[]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Colored header */}
        <View style={[styles.headerBg, { backgroundColor: headerColor }]}>
          {recipe?.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
          <View style={styles.headerControls}>
            <Pressable onPress={() => router.back()} style={styles.headerButton}>
              <MaterialCommunityIcons name="chevron-left" size={26} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerRightButtons}>
              <Pressable style={styles.headerButton} onPress={() => router.push({ pathname: "/(app)/recept/edit/[id]", params: { id: recipeId } })}>
                <MaterialCommunityIcons name="pencil-outline" size={22} color="#FFFFFF" />
              </Pressable>
              <Pressable style={styles.headerButton} onPress={handleDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Recipe content */}
        <View style={[styles.body, { paddingHorizontal: SCREEN_PADDING }]}>
          <Text style={[styles.recipeTitle, { color: colors.text }]}>{recipe?.title}</Text>

          <View style={styles.metaRow}>
            {totalMin > 0 && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{totalMin} min</Text>
              </View>
            )}
            {recipe?.servings && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="account-multiple-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {t("recipes.servingsPeople", { count: recipe.servings })}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.tagAuthorRow}>
            {recipe?.tags?.slice(0, 1).map((tag) => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.tagPillText, { color: colors.text }]}>{tag.toUpperCase()}</Text>
              </View>
            ))}
            {recipe?.createdByName && (
              <View style={styles.authorRow}>
                <View style={[styles.authorAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.authorAvatarText}>{recipe.createdByName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.authorText, { color: colors.textMuted }]}>
                  {t("recipes.byAuthor", { name: recipe.createdByName })}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.planButton, { backgroundColor: colors.primary }]}
              onPress={handlePlan}
              disabled={planMutation.isPending}
            >
              {planMutation.isPending
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <>
                    <MaterialCommunityIcons name="calendar" size={20} color="#FFFFFF" />
                    <Text style={styles.planButtonText}>{t("recipes.planButton")}</Text>
                  </>
              }
            </Pressable>
            <Pressable style={[styles.bookmarkButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="bookmark-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("recipes.ingredients")}</Text>
                {recipe?.servings && (
                  <View style={[styles.servingsBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.servingsBadgeText}>{recipe.servings} {t("recipes.servingsAbbrev")}</Text>
                  </View>
                )}
              </View>
              {ingredients.map((ing) => (
                <View key={ing.id} style={styles.ingredientRow}>
                  <View style={[styles.ingredientDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.ingredientName, { color: colors.text }]}>{ing.name}</Text>
                  <Text style={[styles.ingredientAmount, { color: colors.textMuted }]}>
                    {formatAmount(ing.amount)}{ing.unit ? ` ${t(`units.${toCanonicalUnit(ing.unit)}`, { count: Number(ing.amount) || 1, defaultValue: ing.unit })}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          {recipe?.instructions && recipe.instructions.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }, prikkrDesign.shadow.card]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t("recipes.instructions")}</Text>
              {recipe.instructions.slice(0, showAllSteps ? undefined : 2).map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.textMuted }]}>{step.text}</Text>
                </View>
              ))}
              {recipe.instructions.length > 2 && (
                <Pressable style={styles.allStepsLink} onPress={() => setShowAllSteps((v) => !v)}>
                  <Text style={[styles.allStepsText, { color: colors.text }]}>
                    {showAllSteps ? t("recipes.viewLessSteps") : t("recipes.viewAllSteps")}
                  </Text>
                </Pressable>
              )}
            </View>
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
  scrollContent: { paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: "600" },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 16, fontWeight: "600" },
  headerBg: { height: 200, paddingTop: 52 },
  headerControls: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  headerRightButtons: { flexDirection: "row", gap: 10 },
  body: { paddingTop: 20 },
  recipeTitle: { fontSize: 26, fontWeight: "700", marginBottom: 12 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 14 },
  tagAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  tagPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagPillText: { fontSize: 11, fontWeight: "700" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  authorAvatarText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  authorText: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  planButton: { flex: 1, height: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  planButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  bookmarkButton: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: CARD_RADIUS, padding: 16, marginBottom: 16 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  servingsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  servingsBadgeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  ingredientRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  ingredientDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  ingredientName: { flex: 1, fontSize: 15 },
  ingredientAmount: { fontSize: 14, textAlign: "right" },
  stepRow: { flexDirection: "row", gap: 12, paddingVertical: 10, alignItems: "flex-start" },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  stepNumberText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  allStepsLink: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#EDE7E0" },
  allStepsText: { fontSize: 15, fontWeight: "600" },
  bottomSpacer: { height: 16 },
});
