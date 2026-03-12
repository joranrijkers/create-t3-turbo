import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { authClient } from "~/utils/auth";
import { clearActiveHouseholdId, persistActiveHouseholdId } from "~/utils/active-household-storage";
import { trpc } from "~/utils/api";

const P = 20;
const AVATAR_COLORS = ["#FF7936", "#4CAF50", "#9C27B0", "#2196F3", "#FF5722", "#00BCD4"];
function getAvatarColor(i: number) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length] ?? "#FF7936";
}

export default function LedenScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { householdId, household, isLoading: householdLoading, error: householdError } = useCurrentHousehold();
  const currentUserId = session?.user?.id ?? null;

  const membersQuery = useQuery({
    ...trpc.household.members.queryOptions({ householdId: householdId! }),
    enabled: !!householdId,
  });
  const members = membersQuery.data ?? [];
  const myMember = members.find((m) => m.userId === currentUserId);
  const isAdmin = myMember?.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;
  const isLastAdmin = isAdmin && adminCount <= 1 && members.length > 1;
  const otherMembers = members.filter((m) => m.userId !== currentUserId);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNextAdminId, setSelectedNextAdminId] = useState<string | null>(null);

  const updateRoleMutation = useMutation({
    ...trpc.household.updateMemberRole.mutationOptions(),
    onSuccess: () => {
      void membersQuery.refetch();
    },
  });

  const removeMemberMutation = useMutation({
    ...trpc.household.removeMember.mutationOptions(),
    onSuccess: () => {
      void membersQuery.refetch();
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

  const refresh = useCallback(() => {
    void membersQuery.refetch();
  }, [membersQuery]);

  const showMemberMenu = useCallback(
    (member: { userId: string; name: string | null; role: string }) => {
      if (member.userId === currentUserId) return;
      if (!isAdmin || !householdId) return;
      Alert.alert(
        member.name ?? t("common.member"),
        undefined,
        [
          { text: t("common.cancel"), style: "cancel" },
          ...(member.role !== "admin"
            ? [
                {
                  text: t("settings.makeAdmin"),
                  onPress: () =>
                    updateRoleMutation.mutate({
                      householdId,
                      userId: member.userId,
                      role: "admin",
                    }),
                },
              ]
            : [
                {
                  text: t("settings.makeMember"),
                  onPress: () =>
                    updateRoleMutation.mutate({
                      householdId,
                      userId: member.userId,
                      role: "member",
                    }),
                },
              ]),
          {
            text: t("settings.removeFromHousehold"),
            style: "destructive",
            onPress: () =>
              Alert.alert(
                t("settings.removeMemberConfirmTitle"),
                t("settings.removeMemberConfirmMessage", { name: member.name ?? "" }),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () =>
                      removeMemberMutation.mutate({ householdId, userId: member.userId }),
                  },
                ],
              ),
          },
        ],
      );
    },
    [currentUserId, isAdmin, householdId, t, updateRoleMutation, removeMemberMutation],
  );

  const handleLeave = useCallback(() => {
    if (members.length === 1) {
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
  }, [t, household?.name, householdId, leaveMutation, members.length, isLastAdmin]);

  if (!householdId && !householdLoading) {
    if (householdError) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={styles.headerBack}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.manageMembers")}</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.manageMembers")}</Text>
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

  if (membersQuery.isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.manageMembers")}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.centerContent, { padding: P }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t("common.errorLoad")}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => membersQuery.refetch()}>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("settings.manageMembers")}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={membersQuery.isFetching} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t("profile.members")}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            {members.length} {t("settings.ofMaxPlaces")}
          </Text>
        </View>

        {membersQuery.isLoading && !members.length ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <View style={[styles.membersCard, { backgroundColor: colors.card }]}>
            {members.map((member, idx) => {
              const isAdminRole = member.role === "admin";
              const isCurrentUser = member.userId === currentUserId;
              const initial = (member.name ?? "?").trim().charAt(0).toUpperCase();
              const imageUrl = member.image ?? undefined;
              const avatarContent = imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.memberAvatarImage} />
              ) : (
                <Text style={styles.memberAvatarText}>{initial}</Text>
              );
              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberRow,
                    idx < members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(idx) }]}>{avatarContent}</View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                      {member.name ?? "Onbekend"}
                      {isCurrentUser ? ` (${t("common.you")})` : ""}
                    </Text>
                    <Text style={[styles.memberEmail, { color: colors.textMuted }]} numberOfLines={1}>
                      {member.email ?? "—"}
                    </Text>
                    <Text style={[styles.memberRole, { color: colors.textMuted }]}>
                      {isAdminRole ? t("common.admin") : t("common.member")}
                    </Text>
                  </View>
                  {isAdminRole && (
                    <View style={[styles.adminBadge, { backgroundColor: "#FFF0E8" }]}>
                      <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Admin</Text>
                    </View>
                  )}
                  {isAdmin && !isCurrentUser && (
                    <Pressable
                      style={styles.menuButton}
                      onPress={() => showMemberMenu(member)}
                      accessibilityLabel={t("common.moreOptions")}
                    >
                      <MaterialCommunityIcons name="dots-vertical" size={22} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable
              style={[styles.inviteRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={() => router.push("/(app)/instellingen/uitnodigen")}
              accessibilityLabel={t("settings.inviteMember")}
              accessibilityRole="button"
            >
              <View style={[styles.inviteIcon, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="account-plus-outline" size={22} color={colors.textMuted} />
              </View>
              <Text style={[styles.inviteText, { color: colors.text }]}>{t("settings.inviteMemberNew")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 8 }]}>{t("settings.sectionDangerZone")}</Text>
        <View style={[styles.dangerCard, { backgroundColor: colors.card }]}>
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={handleLeave}>
            <MaterialCommunityIcons name="exit-to-app" size={22} color={colors.danger} />
            <Text style={[styles.menuRowTitle, { color: colors.danger }]}>{t("profile.leaveHousehold")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
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
                const imageUrl = member.image ?? undefined;
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
                    <View style={[styles.modalAvatar, { backgroundColor: getAvatarColor(otherMembers.indexOf(member)) }]}>
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.modalAvatarImage} />
                      ) : (
                        <Text style={styles.modalAvatarText}>{initial}</Text>
                      )}
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
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 13 },
  loader: { marginVertical: 24 },
  membersCard: { borderRadius: 16, overflow: "hidden" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  memberAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  memberAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  memberEmail: { fontSize: 13, marginBottom: 2 },
  memberRole: { fontSize: 13 },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadgeText: { fontSize: 12, fontWeight: "600" },
  menuButton: { padding: 8 },
  inviteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  inviteIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  inviteText: { flex: 1, fontSize: 16, fontWeight: "500" },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 },
  dangerCard: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
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
    overflow: "hidden",
  },
  modalAvatarImage: { width: 40, height: 40, borderRadius: 20 },
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
