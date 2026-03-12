import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { authClient } from "~/utils/auth";

const P = 24;
const R = 16;

export default function SignupScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    setLoading(true);
    const result = await authClient.signUp.email({
      name: name.trim() || "",
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (result.error) {
      setError(t("auth.signup.errorGeneric"));
    } else {
      router.replace("/(onboarding)/welcome");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: P }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.logoWrap}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="account" size={36} color="#FFFFFF" />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t("auth.signup.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("auth.signup.subtitle")}</Text>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>{t("auth.signup.nameLabel")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder={t("auth.signup.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />

            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>{t("auth.signup.emailLabel")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder={t("auth.signup.emailPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>{t("auth.signup.passwordLabel")}</Text>
            <View style={[styles.passwordWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder={t("auth.signup.passwordPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.showToggle}>
                <Text style={[styles.showToggleText, { color: colors.primary }]}>{showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}</Text>
              </Pressable>
            </View>

            {error && <Text style={[styles.errorText, { color: "#C62828" }]}>{error}</Text>}

            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t("auth.signup.createAccountButton")}</Text>}
            </Pressable>
          </View>

          <Pressable style={styles.loginRow} onPress={() => router.back()}>
            <Text style={[styles.loginText, { color: colors.textMuted }]}>{t("auth.signup.hasAccount")}</Text>
            <Text style={[styles.loginLink, { color: colors.primary }]}>{t("auth.signup.signIn")}</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  content: { paddingTop: 48, paddingBottom: 32 },
  logoWrap: { alignItems: "center", marginBottom: 28 },
  logo: { width: 80, height: 80, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 32 },
  form: { gap: 0 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: { height: 52, borderRadius: R, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  passwordWrap: { height: 52, borderRadius: R, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  passwordInput: { flex: 1, fontSize: 16 },
  showToggle: { paddingLeft: 12 },
  showToggleText: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 14, marginTop: 8, marginBottom: 4 },
  primaryButton: { height: 54, borderRadius: R, alignItems: "center", justifyContent: "center", marginTop: 24 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "600" },
});
