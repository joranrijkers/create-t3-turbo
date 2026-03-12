import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useAppTheme } from "~/hooks/useAppTheme";

export default function PostDetailScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>Post {id ?? "—"}</Text>
        <Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.btnText, { color: colors.text }]}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  btnText: { fontSize: 16, fontWeight: "600" },
});
