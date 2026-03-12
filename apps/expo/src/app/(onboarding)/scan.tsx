import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useAppTheme } from "~/hooks/useAppTheme";
import { trpc } from "~/utils/api";
import { persistActiveHouseholdId } from "~/utils/active-household-storage";

/** Parse invite code from QR payload: prikkr://join?code=XXX or plain 8-char code. */
function parseInviteFromQr(data: string): string | null {
  const trimmed = data.trim();
  const urlMatch = trimmed.match(/prikkr:\/\/join\?code=([A-Za-z0-9]{8})/i);
  if (urlMatch) return urlMatch[1]!.toUpperCase();
  const normalized = trimmed.replace(/-/g, "").toUpperCase();
  if (/^[A-Z0-9]{8}$/.test(normalized)) return normalized;
  return null;
}

export default function ScanJoinScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid") || msg.includes("NOT_FOUND")) {
        setError(t("onboarding.scan.errorInvalidCode"));
      } else if (msg.includes("Already a member") || msg.includes("CONFLICT")) {
        setError(t("onboarding.scan.errorAlreadyMember"));
      } else {
        setError(t("onboarding.scan.errorGeneric"));
      }
      scannedRef.current = false;
    },
  } as UseMutationOptions<
    { id: string; name: string; inviteCode: string; createdAt: Date; updatedAt: Date | null },
    unknown,
    { code: string },
    undefined
  >);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scannedRef.current || joinMutation.isPending) return;
      const code = parseInviteFromQr(data);
      if (!code) {
        setError(t("onboarding.scan.errorInvalidQr"));
        return;
      }
      scannedRef.current = true;
      setError(null);
      joinMutation.mutate({ code });
    },
    [joinMutation, t],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    scannedRef.current = false;
  }, []);

  if (!permission) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.centered, { padding: 24 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textMuted }]}>{t("onboarding.scan.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("onboarding.scan.title")}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.centered, { padding: 24 }]}>
          <MaterialCommunityIcons name="qrcode-scan" size={64} color={colors.textMuted} />
          <Text style={[styles.statusText, { color: colors.text, marginTop: 16 }]}>
            {t("onboarding.scan.permissionReason")}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={() => requestPermission()}
          >
            <Text style={styles.primaryButtonText}>{t("onboarding.scan.grantAccess")}</Text>
          </Pressable>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={[styles.backLinkText, { color: colors.textMuted }]}>{t("onboarding.scan.back")}</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("onboarding.scan.title")}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={joinMutation.isPending ? undefined : handleBarcodeScanned}
        />
        {joinMutation.isPending && (
          <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.overlayText}>{t("onboarding.scan.joining")}</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={[styles.errorBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.surfaceVariant }]} onPress={handleRetry}>
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>{t("onboarding.scan.retry")}</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.hintBar, { backgroundColor: colors.background }]}>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          {t("onboarding.scan.hint")}
        </Text>
      </View>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  statusText: { fontSize: 16, textAlign: "center" },
  primaryButton: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 15 },
  cameraContainer: { flex: 1, minHeight: 280, position: "relative" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  overlayText: { color: "#FFF", fontSize: 16 },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  errorText: { flex: 1, fontSize: 14 },
  retryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  retryButtonText: { fontSize: 14, fontWeight: "600" },
  hintBar: { paddingHorizontal: 20, paddingVertical: 12 },
  hintText: { fontSize: 13, textAlign: "center" },
});
