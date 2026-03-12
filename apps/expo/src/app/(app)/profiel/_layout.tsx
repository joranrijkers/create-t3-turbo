import { Stack } from "expo-router";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function ProfielLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="edit" />
    </Stack>
  );
}
