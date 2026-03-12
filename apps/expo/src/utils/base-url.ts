import Constants from "expo-constants";

/**
 * Extend this function when going to production by
 * setting the baseUrl to your production API URL.
 *
 * In development: uses the same host as Metro (from hostUri) so the device
 * can reach the Next.js API. Ensure Next.js is started with --hostname 0.0.0.0
 * (see apps/nextjs/package.json dev script) so it accepts connections on the LAN IP.
 */
export const getBaseUrl = () => {
  if (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
    throw new Error(
      "Failed to get API host. Set EXPO_PUBLIC_API_URL in .env or run from Expo dev client.",
    );
  }
  return `http://${localhost}:3000`;
};
