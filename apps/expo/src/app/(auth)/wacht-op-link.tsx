import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";

export default function WachtOpLinkScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.content, { paddingHorizontal: 24 }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accentLight }]}>
          <MaterialCommunityIcons name="email-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Check je e-mail</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          We hebben een inloglink gestuurd. Klik op de link in de e-mail om in te loggen.
        </Text>
        <Pressable
          style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => router.replace("/(auth)")}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Terug naar inloggen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 96, height: 96, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 40 },
  backButton: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  backButtonText: { fontSize: 16, fontWeight: "600" },
});
