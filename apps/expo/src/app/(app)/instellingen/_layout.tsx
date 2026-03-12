import { Stack } from "expo-router";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function InstellingenLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="leden" />
      <Stack.Screen name="profiel" />
      <Stack.Screen name="huishouden" />
      <Stack.Screen name="uitnodigen" />
      <Stack.Screen name="over" />
      <Stack.Screen name="wachtwoord" />
      <Stack.Screen name="licenties" />
    </Stack>
  );
}
