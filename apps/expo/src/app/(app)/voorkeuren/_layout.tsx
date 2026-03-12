import { Stack } from "expo-router";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function VoorkeurenLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="dietary" />
      <Stack.Screen name="taal" />
    </Stack>
  );
}
