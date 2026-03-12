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

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    const result = await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    if (result.error) {
      setError(t("auth.login.errorWrongCredentials"));
    } else {
      router.replace("/(app)/(tabs)/home");
    }
  };

  const handleGoogle = async () => {
    await authClient.signIn.social({ provider: "google" });
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

          <Text style={[styles.title, { color: colors.text }]}>{t("auth.login.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t("auth.login.subtitle")}</Text>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>{t("auth.login.emailLabel")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder={t("auth.login.emailPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>{t("auth.login.password")}</Text>
            <View style={[styles.passwordWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder={t("auth.login.passwordPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.showToggle}>
                <Text style={[styles.showToggleText, { color: colors.primary }]}>{showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.forgotRow} onPress={() => {}}>
              <Text style={[styles.forgotText, { color: colors.text }]}>{t("auth.login.forgotPassword")}</Text>
            </Pressable>

            {error && <Text style={[styles.errorText, { color: "#C62828" }]}>{error}</Text>}

            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t("auth.login.signIn")}</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t("auth.login.or")}</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Pressable
              style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleGoogle}
            >
              <Text style={[styles.googleButtonText, { color: colors.text }]}>G</Text>
              <Text style={[styles.googleButtonLabel, { color: colors.text }]}>{t("auth.login.signInWithGoogle")}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.signupRow} onPress={() => router.push("/(auth)/signup")}>
            <Text style={[styles.signupText, { color: colors.textMuted }]}>{t("auth.login.noAccount")}</Text>
            <Text style={[styles.signupLink, { color: colors.primary }]}>{t("auth.login.signUpLink")}</Text>
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
  input: {
    height: 52, borderRadius: R, borderWidth: 1,
    paddingHorizontal: 16, fontSize: 16,
  },
  passwordWrap: {
    height: 52, borderRadius: R, borderWidth: 1,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, fontSize: 16 },
  showToggle: { paddingLeft: 12 },
  showToggleText: { fontSize: 14, fontWeight: "600" },
  forgotRow: { alignItems: "flex-end", marginTop: 10, marginBottom: 8 },
  forgotText: { fontSize: 14, fontWeight: "500" },
  errorText: { fontSize: 14, marginBottom: 8 },
  primaryButton: {
    height: 54, borderRadius: R, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 14 },
  googleButton: {
    height: 54, borderRadius: R, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  googleButtonText: { fontSize: 18, fontWeight: "700" },
  googleButtonLabel: { fontSize: 16, fontWeight: "500" },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  signupText: { fontSize: 14 },
  signupLink: { fontSize: 14, fontWeight: "600" },
});
