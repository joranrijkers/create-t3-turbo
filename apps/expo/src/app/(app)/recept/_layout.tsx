import { Stack } from "expo-router";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function ReceptLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="edit/[id]" />
    </Stack>
  );
}
