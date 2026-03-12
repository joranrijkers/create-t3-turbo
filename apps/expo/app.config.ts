import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Prikkr",
  slug: "Prikkr",
  scheme: "prikkr",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon-light.png",
  userInterfaceStyle: "automatic",
  updates: {
    fallbackToCacheTimeout: 0,
  },
  newArchEnabled: true,
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "com.prikkr.app",
    supportsTablet: true,
    icon: {
      light: "./assets/icon-light.png",
      dark: "./assets/icon-dark.png",
    },
  },
  android: {
    package: "com.prikkr.app",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-light.png",
      backgroundColor: "#1F104A",
    },
    edgeToEdgeEnabled: true,
  },
  extra: {
    eas: {
      projectId: "fcc4aa15-1f96-45bb-812c-692a7ad32338",
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
    reactCanary: true,
    reactCompiler: true,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-camera",
      {
        cameraPermission: "Prikkr heeft toegang tot je camera nodig om een uitnodigings-QR-code te scannen.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Prikkr heeft toegang tot je foto's nodig om een receptfoto toe te voegen.",
        cameraPermission:
          "Prikkr heeft toegang tot je camera nodig om een receptfoto te maken.",
      },
    ],
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#E4E4E7",
        image: "./assets/icon-light.png",
        dark: {
          backgroundColor: "#18181B",
          image: "./assets/icon-dark.png",
        },
      },
    ],
  ],
});
