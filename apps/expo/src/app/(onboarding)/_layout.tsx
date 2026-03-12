import { Stack } from "expo-router";

import { useAppTheme } from "~/hooks/useAppTheme";

export default function OnboardingLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: "slide_from_right",
      }}
    />
  );
}
