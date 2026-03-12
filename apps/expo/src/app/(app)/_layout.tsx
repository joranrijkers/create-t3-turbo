import { Redirect, Stack } from "expo-router";

import { useRegisterPushToken } from "~/hooks/useRegisterPushToken";
import { useAppTheme } from "~/hooks/useAppTheme";
import { authClient } from "~/utils/auth";

export default function AppLayout() {
  const { colors } = useAppTheme();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  useRegisterPushToken();

  if (!sessionPending && !session) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="huishouden" options={{ headerShown: false }} />
      <Stack.Screen name="instellingen" options={{ headerShown: false }} />
      <Stack.Screen name="profiel" options={{ headerShown: false }} />
      <Stack.Screen name="maaltijd" options={{ headerShown: false }} />
      <Stack.Screen name="recept" options={{ headerShown: false }} />
      <Stack.Screen name="voorkeuren" options={{ headerShown: false }} />
      <Stack.Screen
        name="post/[id]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
