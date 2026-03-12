import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";

import { useAppTheme } from "~/hooks/useAppTheme";

const P = 20;

export default function InstellingenOverScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();

  const version = Constants.expoConfig?.version ?? "1.0.0";
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.aboutPrikkr")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="food-fork-drink" size={40} color="#FFF" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Prikkr</Text>
          <Text style={[styles.version, { color: colors.textMuted }]}>{t("settings.versionLabel", { version })}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => {}}
          >
            <MaterialCommunityIcons name="new-box" size={22} color={colors.text} />
            <Text style={[styles.menuRowTitle, { color: colors.text }]}>{t("settings.whatsNew")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => privacyUrl && Linking.openURL(privacyUrl)}
          >
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.text} />
            <Text style={[styles.menuRowTitle, { color: colors.text }]}>{t("settings.privacyPolicy")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => termsUrl && Linking.openURL(termsUrl)}
          >
            <MaterialCommunityIcons name="scale-balance" size={22} color={colors.text} />
            <Text style={[styles.menuRowTitle, { color: colors.text }]}>{t("settings.termsOfUse")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/(app)/instellingen/licenties")}
          >
            <MaterialCommunityIcons name="license" size={22} color={colors.text} />
            <Text style={[styles.menuRowTitle, { color: colors.text }]}>{t("settings.openSourceLicenses")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>{t("settings.aboutFooter")}</Text>
          <Text style={[styles.footerCopyright, { color: colors.textMuted }]}>{t("settings.aboutCopyright")}</Text>
        </View>

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
  content: { paddingTop: 24, paddingBottom: 32 },
  logoSection: { alignItems: "center", marginBottom: 28 },
  logoIcon: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  appName: { fontSize: 26, fontWeight: "700", marginBottom: 6 },
  version: { fontSize: 15 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuRowTitle: { flex: 1, fontSize: 16, fontWeight: "500" },
  footer: { alignItems: "center" },
  footerText: { fontSize: 14, textAlign: "center", marginBottom: 6 },
  footerCopyright: { fontSize: 14 },
  bottomSpacer: { height: 24 },
});
