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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "~/hooks/useAppTheme";
import { useProfileImageUpload } from "~/hooks/useProfileImageUpload";
import { authClient } from "~/utils/auth";
import { trpc } from "~/utils/api";

const P = 20;
const AVATAR_SIZE = 80;

export default function ProfielEditScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { pickAndUpload, isUploading, error: profileImageError, previewImageUri } = useProfileImageUpload();

  const [name, setName] = useState(session?.user?.name ?? "");

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  const updateProfileMutation = useMutation({
    ...trpc.auth.updateProfile.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "session" });
      queryClient.invalidateQueries({
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

  const initial = (session?.user?.name ?? "?").trim().charAt(0).toUpperCase();
  const imageUrl = previewImageUri ?? session?.user?.image ?? undefined;

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
          </View>

          {profileImageError ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.errorBannerText, { color: colors.danger }]}>{profileImageError}</Text>
            </View>
          ) : null}

          <View style={[styles.fieldGroup, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t("profileEdit.nameLabel")}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder={t("profileEdit.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              editable={!updateProfileMutation.isPending}
            />
          </View>

          <View style={[styles.fieldGroup, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t("profileEdit.emailLabel")}</Text>
            <Text style={[styles.inputReadOnly, { color: colors.textMuted }]}>{session?.user?.email ?? "—"}</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t("profileEdit.emailNotEditable")}</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { paddingTop: 32, paddingBottom: 32 },
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
  avatarInitial: { color: "#FFFFFF", fontSize: 32, fontWeight: "700" },
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
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  errorBannerText: { fontSize: 14, flex: 1 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputReadOnly: { fontSize: 16, paddingVertical: 4 },
  hint: { fontSize: 12, marginTop: 4 },
  bottomSpacer: { height: 24 },
});
