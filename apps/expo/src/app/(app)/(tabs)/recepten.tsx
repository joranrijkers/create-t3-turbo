import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, TextInput, FlatList, Dimensions, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { trpc } from "~/utils/api";

const SCREEN_PADDING = 16;
const CARD_RADIUS = 16;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - SCREEN_PADDING * 2 - 12) / 2;

const TAG_COLORS: Record<string, string> = {
  vegetarisch: "#4CAF50",
  vegan: "#2E7D32",
  pasta: "#FF7936",
  aziatisch: "#FF8F00",
  italiaans: "#C62828",
  snel: "#2196F3",
};

function getRecipeColor(tags?: string[]) {
  if (!tags?.length) return "#FF7936";
  const t = tags[0]?.toLowerCase() ?? "";
  return TAG_COLORS[t] ?? "#FF7936";
}

const AVATAR_COLORS = ["#FF7936", "#4CAF50", "#9C27B0", "#2196F3"];
function getAvatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length] ?? "#FF7936"; }

const FILTER_TAGS = [
  { key: "", labelKey: "recipes.filters.all" as const },
  { key: "vegetarisch", labelKey: "recipes.filters.vegetarian" as const },
  { key: "vegan", labelKey: "recipes.filters.vegan" as const },
  { key: "snel", labelKey: "recipes.filters.quick" as const },
];

