import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { useProfileImageUpload } from "~/hooks/useProfileImageUpload";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";

const P = 20;
const AVATAR_SIZE = 88;

export default function InstellingenProfielScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ openHouseholdSwitcher?: string; openAddHousehold?: string }>();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { householdId, households, setActiveHouseholdId } = useCurrentHousehold();
  const { pickAndUpload, isUploading, error: profileImageError, previewImageUri } = useProfileImageUpload();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  useEffect(() => {
    if (params.openHouseholdSwitcher === "1") setSwitcherVisible(true);
  }, [params.openHouseholdSwitcher]);

  useEffect(() => {
    if (params.openAddHousehold === "1") setAddModalVisible(true);
  }, [params.openAddHousehold]);

  const updateProfileMutation = useMutation({
    ...trpc.auth.updateProfile.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "session" });
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          if (!Array.isArray(k) || !Array.isArray(k[0])) return false;
          const first = k[0] as string[];
          return first[0] === "household" && first[1] === "members";
        },
      });
      router.back();
    },
    onError: () => {
      Alert.alert(
        t("common.error"),
        t("profileEdit.saveError"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.retry"),
            onPress: () => {
              const trimmed = name.trim();
              if (trimmed) updateProfileMutation.mutate({ name: trimmed });
            },
          },
        ]
      );
    },
  });

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === session?.user?.name) {
      router.back();
      return;
    }
    updateProfileMutation.mutate({ name: trimmed });
  };

  const handleChangePassword = () => {
    router.push("/(app)/instellingen/wachtwoord");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("settings.deleteAccountConfirmTitle"),
      t("settings.deleteAccountConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAccount"),
          style: "destructive",
          onPress: async () => {
            try {
              const client = authClient as unknown as { deleteUser?: () => Promise<{ error?: unknown }> };
              if (typeof client.deleteUser === "function") {
                const res = await client.deleteUser();
                if (res?.error) throw res.error;
              } else {
                Alert.alert(t("common.error"), t("settings.deleteAccountNotAvailable"));
                return;
              }
            } catch (err) {
              Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
              return;
            }
            await authClient.signOut();
            router.replace("/(auth)");
          },
        },
      ],
    );
  };

  const initial = (session?.user?.name ?? "?").trim().charAt(0).toUpperCase();
  const imageUrl = previewImageUri ?? session?.user?.image ?? undefined;
  const sortedHouseholds = useMemo(
    () => [...households].sort((a, b) => Number(b.id === householdId) - Number(a.id === householdId)),
    [households, householdId],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("profileEdit.title")}</Text>
        <Pressable
          onPress={handleSave}
          style={styles.headerSave}
          disabled={updateProfileMutation.isPending || !name.trim() || name.trim() === session?.user?.name}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.headerSaveText, { color: colors.primary }]}>{t("profileEdit.save")}</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: P }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <Pressable
              onPress={pickAndUpload}
              disabled={isUploading}
              style={[styles.avatarRing, { borderColor: colors.border }]}
              accessibilityLabel={t("settings.changePhoto")}
              accessibilityRole="button"
            >
              <View style={[styles.avatar, { backgroundColor: "#FF7936" }]}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                )}
                {isUploading && (
                  <View style={[styles.avatarOverlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                    <ActivityIndicator color="#FFF" size="small" />
                  </View>
                )}
              </View>
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="pencil" size={14} color={colors.textMuted} />
              </View>
            </Pressable>
            <Text style={[styles.changePhotoLabel, { color: colors.textMuted }]}>{t("settings.changePhoto")}</Text>
          </View>

          {profileImageError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.errorBannerText, { color: colors.danger }]}>{profileImageError}</Text>
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionPersonalData")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={[styles.fieldRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("profileEdit.nameLabel")}</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder={t("profileEdit.namePlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                editable={!updateProfileMutation.isPending}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("profileEdit.emailLabel")}</Text>
              <Text style={[styles.fieldValue, { color: colors.text }]}>{session?.user?.email ?? "—"}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{t("profileEdit.emailNotEditable")}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("profile.households")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {sortedHouseholds.map((house, index) => {
              const active = house.id === householdId;
              return (
                <Pressable
                  key={house.id}
                  style={[
                    styles.menuRow,
                    index < sortedHouseholds.length - 1 ? { borderBottomColor: colors.border } : styles.menuRowNoBorder,
                  ]}
                  onPress={() => {
                    if (active) {
                      router.push("/(app)/instellingen/huishouden");
                      return;
                    }
                    setActiveHouseholdId(house.id);
                  }}
                >
                  <MaterialCommunityIcons name="home-outline" size={22} color={active ? colors.primary : colors.text} />
                  <View style={styles.householdTextWrap}>
                    <Text style={[styles.menuRowTitle, { color: colors.text }]} numberOfLines={1}>
                      {house.name}
                    </Text>
                  </View>
                  {active ? (
                    <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
                      <Text style={styles.activePillText}>{t("profile.active")}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.switchLabel, { color: colors.primary }]}>{t("profile.switch")}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.addHouseholdButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setAddModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addHouseholdButtonText, { color: colors.text }]}>{t("profile.addHousehold")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionSecurity")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.menuRow, { borderBottomColor: colors.border }]}
              onPress={handleChangePassword}
            >
              <MaterialCommunityIcons name="lock-outline" size={22} color={colors.text} />
              <Text style={[styles.menuRowTitle, { color: colors.text }]}>{t("settings.changePassword")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("settings.sectionDangerZone")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={handleDeleteAccount}>
              <MaterialCommunityIcons name="delete-outline" size={22} color={colors.danger} />
              <Text style={[styles.menuRowTitle, { color: colors.danger }]}>{t("settings.deleteAccount")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={switcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitcherVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSwitcherVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("profile.households")}</Text>
            {sortedHouseholds.map((house, index) => {
              const active = house.id === householdId;
              return (
                <Pressable
                  key={house.id}
                  style={[
                    styles.modalRow,
                    index < sortedHouseholds.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                  onPress={() => {
                    setActiveHouseholdId(house.id);
                    setSwitcherVisible(false);
                  }}
                >
                  <Text style={[styles.modalRowText, { color: colors.text }]} numberOfLines={1}>
                    {house.name}
                  </Text>
                  {active && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable style={[styles.modalCloseButton, { borderColor: colors.border }]} onPress={() => setSwitcherVisible(false)}>
              <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("profile.addHousehold")}</Text>
            <Pressable
              style={[styles.modalRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => {
                setAddModalVisible(false);
                router.push("/(onboarding)/create");
              }}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.modalRowText, styles.modalRowTextFlex, { color: colors.text }]}>{t("profile.newHousehold")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={styles.modalRow}
              onPress={() => {
                setAddModalVisible(false);
                router.push("/(onboarding)/join");
              }}
            >
              <MaterialCommunityIcons name="key-outline" size={20} color={colors.primary} />
              <Text style={[styles.modalRowText, styles.modalRowTextFlex, { color: colors.text }]}>{t("profile.joinWithCode")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.modalCloseButton, { borderColor: colors.border }]} onPress={() => setAddModalVisible(false)}>
              <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBack: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerSave: { minWidth: 72, alignItems: "flex-end", padding: 8 },
  headerSaveText: { fontSize: 16, fontWeight: "600" },
  scroll: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 32 },
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatarRing: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarInitial: { color: "#FFFFFF", fontSize: 36, fontWeight: "700" },
  avatarOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoLabel: { fontSize: 14, marginTop: 8 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  errorBannerText: { fontSize: 14, flex: 1 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 24 },
  fieldRow: { paddingVertical: 14, paddingHorizontal: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  fieldInput: { fontSize: 16 },
  fieldValue: { fontSize: 16 },
  hint: { fontSize: 12, marginTop: 4 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  menuRowTitle: { flex: 1, fontSize: 16, fontWeight: "500" },
  menuRowNoBorder: { borderBottomWidth: 0 },
  householdTextWrap: { flex: 1, minWidth: 0 },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  switchLabel: { fontSize: 13, fontWeight: "700" },
  addHouseholdButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginTop: -10,
    marginBottom: 24,
  },
  addHouseholdButtonText: { flex: 1, fontSize: 16, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: { borderRadius: 16, overflow: "hidden" },
  modalTitle: { fontSize: 18, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  modalRowText: { fontSize: 16, fontWeight: "500" },
  modalRowTextFlex: { flex: 1 },
  modalCloseButton: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { fontSize: 15, fontWeight: "600" },
  bottomSpacer: { height: 24 },
});
