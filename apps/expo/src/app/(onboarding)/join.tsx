import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "~/hooks/useAppTheme";
import { trpc } from "~/utils/api";
import { persistActiveHouseholdId } from "~/utils/active-household-storage";

const P = 24;
const R = 16;

export default function JoinHouseholdScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const joinMutation = useMutation({
    ...trpc.household.joinByCode.mutationOptions(),
    throwOnError: false,
    onSuccess: async (data) => {
      const myHouseholdsQuery = trpc.household.myHouseholds.queryOptions();
      await queryClient.invalidateQueries({ queryKey: myHouseholdsQuery.queryKey });
      await queryClient.fetchQuery({ ...myHouseholdsQuery, staleTime: 0 });
      await persistActiveHouseholdId(data.id);
      router.replace("/(app)/(tabs)/home");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid") || msg.includes("NOT_FOUND")) {
        setError(t("onboarding.join.errorInvalidCode"));
      } else if (msg.includes("Already a member") || msg.includes("CONFLICT")) {
        setError(t("onboarding.scan.errorAlreadyMember"));
      } else {
        setError(t("onboarding.join.errorGeneric"));
      }
    },
  } as UseMutationOptions<
    { id: string; name: string; inviteCode: string; createdAt: Date; updatedAt: Date | null },
    unknown,
    { code: string },
    undefined
  >);

  const handleJoin = () => {
    const normalized = code.replace(/-/g, "").toUpperCase().trim().slice(0, 8);
    if (normalized.length < 8) {
      setError(t("onboarding.join.errorCodeLength"));
      return;
    }
    setError(null);
    joinMutation.mutate({ code: normalized });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("onboarding.join.pageTitle")}</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={[styles.content, { paddingHorizontal: P }]}>
          <View style={styles.iconSection}>
            <View style={styles.iconStack}>
              <View style={[styles.houseIconBg, { backgroundColor: "#FFF0E8" }]}>
                <MaterialCommunityIcons name="home" size={40} color={colors.primary} />
              </View>
              <View style={[styles.keyBadge, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="key" size={12} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t("onboarding.join.formTitle")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t("onboarding.join.formSubtitle")}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("onboarding.join.codeLabel")}</Text>
          <TextInput
            style={[styles.codeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder={t("onboarding.join.codePlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            textAlign="center"
          />

          {error && <Text style={[styles.errorText, { color: "#C62828" }]}>{error}</Text>}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }, joinMutation.isPending && { opacity: 0.7 }]}
            onPress={handleJoin}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryButtonText}>{t("onboarding.join.submit")}</Text>
            }
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t("onboarding.join.dividerOrScan")}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Pressable
            style={[styles.qrButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(onboarding)/scan")}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.text} />
            <Text style={[styles.qrButtonText, { color: colors.text }]}>{t("onboarding.join.scanButton")}</Text>
          </Pressable>

          <View style={[styles.infoCard, { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }]}>
            <View style={[styles.infoIconWrap, { backgroundColor: "#DBEAFE" }]}>
              <Text style={[styles.infoIcon, { color: "#1D4ED8" }]}>?</Text>
            </View>
            <View style={styles.infoBody}>
              <Text style={[styles.infoTitle, { color: "#1D4ED8" }]}>{t("onboarding.join.helpTitle")}</Text>
              <Text style={[styles.infoText, { color: "#1D4ED8" }]}>
                {t("onboarding.join.helpText")}
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  headerBack: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerRight: { width: 44 },
  content: { flex: 1, paddingTop: 32 },
  iconSection: { alignItems: "center", marginBottom: 28 },
  iconStack: { position: "relative" },
  houseIconBg: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  keyBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  codeInput: {
    height: 64, borderRadius: 16, borderWidth: 1,
    fontSize: 24, fontWeight: "700", letterSpacing: 6,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, marginBottom: 8 },
  primaryButton: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  qrButton: { height: 52, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  qrButtonText: { fontSize: 15, fontWeight: "600" },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: "row", gap: 12 },
  infoIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoIcon: { fontSize: 16, fontWeight: "700" },
  infoBody: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
});
