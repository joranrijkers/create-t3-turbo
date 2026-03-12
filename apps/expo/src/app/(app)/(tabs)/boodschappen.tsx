import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, TextInput, Alert, KeyboardAvoidingView, Platform,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { useShoppingListRealtime } from "~/hooks/useShoppingListRealtime";
import { trpc } from "~/utils/api";
import { toCanonicalUnit } from "~/utils/canonical-units";
import { formatAmount } from "~/utils/formatAmount";

const SCREEN_PADDING = 20;

const CATEGORY_SLUGS = [
  "dairy_eggs", "produce", "meat_seafood", "bakery", "grains_cereals",
  "herbs_spices", "oils_fats", "canned_preserved", "frozen", "beverages",
  "snacks", "condiments_sauces", "baking", "nuts_seeds", "legumes",
  "sweeteners", "household", "other",
] as const;

type FilterTab = "all" | "aisle" | "recipe";

export default function BoodschappenScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { householdId, household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineItemText, setInlineItemText] = useState("");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const inlineInputRef = useRef<TextInput>(null);
  const optimisticPrevRef = useRef<unknown>(null);

  const listQueryKey = trpc.shoppingList.current.queryOptions({
    householdId: householdId!,
    locale: i18n.language,
  }).queryKey;

  const listQuery = useQuery({
    ...trpc.shoppingList.current.queryOptions({
      householdId: householdId!,
      locale: i18n.language,
    }),
    enabled: !!householdId,
  });

  const showMutationErrorAndRetry = useCallback(
    (retry: () => void) => {
      Alert.alert(
        t("common.error"),
        t("groceries.mutationError"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.retry"), onPress: retry },
        ]
      );
    },
    [t]
  );

  const checkMutation = useMutation({
    ...trpc.shoppingList.checkItem.mutationOptions(),
    onMutate: async (variables) => {
      if (!householdId) return undefined;
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const prev = queryClient.getQueryData(listQueryKey);
      optimisticPrevRef.current = prev;
      queryClient.setQueryData(listQueryKey, (old: unknown) => {
        const data = old as typeof listQuery.data;
        if (!data?.items) return data;
        const items = data.items.map((i) =>
          i.id === variables.itemId ? { ...i, isChecked: true } : i
        );
        const checkedCount = items.filter((i) => i.isChecked).length;
        return { ...data, items, checkedCount } as typeof listQuery.data;
      });
      return undefined;
    },
    onError: (_, variables) => {
      if (optimisticPrevRef.current != null) {
        queryClient.setQueryData(listQueryKey, optimisticPrevRef.current as typeof listQuery.data);
        optimisticPrevRef.current = null;
      }
      showMutationErrorAndRetry(() => checkMutation.mutate({ itemId: variables.itemId }));
    },
  });
  const uncheckMutation = useMutation({
    ...trpc.shoppingList.uncheckItem.mutationOptions(),
    onMutate: async (variables) => {
      if (!householdId) return undefined;
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const prev = queryClient.getQueryData(listQueryKey);
      optimisticPrevRef.current = prev;
      queryClient.setQueryData(listQueryKey, (old: unknown) => {
        const data = old as typeof listQuery.data;
        if (!data?.items) return data;
        const items = data.items.map((i) =>
          i.id === variables.itemId ? { ...i, isChecked: false } : i
        );
        const checkedCount = items.filter((i) => i.isChecked).length;
        return { ...data, items, checkedCount } as typeof listQuery.data;
      });
      return undefined;
    },
    onError: (_, variables) => {
      if (optimisticPrevRef.current != null) {
        queryClient.setQueryData(listQueryKey, optimisticPrevRef.current as typeof listQuery.data);
        optimisticPrevRef.current = null;
      }
      showMutationErrorAndRetry(() => uncheckMutation.mutate({ itemId: variables.itemId }));
    },
  });
  const generateMutation = useMutation({
    ...trpc.shoppingList.generate.mutationOptions(),
    onSuccess: () => { void listQuery.refetch(); },
  });
  const clearCheckedMutation = useMutation({
    ...trpc.shoppingList.clearChecked.mutationOptions(),
    onSuccess: () => { void listQuery.refetch(); },
    onError: () => {
      showMutationErrorAndRetry(() => householdId && clearCheckedMutation.mutate({ householdId }));
    },
  });
  const addManualMutation = useMutation({
    ...trpc.shoppingList.addManual.mutationOptions(),
    onSuccess: () => {
      void listQuery.refetch();
      setInlineItemText("");
    },
    onError: (_, variables) => {
      showMutationErrorAndRetry(() => {
        if (householdId && variables.name) addManualMutation.mutate({ householdId, name: variables.name });
      });
    },
  });

  const refresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await listQuery.refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [listQuery]);

  useShoppingListRealtime(
    householdId ?? undefined,
    listQuery.data?.listId ?? null,
    listQueryKey
  );

  const listData = listQuery.data;
  const items = listData?.items ?? [];
  const checkedCount = listData?.checkedCount ?? 0;
  const totalCount = listData?.totalCount ?? 0;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const itemsByCategory = useMemo(() => {
    if (filter === "recipe") {
      const byRecipe = new Map<string, typeof items>();
      for (const item of items) {
        const key = item.recipeTitle ?? "Handmatig";
        const arr = byRecipe.get(key) ?? [];
        arr.push(item);
        byRecipe.set(key, arr);
      }
      return byRecipe;
    }
    const byCategory = new Map<string, typeof items>();
    for (const item of items) {
      const cat = (item.category ?? "other") as (typeof CATEGORY_SLUGS)[number];
      const key = CATEGORY_SLUGS.includes(cat) ? cat : "other";
      const arr = byCategory.get(key) ?? [];
      arr.push(item);
      byCategory.set(key, arr);
    }
    return byCategory;
  }, [items, filter]);

  const sections = useMemo(
    () =>
      [...itemsByCategory.entries()].map(([category, data]) => ({
        category,
        data,
      })),
    [itemsByCategory]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { category: string; data: typeof items } }) => (
      <View style={styles.categorySection}>
        <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>
          {filter === "recipe"
            ? (section.category === "Handmatig" ? t("groceries.manualGroup") : section.category)
            : (t(`categories.${section.category}`) || section.category)}{" "}
          · {t("groceries.itemsCount", { count: section.data.length })}
        </Text>
      </View>
    ),
    [colors.textMuted, filter, t]
  );

  const renderItem = useCallback(
    ({ item, index, section }: { item: (typeof items)[number]; index: number; section: { data: typeof items } }) => {
      const isLast = index === section.data.length - 1;
      const isFirst = index === 0;
      return (
        <View
          style={[
            styles.categoryCard,
            { backgroundColor: colors.card },
            isFirst && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
            isLast && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginBottom: 20 },
            { overflow: "hidden" },
          ]}
        >
          <Pressable
            style={[
              styles.itemRow,
              !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => {
              if (item.isChecked) {
                uncheckMutation.mutate({ itemId: item.id });
              } else {
                checkMutation.mutate({ itemId: item.id });
              }
            }}
            accessibilityLabel={`${item.name}. ${item.isChecked ? t("groceries.itemChecked") : t("groceries.itemUnchecked")}. ${t("groceries.doubleTapToEdit")}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isChecked }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: item.isChecked ? colors.primary : colors.border,
                  backgroundColor: item.isChecked ? colors.primary : "transparent",
                },
              ]}
            >
              {item.isChecked && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text
              style={[
                styles.itemName,
                { color: item.isChecked ? colors.textMuted : colors.text },
                item.isChecked && styles.itemNameChecked,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.itemRight}>
              {item.amount ? (
                <Text style={[styles.itemAmount, { color: colors.textMuted }]}>
                  {formatAmount(item.amount)}
                  {item.unit
                    ? ` ${t(`units.${toCanonicalUnit(item.unit)}`, {
                        count: Number(item.amount) || 1,
                        defaultValue: item.unit,
                      })}`
                    : ""}
                </Text>
              ) : null}
              {item.recipeTitle ? (
                <View style={[styles.recipeBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.recipeBadgeText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.recipeTitle}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      );
    },
    [
      colors.card,
      colors.border,
      colors.primary,
      colors.text,
      colors.textMuted,
      colors.surfaceVariant,
      checkMutation,
      uncheckMutation,
      t,
    ]
  );

  const isLoading = householdLoading || (!!householdId && listQuery.isPending && !listQuery.data);

  if (!householdId && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.center, { padding: SCREEN_PADDING }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={56} color={colors.danger} />
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
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.center, { padding: SCREEN_PADDING }]}>
          <MaterialCommunityIcons name="cart-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("profile.emptyTitle")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t("profile.emptySubtitle")}</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(onboarding)/welcome")}
          >
            <Text style={styles.retryButtonText}>{t("profile.goToOnboarding")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { paddingHorizontal: SCREEN_PADDING }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>{t("groceries.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {household ? t("groceries.weekSubtitle", { week: getWeekNumber(), count: totalCount }) : ""}
          </Text>
        </View>
        <Pressable
          style={[styles.fabSmall, { backgroundColor: colors.primary }]}
          onPress={() => setShowInlineAdd(true)}
          accessibilityLabel={t("groceries.addItem")}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {totalCount > 0 && (
        <View style={[styles.progressWrap, { paddingHorizontal: SCREEN_PADDING }]}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: colors.text }]}>
              {t("groceries.progressCount", { checked: checkedCount, total: totalCount })}
            </Text>
            <Text style={[styles.progressPct, { color: colors.primary }]}>{progressPct}%</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPct}%` as any }]} />
          </View>
          {checkedCount > 0 && (
            <Pressable
              style={styles.clearCheckedRow}
              accessibilityLabel={t("groceries.clearChecked")}
              accessibilityRole="button"
              accessibilityHint={t("groceries.clearCheckedHint")}
              onPress={() => {
                Alert.alert(
                  t("groceries.clearCheckedConfirmTitle"),
                  t("groceries.clearCheckedConfirmMessage", { count: checkedCount }),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("groceries.clearCheckedButton"),
                      style: "destructive",
                      onPress: () => householdId && clearCheckedMutation.mutate({ householdId }),
                    },
                  ]
                );
              }}
              disabled={clearCheckedMutation.isPending}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.clearCheckedText, { color: colors.textMuted }]}>
                {t("groceries.clearCheckedLabel", { count: checkedCount })}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={[styles.filterTabs, { paddingHorizontal: SCREEN_PADDING }]}>
        {([["all", t("groceries.filters.allItems")], ["aisle", t("groceries.filters.byAisle")], ["recipe", t("groceries.filters.byRecipe")]] as [FilterTab, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[
              styles.filterTab,
              filter === key
                ? { backgroundColor: colors.secondary }
                : { backgroundColor: colors.surfaceVariant },
            ]}
            onPress={() => setFilter(key)}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === key }}
          >
            <Text style={[styles.filterTabText, { color: filter === key ? colors.secondaryForeground : colors.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listQuery.isError ? (
        <View style={[styles.errorWrap, { paddingHorizontal: SCREEN_PADDING }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("groceries.errorLoad")}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => listQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <KeyboardAvoidingView
          style={styles.scroll}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.emptyContentWrap, { paddingHorizontal: SCREEN_PADDING }]}
            refreshControl={<RefreshControl refreshing={isPullRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
            keyboardShouldPersistTaps="handled"
          >
            <View style={showInlineAdd ? styles.emptyMessageCompact : styles.emptyMessage}>
              <MaterialCommunityIcons name="cart-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("groceries.emptyTitle")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {t("groceries.emptySubtitleGenerate")}
              </Text>
              <Pressable
                style={[
                  styles.generateButton,
                  { backgroundColor: colors.primary },
                  (generateMutation.isPending || !householdId) && { opacity: 0.7 },
                ]}
                onPress={() => householdId && generateMutation.mutate({ householdId })}
                disabled={generateMutation.isPending || !householdId}
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="calendar-sync" size={20} color="#FFFFFF" />
                    <Text style={styles.generateButtonText}>
                      {t("groceries.generateFromWeekPlan")}
                    </Text>
                  </>
                )}
              </Pressable>
              {generateMutation.isError && (
                <Text style={[styles.emptySubtitle, { color: colors.danger }]}>{t("groceries.errorGenerate")}</Text>
              )}
              <Text style={[styles.emptySubtitle, { color: colors.textMuted, marginTop: 8 }]}>
                {t("groceries.emptySubtitleOrAdd")}
              </Text>
            </View>
            {showInlineAdd && (
              <View style={[styles.inlineAddCard, { backgroundColor: colors.card }]}>
                <View style={styles.inlineAddRow}>
                  <TextInput
                    ref={inlineInputRef}
                    style={[styles.inlineAddInput, { color: colors.text }]}
                    placeholder={t("groceries.inlinePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    value={inlineItemText}
                    onChangeText={setInlineItemText}
                    onSubmitEditing={() => {
                      if (!inlineItemText.trim() || !householdId) return;
                      addManualMutation.mutate({ householdId, name: inlineItemText.trim() });
                    }}
                    returnKeyType="done"
                    autoFocus
                    editable={!addManualMutation.isPending}
                  />
                  <Pressable
                    style={styles.inlineCloseIcon}
                    onPress={() => setShowInlineAdd(false)}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    style={[styles.inlineSubmitIcon, { backgroundColor: colors.primary }, (addManualMutation.isPending || !inlineItemText.trim()) && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!inlineItemText.trim() || !householdId) return;
                      addManualMutation.mutate({ householdId, name: inlineItemText.trim() });
                    }}
                    disabled={addManualMutation.isPending || !inlineItemText.trim()}
                    accessibilityLabel={t("groceries.addItem")}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: addManualMutation.isPending || !inlineItemText.trim() }}
                  >
                    {addManualMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialCommunityIcons name="arrow-up" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          style={styles.scroll}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
            stickySectionHeadersEnabled={false}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={6}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={isPullRefreshing} onRefresh={refresh} tintColor={colors.primary} />
            }
            ListFooterComponent={
              <>
                {showInlineAdd && (
                  <View style={[styles.inlineAddCard, { backgroundColor: colors.card }]}>
                    <View style={styles.inlineAddRow}>
                      <TextInput
                        ref={inlineInputRef}
                        style={[styles.inlineAddInput, { color: colors.text }]}
                        placeholder={t("groceries.inlinePlaceholder")}
                        placeholderTextColor={colors.textMuted}
                        value={inlineItemText}
                        onChangeText={setInlineItemText}
                        onSubmitEditing={() => {
                          if (!inlineItemText.trim() || !householdId) return;
                          addManualMutation.mutate({ householdId, name: inlineItemText.trim() });
                        }}
                        returnKeyType="done"
                        autoFocus
                        editable={!addManualMutation.isPending}
                      />
                      <Pressable
                        style={styles.inlineCloseIcon}
                        onPress={() => setShowInlineAdd(false)}
                        hitSlop={8}
                        accessibilityLabel="Sluiten"
                        accessibilityRole="button"
                      >
                        <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                      </Pressable>
                      <Pressable
                        style={[
                          styles.inlineSubmitIcon,
                          { backgroundColor: colors.primary },
                          (addManualMutation.isPending || !inlineItemText.trim()) && { opacity: 0.5 },
                        ]}
                        onPress={() => {
                          if (!inlineItemText.trim() || !householdId) return;
                          addManualMutation.mutate({ householdId, name: inlineItemText.trim() });
                        }}
                        disabled={addManualMutation.isPending || !inlineItemText.trim()}
                        accessibilityLabel={t("groceries.addItem")}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: addManualMutation.isPending || !inlineItemText.trim() }}
                      >
                        {addManualMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <MaterialCommunityIcons name="arrow-up" size={18} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
                <View style={styles.bottomSpacer} />
              </>
            }
          />
        </KeyboardAvoidingView>
      )}

      {/* inline add card zit in de ScrollView hierboven */}
    </SafeAreaView>
  );
}

function getWeekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 16, paddingBottom: 12 },
  headerLeft: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  fabSmall: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 4 },
  progressWrap: { marginBottom: 14 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: "500" },
  progressPct: { fontSize: 14, fontWeight: "700" },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  filterTabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: "center" },
  filterTabText: { fontSize: 13, fontWeight: "600" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 32 },
  categorySection: { marginBottom: 20 },
  categoryLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" },
  categoryCard: { borderRadius: 16, overflow: "hidden" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemName: { flex: 1, fontSize: 15 },
  itemNameChecked: { textDecorationLine: "line-through" },
  itemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemAmount: { fontSize: 13 },
  recipeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: 80 },
  recipeBadgeText: { fontSize: 11, fontWeight: "500" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyContentWrap: { flexGrow: 1, paddingTop: 40, paddingBottom: 32 },
  emptyMessage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyMessageCompact: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  generateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  generateButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 24 },
  clearCheckedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  clearCheckedText: { fontSize: 13 },
  addItemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 8, marginBottom: 8 },
  addItemText: { fontSize: 15, fontWeight: "600" },
  inlineAddCard: { borderRadius: 16, overflow: "hidden", marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16 },
  inlineAddRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inlineAddInput: { flex: 1, fontSize: 15, paddingVertical: 8, paddingHorizontal: 0 },
  inlineCloseIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  inlineSubmitIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
