import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { trpc } from "~/utils/api";

const SCREEN_PADDING = 20;
const CARD_RADIUS = 16;

const DIET_OPTIONS = [
  { key: "omnivoor", labelKey: "dietary.omnivore" as const, descKey: "dietary.omnivoreDesc" as const, emoji: "🥩" },
  { key: "vegetarisch", labelKey: "dietary.vegetarian" as const, descKey: "dietary.vegetarianDesc" as const, emoji: "🥗" },
  { key: "vegan", labelKey: "dietary.vegan" as const, descKey: "dietary.veganDesc" as const, emoji: "🌱" },
];

const ALLERGY_OPTIONS: { apiValue: string; labelKey: "dietary.allergyGluten" | "dietary.allergyLactose" | "dietary.allergyNuts" | "dietary.allergyShellfish" | "dietary.allergyEggs" | "dietary.allergySoy" | "dietary.allergyPeanuts" }[] = [
  { apiValue: "Gluten", labelKey: "dietary.allergyGluten" },
  { apiValue: "Lactose", labelKey: "dietary.allergyLactose" },
  { apiValue: "Noten", labelKey: "dietary.allergyNuts" },
  { apiValue: "Schaaldieren", labelKey: "dietary.allergyShellfish" },
  { apiValue: "Ei", labelKey: "dietary.allergyEggs" },
  { apiValue: "Soja", labelKey: "dietary.allergySoy" },
  { apiValue: "Pinda's", labelKey: "dietary.allergyPeanuts" },
];

export default function DietaryScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { householdId } = useCurrentHousehold();
  const queryClient = useQueryClient();

  const [selectedDiet, setSelectedDiet] = useState("omnivoor");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

  const prefsQuery = useQuery({
    ...trpc.userPreferences.get.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });
  const upsertMutation = useMutation({
    ...trpc.userPreferences.upsert.mutationOptions(),
    onSuccess: async (_data, variables) => {
      const prefsQueryKey = trpc.userPreferences.get.queryOptions({
        householdId: variables.householdId,
      }).queryKey;
      await queryClient.invalidateQueries({ queryKey: prefsQueryKey });
      await queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          if (!Array.isArray(key) || !Array.isArray(key[0])) return false;
          const procedure = key[0] as string[];
          return procedure[0] === "userPreferences" && procedure[1] === "getForHousehold";
        },
      });
      router.back();
    },
    onError: (error) => {
      Alert.alert(t("common.error"), error.message || t("common.retry"));
    },
  });

  useEffect(() => {
    if (prefsQuery.data) {
      const diet = prefsQuery.data.dietaryRestrictions?.[0] ?? "omnivoor";
      setSelectedDiet(diet);
      setSelectedAllergies(prefsQuery.data.allergies ?? []);
    }
  }, [prefsQuery.data]);

  const toggleAllergy = (apiValue: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(apiValue) ? prev.filter((a) => a !== apiValue) : [...prev, apiValue]
    );
  };

  const handleSave = () => {
    if (!householdId) return;
    upsertMutation.mutate({
      householdId,
      dietaryRestrictions: [selectedDiet],
      allergies: selectedAllergies,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("dietary.title")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Safety banner */}
        <View style={[styles.safetyBanner, { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color="#1D4ED8" />
          <Text style={[styles.safetyText, { color: "#1D4ED8" }]}>
            {t("dietary.safetyFirst")} · {t("dietary.safetyFirstDesc")}
          </Text>
        </View>

        {/* Diet type */}
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("dietary.dietaryType")}</Text>
          <View style={[styles.requiredBadge, { backgroundColor: "#FFF0E8" }]}>
            <Text style={[styles.requiredText, { color: colors.primary }]}>{t("dietary.required")}</Text>
          </View>
        </View>

        <View style={styles.dietOptions}>
          {DIET_OPTIONS.map((option) => {
            const isSelected = selectedDiet === option.key;
            return (
              <Pressable
                key={option.key}
                style={[
                  styles.dietOption,
                  { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
                  isSelected && { backgroundColor: "#FFF0E8" },
                ]}
                onPress={() => setSelectedDiet(option.key)}
              >
                <Text style={styles.dietEmoji}>{option.emoji}</Text>
                <View style={styles.dietInfo}>
                  <Text style={[styles.dietLabel, { color: isSelected ? colors.primary : colors.text }]}>{t(option.labelKey)}</Text>
                  <Text style={[styles.dietDesc, { color: colors.textMuted }]}>{t(option.descKey)}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: isSelected ? colors.primary : colors.border }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Allergies */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>{t("dietary.allergiesTitle")}</Text>
        <View style={styles.allergiesGrid}>
          {ALLERGY_OPTIONS.map((option) => {
            const isSelected = selectedAllergies.includes(option.apiValue);
            return (
              <Pressable
                key={option.apiValue}
                style={[
                  styles.allergyChip,
                  isSelected
                    ? { backgroundColor: "#FFF0E8", borderColor: colors.primary, borderWidth: 1.5 }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={() => toggleAllergy(option.apiValue)}
              >
                {isSelected && <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />}
                <Text style={[styles.allergyChipText, { color: isSelected ? colors.primary : colors.text }]}>{t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: SCREEN_PADDING, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary }, upsertMutation.isPending && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={upsertMutation.isPending}
        >
          {upsertMutation.isPending
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveButtonText}>{t("dietary.save")}</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  headerBack: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 16 },
  safetyBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: CARD_RADIUS, borderWidth: 1, marginBottom: 24 },
  safetyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  requiredBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  requiredText: { fontSize: 12, fontWeight: "600" },
  dietOptions: { gap: 10 },
  dietOption: {
    flexDirection: "row", alignItems: "center", padding: 16,
    borderRadius: CARD_RADIUS, borderWidth: 1.5, gap: 14,
  },
  dietEmoji: { fontSize: 28 },
  dietInfo: { flex: 1 },
  dietLabel: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  dietDesc: { fontSize: 13 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  allergiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  allergyChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  allergyChipText: { fontSize: 14, fontWeight: "500" },
  bottomSpacer: { height: 16 },
  footer: { paddingVertical: 16, borderTopWidth: 1 },
  saveButton: { height: 54, borderRadius: CARD_RADIUS, alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
