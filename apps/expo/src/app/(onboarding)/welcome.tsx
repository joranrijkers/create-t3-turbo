import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";

const P = 24;
const R = 16;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.content, { paddingHorizontal: P }]}>

        <View style={styles.top}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="account" size={40} color="#FFFFFF" />
          </View>
          <Text style={[styles.appTitle, { color: colors.text }]}>{t("onboarding.welcome.appTitle")}</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            {t("onboarding.welcome.tagline")}
          </Text>
        </View>

        <View style={styles.features}>
          <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
            <View style={[styles.featureIcon, { backgroundColor: "#FFF0E8" }]}>
              <MaterialCommunityIcons name="format-list-bulleted" size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{t("onboarding.welcome.feature1Title")}</Text>
              <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{t("onboarding.welcome.feature1Desc")}</Text>
            </View>
          </View>

          <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
            <View style={[styles.featureIcon, { backgroundColor: "#FFF0E8" }]}>
              <MaterialCommunityIcons name="table" size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{t("onboarding.welcome.feature2Title")}</Text>
              <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{t("onboarding.welcome.feature2Desc")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(onboarding)/create")}
          >
            <Text style={styles.primaryButtonText}>+ {t("onboarding.welcome.createHousehold")}</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/(onboarding)/join")}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>→ {t("onboarding.welcome.joinHousehold")}</Text>
          </Pressable>
        </View>

        <View style={styles.termsRow}>
          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            {t("onboarding.welcome.termsIntro")}{" "}
          </Text>
          <Pressable
            onPress={() => {
              const url = process.env.EXPO_PUBLIC_TERMS_URL;
              if (url) Linking.openURL(url);
            }}
            accessibilityLabel={t("onboarding.welcome.accessibilityTerms")}
            accessibilityRole="link"
          >
            <Text style={[styles.termsLink, { color: colors.primary }]}>{t("common.terms")}</Text>
          </Pressable>
          <Text style={[styles.termsText, { color: colors.textMuted }]}>{t("common.and")}</Text>
          <Pressable
            onPress={() => {
              const url = process.env.EXPO_PUBLIC_PRIVACY_URL;
              if (url) Linking.openURL(url);
            }}
            accessibilityLabel={t("onboarding.welcome.accessibilityPrivacy")}
            accessibilityRole="link"
          >
            <Text style={[styles.termsLink, { color: colors.primary }]}>{t("common.privacy")}</Text>
          </Pressable>
          <Text style={[styles.termsText, { color: colors.textMuted }]}>.</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "space-between", paddingTop: 40, paddingBottom: 24 },
  top: { alignItems: "center" },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  appTitle: { fontSize: 34, fontWeight: "700", marginBottom: 12 },
  tagline: { fontSize: 16, textAlign: "center", lineHeight: 22 },
  features: { gap: 12 },
  featureCard: {
    flexDirection: "row", alignItems: "center",
    padding: 16, borderRadius: R, gap: 16,
  },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  featureDesc: { fontSize: 13 },
  actions: { gap: 12 },
  primaryButton: {
    height: 56, borderRadius: R, alignItems: "center", justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    height: 56, borderRadius: R, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 16, fontWeight: "600" },
  termsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center" },
  termsText: { fontSize: 12 },
  termsLink: { fontSize: 12, fontWeight: "600" },
});