export default function ReceptenScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { householdId, isLoading: householdLoading, error: householdError } = useCurrentHousehold();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const PAGE_SIZE = 20;
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [search, activeTag]);

  const recipesQuery = useQuery({
    ...trpc.recipe.list.queryOptions({
      householdId: householdId!,
      search: search.trim() || undefined,
      tags: activeTag ? [activeTag] : undefined,
      limit,
      offset: 0,
    }),
    enabled: !!householdId,
  });

  const recipes = recipesQuery.data ?? [];
  const hasMore = recipes.length === limit;
  const loadMore = useCallback(() => setLimit((p) => p + PAGE_SIZE), []);
  const isLoading = householdLoading || (!!householdId && recipesQuery.isPending && !recipesQuery.data);
  const refresh = useCallback(() => {
    setLimit(PAGE_SIZE);
    void recipesQuery.refetch();
  }, [recipesQuery]);

  const renderCard = useCallback(({ item, index }: { item: typeof recipes[number]; index: number }) => {
    const totalMin = (item.prepTimeMinutes ?? 0) + (item.cookTimeMinutes ?? 0);
    const color = getRecipeColor(item.tags);
    const categoryLabel = item.tags?.[0]?.toUpperCase() ?? "";
    const creatorInitial = (item.title?.charAt(0) ?? "?").toUpperCase();
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, marginLeft: index % 2 === 1 ? 12 : 0 }]}
        onPress={() => router.push({ pathname: "/(app)/recept/[id]", params: { id: item.id } })}
        accessibilityLabel={`${item.title}. ${item.tags?.[0] ?? ""}.`}
        accessibilityRole="button"
      >
        <View style={[styles.cardHeader, { backgroundColor: color }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          {categoryLabel ? (
            <View style={styles.cardCategoryPill}>
              <Text style={styles.cardCategory}>{categoryLabel}</Text>
            </View>
          ) : null}
          <View style={[styles.heartButton, { opacity: 0.5 }]} pointerEvents="none">
            <MaterialCommunityIcons name="heart-outline" size={18} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.creatorAvatar, { backgroundColor: getAvatarColor(index) }]}>
              <Text style={styles.creatorAvatarText}>{creatorInitial}</Text>
            </View>
            <Text style={[styles.cardMetaText, { color: colors.textMuted }]} numberOfLines={1}>
              {totalMin > 0 ? `· ${totalMin} min` : ""}
            </Text>
          </View>
          {item.servings ? (
            <View style={[styles.servingsBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.servingsBadgeText, { color: colors.text }]}>
                {item.servings} {t("recipes.servingsAbbrev")}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }, [colors, router, t]);

  if (!householdId && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
          <View style={[styles.header, { paddingHorizontal: SCREEN_PADDING }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t("recipes.title")}</Text>
          </View>
          <View style={[styles.errorWrap, { backgroundColor: colors.background }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.errorHouseholdLoad")}</Text>
            <Pressable
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => queryClient.invalidateQueries({ queryKey: [["household", "myHouseholds"]] })}
            >
              <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[styles.header, { paddingHorizontal: SCREEN_PADDING }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t("recipes.title")}</Text>
        </View>
        <View style={[styles.emptyWrap, { flex: 1 }]}>
          <MaterialCommunityIcons name="home-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("profile.emptyTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.emptySubtitle")}</Text>
          <Pressable
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(onboarding)/welcome")}
          >
            <Text style={styles.emptyButtonText}>{t("profile.goToOnboarding")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { paddingHorizontal: SCREEN_PADDING }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t("recipes.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("recipes.collectionCount", { count: recipes.length })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.surfaceVariant }]}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityLabel={showSearch ? t("recipes.searchHide") : t("recipes.searchShow")}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="magnify" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            style={[styles.fabSmall, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(app)/recept/new")}
            accessibilityLabel={t("recipes.addRecipeA11y")}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {showSearch && (
        <View style={[styles.searchWrap, { paddingHorizontal: SCREEN_PADDING }]}>
          <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchTextInput, { color: colors.text }]}
              placeholder={t("recipes.searchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={[styles.filtersContent, { paddingHorizontal: SCREEN_PADDING }]}
      >
        {FILTER_TAGS.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterChip,
              activeTag === f.key
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => setActiveTag(f.key)}
          >
            <Text style={[styles.filterChipText, { color: activeTag === f.key ? "#FFFFFF" : colors.text }]}>
              {t(f.labelKey)}{f.key === "" ? ` (${recipes.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : recipesQuery.isError ? (
        <View style={[styles.errorWrap, { backgroundColor: colors.background }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => recipesQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingHorizontal: SCREEN_PADDING, paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={recipesQuery.isFetching} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="chef-hat" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("recipes.noRecipes")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("recipes.emptySubtitle")}</Text>
              <Pressable style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={() => router.push("/(app)/recept/new")}>
                <Text style={styles.emptyButtonText}>+ {t("recipes.addRecipe")}</Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            hasMore && recipes.length > 0 ? (
              <Pressable
                style={[styles.loadMoreButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={loadMore}
                disabled={recipesQuery.isFetching}
                accessibilityLabel={t("recipes.loadMoreA11y")}
                accessibilityRole="button"
                accessibilityState={{ disabled: recipesQuery.isFetching }}
              >
                {recipesQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.loadMoreText, { color: colors.text }]}>{t("recipes.loadMore")}</Text>}
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 16, paddingBottom: 12 },
  headerLeft: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  fabSmall: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchWrap: { marginBottom: 8 },
  searchInput: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  searchTextInput: { flex: 1, fontSize: 15 },
  filters: { marginBottom: 12, flexGrow: 0 },
  filtersContent: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterChipText: { fontSize: 14, fontWeight: "500" },
  grid: { gap: 12 },
  card: { width: CARD_WIDTH, borderRadius: CARD_RADIUS, overflow: "hidden" },
  cardHeader: { height: 110, overflow: "hidden" },
  cardCategoryPill: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardCategory: { fontSize: 10, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.8 },
  heartButton: { position: "absolute", bottom: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  creatorAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  creatorAvatarText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  cardMetaText: { fontSize: 12, flex: 1 },
  cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardTagText: { fontSize: 11, fontWeight: "500" },
  servingsBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  servingsBadgeText: { fontSize: 12, fontWeight: "600" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  loadMoreButton: { alignItems: "center", paddingVertical: 16, marginTop: 8, borderRadius: 12 },
  loadMoreText: { fontSize: 15, fontWeight: "600" },
});
