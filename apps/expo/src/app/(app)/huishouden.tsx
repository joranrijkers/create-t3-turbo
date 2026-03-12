import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";

const P = 20;
const R = 16;

export default function HuishoudenScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { householdId, households, setActiveHouseholdId, isLoading } = useCurrentHousehold();

  const handleSelectHousehold = (id: string) => {
    setActiveHouseholdId(id);
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("profile.household")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        {households.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t("profile.households")}</Text>
            {households.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => handleSelectHousehold(h.id)}
                style={[styles.householdRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons
                  name="home-outline"
                  size={22}
                  color={h.id === householdId ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.householdRowName, { color: colors.text }]} numberOfLines={1}>
                  {h.name}
                </Text>
                {h.id === householdId ? (
                  <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
                    <Text style={styles.activePillText}>{t("profile.active")}</Text>
                  </View>
                ) : (
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t("profile.addHousehold")}</Text>
          <Pressable
            onPress={() => router.push("/(onboarding)/create")}
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>{t("profile.newHousehold")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(onboarding)/join")}
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="key-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>{t("profile.joinWithCode")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
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
  content: { paddingTop: 24, paddingBottom: 32 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  householdRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: R,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  householdRowName: { flex: 1, fontSize: 16, fontWeight: "600" },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  chevron: { fontSize: 20, fontWeight: "300" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: R,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  actionButtonText: { flex: 1, fontSize: 16, fontWeight: "600" },
});
