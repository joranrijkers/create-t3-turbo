import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { authClient } from "~/utils/auth";

const P = 20;

export default function WachtwoordScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email ?? "";

  const handleSendLink = async () => {
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      const result = await (authClient.signIn as { magicLink?: (opts: { email: string }) => Promise<{ error?: unknown }> }).magicLink?.({ email });
      setLoading(false);
      if (result?.error) {
        setError(t("settings.sendLinkError"));
        return;
      }
      setSent(true);
    } catch {
      setLoading(false);
      setError(t("settings.sendLinkError"));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.changePassword")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="email-outline" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t("settings.changePasswordTitle")}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t("settings.changePasswordSubtext", { email })}
        </Text>
        {sent ? (
          <View style={[styles.sentBanner, { backgroundColor: colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.sentText, { color: colors.text }]}>{t("settings.sendLinkSent")}</Text>
          </View>
        ) : (
          <>
            {error && (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            )}
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleSendLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t("settings.sendLoginLink")}</Text>
              )}
            </Pressable>
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  content: { paddingTop: 32, paddingBottom: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  sentBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, marginBottom: 16 },
  sentText: { flex: 1, fontSize: 15, fontWeight: "500" },
  errorText: { fontSize: 14, marginBottom: 12 },
  primaryButton: { paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 24 },
});
