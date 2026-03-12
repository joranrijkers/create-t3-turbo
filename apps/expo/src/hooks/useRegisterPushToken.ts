import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useMutation } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

/**
 * Registers the device for push notifications and sends the Expo push token to the backend.
 * Mount once when the user is in the (app) section (logged in).
 * Requires a development build for push to work on Android (SDK 53+).
 */
export function useRegisterPushToken() {
  const registered = useRef(false);
  const registerMutation = useMutation(
    trpc.notifications.registerPushToken.mutationOptions()
  );

  useEffect(() => {
    if (registered.current) return;

    let cancelled = false;
    (async () => {
      if (!Device.isDevice) return;
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" || cancelled) return;

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
        });
        const token = tokenData.data;
        if (token && !cancelled) {
          registered.current = true;
          await registerMutation.mutateAsync({
            expoPushToken: token,
            deviceId: Device.modelName ?? undefined,
          });
        }
      } catch {
        // Ignore: push not configured (e.g. no EAS project ID) or network error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [registerMutation]);
}
