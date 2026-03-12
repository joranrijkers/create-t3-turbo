import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { clearActiveHouseholdId, persistActiveHouseholdId } from "~/utils/active-household-storage";
import { trpc } from "~/utils/api";

const P = 20;
const AVATAR_SIZE = 52;

function getCreatedMonthYear(dateStr: string | Date | null | undefined, locale: string): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function formatInviteCode(code: string | null | undefined): string {
  if (!code || code.length < 8) return code ?? "";
  return `${code.slice(0, 3)}-${code.slice(3, 8)}`;
}

export default function InstellingenHuishoudenScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { householdId, household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();

  const membersQuery = useQuery({
    ...trpc.household.members.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });
  const members = membersQuery.data ?? [];
  const memberCount = members.length;
  const adminCount = members.filter((m) => m.role === "admin").length;
  const myMember = members.find((m) => m.userId === session?.user?.id);
  const isAdmin = myMember?.role === "admin";
  const isLastAdmin = isAdmin && adminCount <= 1 && memberCount > 1;
  const otherMembers = members.filter((m) => m.userId !== session?.user?.id);

  const [name, setName] = useState(household?.name ?? "");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNextAdminId, setSelectedNextAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (household?.name) setName(household.name);
  }, [household?.name]);

  const updateMutation = useMutation({
    ...trpc.household.update.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [["household", "myHouseholds"]] });
      void queryClient.invalidateQueries({ queryKey: [["household", "members"]] });
      router.back();
    },
  });

  const handleHouseholdMembershipChanged = async (removedHouseholdId: string) => {
    const myHouseholdsQuery = trpc.household.myHouseholds.queryOptions();
    await queryClient.invalidateQueries({ queryKey: myHouseholdsQuery.queryKey });
    const households = await queryClient.fetchQuery({ ...myHouseholdsQuery, staleTime: 0 });
    const nextHousehold =
      households.find((candidate) => candidate.id !== removedHouseholdId) ?? households[0];

    if (nextHousehold) {
      await persistActiveHouseholdId(nextHousehold.id);
      router.replace("/(app)/(tabs)/home");
      return;
    }

    await clearActiveHouseholdId();
    router.replace("/(onboarding)/welcome");
  };

  const leaveMutation = useMutation({
    ...trpc.household.leaveHousehold.mutationOptions(),
    onSuccess: async () => {
      if (!householdId) return;
      setShowTransferModal(false);
      setSelectedNextAdminId(null);
      await handleHouseholdMembershipChanged(householdId);
    },
    onError: (err) => {
      if (err.data?.code === "BAD_REQUEST") {
        Alert.alert(t("profile.leaveTransferAdminTitle"), t("profile.leaveTransferAdminError"));
      }
    },
  });

  const deleteMutation = useMutation({
    ...trpc.household.delete.mutationOptions(),
    onSuccess: async () => {
      if (!householdId) return;
      await handleHouseholdMembershipChanged(householdId);
    },
  });

  const handleSave = () => {
    const trimmed = name.trim();
    if (!householdId || !trimmed || trimmed === household?.name) return;
    updateMutation.mutate({ householdId, name: trimmed });
  };

  const handleCopyCode = async () => {
    const code = household?.inviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert(t("common.copied"));
  };

  const handleLeave = () => {
    if (memberCount === 1) {
      Alert.alert(
        t("profile.leaveLastMemberTitle"),
        t("profile.leaveLastMemberMessage", { name: household?.name ?? "" }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.leaveLastMemberButton"),
            style: "destructive",
            onPress: () => householdId && leaveMutation.mutate({ householdId }),
          },
        ],
      );
      return;
    }
    if (isLastAdmin) {
      setSelectedNextAdminId(null);
      setShowTransferModal(true);
      return;
    }
    Alert.alert(
      t("profile.leaveConfirmTitle"),
      t("profile.leaveConfirmSubtitle", { name: household?.name ?? "" }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.leaveConfirmButton"),
          style: "destructive",
          onPress: () => householdId && leaveMutation.mutate({ householdId }),
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t("settings.deleteHouseholdConfirmTitle"),
      t("settings.deleteHouseholdConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => householdId && deleteMutation.mutate({ householdId }),
        },
      ],
    );
  };

  const nameChanged = name.trim() !== (household?.name ?? "");
  const initial = (household?.name ?? "?").trim().charAt(0).toUpperCase();

  if (!householdId && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={styles.headerBack}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.household")}</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.household")}</Text>
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

  if (!householdId) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.household")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={[styles.headerAvatar, { backgroundColor: "#FF7936" }]}>
            <Text style={styles.headerAvatarText}>{initial}</Text>
          </View>
          <View style={styles.headerCardText}>
            <Text style={[styles.headerCardName, { color: colors.text }]}>{household?.name ?? "—"}</Text>
            <Text style={[styles.headerCardSub, { color: colors.textMuted }]}>
              {t("settings.createdLabel", {
                date: getCreatedMonthYear(household?.createdAt, i18n.language === "nl" ? "nl-NL" : "en-GB"),
                count: memberCount,
              })}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.householdNameLabel")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder={t("settings.householdNamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            editable={isAdmin}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("householdDetail.inviteCodeLabel")}</Text>
        <View style={[styles.card, styles.codeRow, { backgroundColor: colors.card }]}>
          <Text style={[styles.codeText, { color: colors.text }]}>{formatInviteCode(household?.inviteCode) || "—"}</Text>
          <Pressable style={[styles.copyButton, { backgroundColor: colors.surfaceVariant }]} onPress={handleCopyCode}>
            <Text style={[styles.copyButtonText, { color: colors.primary }]}>{t("settings.copyCode")}</Text>
          </Pressable>
        </View>

        {isAdmin && nameChanged && (
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t("profileEdit.save")}</Text>
            )}
          </Pressable>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionDangerZone")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={handleLeave}>
            <MaterialCommunityIcons name="exit-to-app" size={22} color={colors.danger} />
            <Text style={[styles.menuRowTitle, { color: colors.danger }]}>{t("profile.leaveHousehold")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
          {isAdmin && (
            <Pressable style={styles.menuRow} onPress={handleDelete}>
              <MaterialCommunityIcons name="delete-outline" size={22} color={colors.danger} />
              <Text style={[styles.menuRowTitle, { color: colors.danger }]}>{t("settings.deleteHousehold")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={showTransferModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setShowTransferModal(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("profile.selectNewAdminTitle")}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{t("profile.selectNewAdminSubtitle")}</Text>
            <ScrollView style={styles.modalMemberList} keyboardShouldPersistTaps="handled">
              {otherMembers.map((member) => {
                const isSelected = selectedNextAdminId === member.userId;
                const initial = (member.name ?? "?").trim().charAt(0).toUpperCase();
                return (
                  <Pressable
                    key={member.userId}
                    style={[
                      styles.modalMemberRow,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.surfaceVariant },
                    ]}
                    onPress={() => setSelectedNextAdminId(member.userId)}
                  >
                    <View style={[styles.modalAvatar, { backgroundColor: "#FF7936" }]}>
                      <Text style={styles.modalAvatarText}>{initial}</Text>
                    </View>
                    <Text style={[styles.modalMemberName, { color: colors.text }]} numberOfLines={1}>
                      {member.name ?? "—"}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowTransferModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                  !selectedNextAdminId && styles.modalButtonDisabled,
                ]}
                onPress={() => {
                  if (householdId && selectedNextAdminId) {
                    leaveMutation.mutate({ householdId, nextAdminUserId: selectedNextAdminId });
                  }
                }}
                disabled={!selectedNextAdminId || leaveMutation.isPending}
              >
                {leaveMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>{t("profile.selectNewAdminConfirm")}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 14,
  },
  headerAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  headerCardText: { flex: 1, minWidth: 0 },
  headerCardName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  headerCardSub: { fontSize: 14 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    margin: 16,
  },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 12 },
  codeText: { fontSize: 18, fontWeight: "600", flex: 1 },
  copyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  copyButtonText: { fontSize: 14, fontWeight: "600" },
  saveButton: { paddingVertical: 14, borderRadius: 16, alignItems: "center", marginBottom: 24 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  menuRowTitle: { flex: 1, fontSize: 16, fontWeight: "500" },
  bottomSpacer: { height: 24 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, marginBottom: 16 },
  modalMemberList: { maxHeight: 240, marginBottom: 16 },
  modalMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  modalMemberName: { flex: 1, fontSize: 16, fontWeight: "500" },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minWidth: 100, alignItems: "center" },
  modalButtonText: { fontSize: 16, fontWeight: "600" },
  modalButtonDisabled: { opacity: 0.5 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  errorSubtitle: { fontSize: 14, textAlign: "center" },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
