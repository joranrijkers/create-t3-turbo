import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { trpc } from "~/utils/api";
import { persistActiveHouseholdId } from "~/utils/active-household-storage";

const P = 24;
const R = 16;

export default function CreateHouseholdScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    ...trpc.household.create.mutationOptions(),
    onSuccess: async (data) => {
      await persistActiveHouseholdId(data.id);
      await queryClient.invalidateQueries({ queryKey: trpc.household.myHouseholds.queryOptions().queryKey });
      router.replace("/(app)/(tabs)/home");
    },
    onError: () => setError(t("onboarding.create.errorGeneric")),
  });

  const handleCreate = () => {
    if (!name.trim()) { setError(t("onboarding.create.nameRequired")); return; }
    setError(null);
    createMutation.mutate({ name: name.trim() });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("onboarding.create.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={[styles.content, { paddingHorizontal: P }]}>
          <View style={styles.iconSection}>
            <View style={styles.iconStack}>
              <View style={[styles.houseIconBg, { backgroundColor: "#FFF0E8" }]}>
                <MaterialCommunityIcons name="home" size={40} color={colors.primary} />
              </View>
              <View style={[styles.plusBadge, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t("onboarding.create.formTitle")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("onboarding.create.formSubtitle")}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("onboarding.create.nameLabel")}</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="home-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t("onboarding.create.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {error && <Text style={[styles.errorText, { color: "#C62828" }]}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }, createMutation.isPending && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryButtonText}>{t("onboarding.create.submit")}</Text>
            }
          </Pressable>

          <View style={[styles.infoCard, { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }]}>
            <View style={[styles.infoIconWrap, { backgroundColor: "#DBEAFE" }]}>
              <Text style={[styles.infoIcon, { color: "#1D4ED8" }]}>?</Text>
            </View>
            <View style={styles.infoBody}>
              <Text style={[styles.infoTitle, { color: "#1D4ED8" }]}>{t("onboarding.create.didYouKnow")}</Text>
              <Text style={[styles.infoText, { color: "#1D4ED8" }]}>
                {t("onboarding.create.didYouKnowText")}
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerBack: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 44 },
  content: { flex: 1, paddingTop: 32 },
  iconSection: { alignItems: "center", marginBottom: 28 },
  iconStack: { position: "relative" },
  houseIconBg: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  plusBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, color: "#6B6460", marginBottom: 28 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  inputWrap: {
    height: 52, borderRadius: R, borderWidth: 1,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 16 },
  errorText: { fontSize: 13, marginBottom: 8 },
  primaryButton: { height: 54, borderRadius: R, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  infoCard: { borderRadius: R, borderWidth: 1, padding: 14, flexDirection: "row", gap: 12 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoIcon: { fontSize: 16, fontWeight: "700" },
  infoBody: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
});
