import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

import { useAppTheme } from "~/hooks/useAppTheme";
import {
  getStoredLanguagePreference,
  setStoredLanguagePreference,
  type AppLanguagePreference,
} from "~/utils/language-storage";
import i18n, { resolveLanguagePreference } from "~/i18n";

const SCREEN_PADDING = 20;
const CARD_RADIUS = 16;

const LANGUAGE_OPTIONS = [
  { code: "auto", labelKey: "settings.languageLabelAuto" as const },
  { code: "nl", labelKey: "settings.languageLabelNl" as const },
  { code: "en", labelKey: "settings.languageLabelEn" as const },
] as const;

export default function TaalScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [selectedPreference, setSelectedPreference] =
    useState<AppLanguagePreference>("auto");

  useEffect(() => {
    getStoredLanguagePreference().then((preference) => {
      setSelectedPreference(preference);
    });
  }, []);

  const handleSelect = async (preference: AppLanguagePreference) => {
    setSelectedPreference(preference);
    await setStoredLanguagePreference(preference);
    await i18n.changeLanguage(resolveLanguagePreference(preference));
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.language")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {LANGUAGE_OPTIONS.map((option, index) => {
            const isSelected = selectedPreference === option.code;
            const isLast = index === LANGUAGE_OPTIONS.length - 1;
            return (
              <Pressable
                key={option.code}
                style={[styles.row, { borderBottomColor: colors.border }, isLast && styles.rowLast]}
                onPress={() => void handleSelect(option.code)}
              >
                <Text style={[styles.rowTitle, { color: colors.text }]}>{t(option.labelKey)}</Text>
                {isSelected && (
                  <MaterialCommunityIcons name="check" size={24} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  card: { borderRadius: CARD_RADIUS, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 16 },
});
