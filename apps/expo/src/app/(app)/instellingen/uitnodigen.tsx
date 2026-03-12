import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";

const P = 20;

/** Payload for QR so scanner can open app or parse code. Scanner accepts this URL or plain 8-char code. */
function getInviteQrPayload(code: string): string {
  const raw = (code ?? "").replace(/-/g, "").toUpperCase().slice(0, 8);
  if (!raw || raw.length !== 8) return code ?? "";
  return `prikkr://join?code=${raw}`;
}

function formatInviteCode(code: string | null | undefined): string {
  if (!code || code.length < 8) return code ?? "";
  return `${code.slice(0, 3)}-${code.slice(3, 8)}`;
}

export default function InstellingenUitnodigenScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();

  const code = household?.inviteCode ?? "";
  const formattedCode = formatInviteCode(code);
  const householdName = household?.name ?? "";

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert(t("common.copied"));
  };

  const handleShare = async () => {
    if (!code) return;
    const message = t("settings.inviteShareMessage", {
      name: householdName || t("settings.household"),
      code: formattedCode,
    });
    try {
      await Share.share({
        message,
        title: t("settings.inviteShareTitle"),
      });
    } catch {
      // User cancelled or share not available
    }
  };

  if (!household && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={styles.headerBack}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.inviteMember")}</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={[styles.centerContent, { padding: P }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
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
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.inviteMember")}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.centerContent, { padding: P }]}>
          <MaterialCommunityIcons name="home-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t("profile.emptyTitle")}</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textMuted }]}>{t("profile.emptySubtitle")}</Text>
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

  if (!household) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.inviteMember")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t("settings.inviteIntro", { name: householdName || t("settings.household") })}
        </Text>

        <View style={[styles.codeBlock, { backgroundColor: colors.card }]}>
          <Text style={[styles.codeText, { color: colors.text }]}>{formattedCode}</Text>
          <Pressable style={[styles.copyButton, { backgroundColor: colors.surfaceVariant }]} onPress={handleCopy}>
            <Text style={[styles.copyButtonText, { color: colors.primary }]}>{t("settings.copyCode")}</Text>
          </Pressable>
        </View>

        {code.length >= 8 && (
          <View style={[styles.qrWrap, { backgroundColor: colors.card }]}>
            <QRCode
              value={getInviteQrPayload(code)}
              size={160}
              color={colors.text}
              backgroundColor={colors.card}
              quietZone={8}
            />
            <Text style={[styles.qrHint, { color: colors.textMuted }]}>{t("settings.inviteQrHint")}</Text>
          </View>
        )}

        <View style={[styles.actionsCard, { backgroundColor: colors.card }]}>
          <Pressable style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant" size={22} color={colors.text} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>{t("settings.inviteShareAction")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={handleCopy}>
            <MaterialCommunityIcons name="content-copy" size={22} color={colors.text} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>{t("settings.copyCodeAction")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.footerHint, { color: colors.textMuted }]}>{t("settings.inviteCodeValidHint")}</Text>

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
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  codeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  codeText: { fontSize: 28, fontWeight: "700", letterSpacing: 2 },
  copyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  copyButtonText: { fontSize: 14, fontWeight: "600" },
  qrWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  qrHint: { fontSize: 12, marginTop: 12, textAlign: "center", paddingHorizontal: 8 },
  actionsCard: { borderRadius: 16, overflow: "hidden", marginBottom: 20 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  actionLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  footerHint: { fontSize: 13, textAlign: "center" },
  bottomSpacer: { height: 24 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  errorSubtitle: { fontSize: 14, textAlign: "center" },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
