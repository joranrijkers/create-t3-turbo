import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";

const P = 20;

const LICENSES = [
  { name: "React Native", license: "MIT" },
  { name: "Expo", license: "MIT" },
  { name: "React", license: "MIT" },
  { name: "tRPC", license: "MIT" },
  { name: "Better Auth", license: "MIT" },
  { name: "Drizzle ORM", license: "Apache-2.0" },
  { name: "Zod", license: "MIT" },
  { name: "TanStack Query", license: "MIT" },
  { name: "react-native-qrcode-svg", license: "MIT" },
  { name: "react-native-svg", license: "MIT" },
];

export default function InstellingenLicentiesScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.openSourceLicenses")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textMuted }]}>{t("settings.licensesIntro")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {LICENSES.map((lib, idx) => (
            <View
              key={lib.name}
              style={[
                styles.licenseRow,
                idx < LICENSES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.licenseName, { color: colors.text }]}>{lib.name}</Text>
              <Text style={[styles.licenseType, { color: colors.textMuted }]}>{lib.license}</Text>
            </View>
          ))}
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
  intro: { fontSize: 14, marginBottom: 16 },
  card: { borderRadius: 16, overflow: "hidden" },
  licenseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  licenseName: { fontSize: 15, fontWeight: "500" },
  licenseType: { fontSize: 13 },
  bottomSpacer: { height: 24 },
});
